import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  VoiceInputManager,
  AudioCaptureService,
  AudioPlaybackService,
  SpeechRecognitionService
} from '../../packages/voice/src/index';
import { MeghAIServer } from '../../apps/api/src/server';
import { KillSwitch } from '../../packages/security/src/index';
import { EventBus } from '../../packages/events/src/index';
import { GeminiProvider, ModelRouter } from '../../packages/model-router/src/index';
import type { AudioFrame, STTResult } from '../../packages/shared-types/src/index';

function createSyntheticFrame(options: {
  rms: number;
  durationMs?: number;
  sequenceNumber?: number;
}): AudioFrame {
  const durationMs = options.durationMs ?? 100;
  const numSamples = Math.floor(16000 * (durationMs / 1000));
  const data = Buffer.alloc(numSamples * 2);

  const amplitude = Math.round(options.rms * Math.SQRT2);
  for (let i = 0; i < numSamples; i++) {
    const val = Math.min(32767, Math.max(-32768, Math.round(amplitude * Math.sin((2 * Math.PI * 440 * i) / 16000))));
    data.writeInt16LE(val, i * 2);
  }

  return {
    timestamp: Date.now(),
    sampleRate: 16000,
    channels: 1,
    format: 'pcm_s16le',
    sequenceNumber: options.sequenceNumber ?? 1,
    durationMs,
    data,
    rms: options.rms,
    peak: Math.abs(amplitude),
    normalizedLevel: Math.min(1.0, options.rms / 10000)
  };
}

describe('Voice Pipeline Idempotency, Session Isolation & 429 Handling', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `meghai-idempotency-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    KillSwitch.reset();
  });

  afterEach(() => {
    KillSwitch.reset();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Partial Transcript Isolation & Non-Execution Contract', () => {
    it('TRANSCRIPT_PARTIAL emits preview telemetry only and never calls command handler or changes state', async () => {
      const eventBus = new EventBus();
      const emittedEvents: Array<{ type: string; payload: any }> = [];
      eventBus.subscribe('TRANSCRIPT_PARTIAL', (evt) => emittedEvents.push({ type: 'TRANSCRIPT_PARTIAL', payload: evt.payload }));
      eventBus.subscribe('TRANSCRIPT_FINAL', (evt) => emittedEvents.push({ type: 'TRANSCRIPT_FINAL', payload: evt.payload }));

      const commandHandler = vi.fn();
      const audioCapture = new AudioCaptureService({ mockCapture: true });
      const audioPlayback = new AudioPlaybackService({ eventBus });

      const manager = new VoiceInputManager({
        audioCapture,
        audioOutput: audioPlayback,
        eventBus,
        onCommand: commandHandler
      });

      await manager.startPassiveListening();

      // Emit multiple partial transcripts
      manager.emitPartialTranscript('What');
      manager.emitPartialTranscript('What is the');
      manager.emitPartialTranscript('What is the weather');

      expect(emittedEvents.length).toBe(3);
      expect(emittedEvents.every(e => e.type === 'TRANSCRIPT_PARTIAL')).toBe(true);
      expect(emittedEvents[0].payload.text).toBe('What');
      expect(emittedEvents[0].payload.isPartial).toBe(true);
      expect(emittedEvents[2].payload.text).toBe('What is the weather');

      // Crucial invariant: commandHandler was NEVER called by partial transcripts
      expect(commandHandler).not.toHaveBeenCalled();
      // Crucial invariant: state remains PASSIVE_WAKE_LISTENING, never PROCESSING
      expect(manager.getState()).toBe('PASSIVE_WAKE_LISTENING');

      await manager.stop();
    });
  });

  describe('Session ID, Command ID and Idempotency Deduplication', () => {
    it('generates unique voiceSessionId and commandId and emits TRANSCRIPT_FINAL exactly once', async () => {
      const eventBus = new EventBus();
      const finalEvents: any[] = [];
      eventBus.subscribe('TRANSCRIPT_FINAL', (evt) => finalEvents.push(evt.payload));

      let processedCommandCount = 0;
      const commandHandler = vi.fn().mockImplementation(async () => {
        processedCommandCount++;
      });

      const audioCapture = new AudioCaptureService({ mockCapture: true });
      const audioPlayback = new AudioPlaybackService({ eventBus });

      // Mock STT provider returning fixed text
      const mockSTT: any = {
        transcribe: vi.fn().mockResolvedValue({
          text: 'Open calculator',
          interpretedText: 'Open calculator',
          confidence: 0.95,
          isFinal: true
        })
      };

      const manager = new VoiceInputManager({
        audioCapture,
        audioOutput: audioPlayback,
        speechRecognition: mockSTT,
        eventBus,
        onCommand: commandHandler
      });

      await manager.startPassiveListening();

      // Simulate wake detection trigger
      await (manager as any).handleWakeConfirmed({ detected: true, phrase: 'Hey Megh', confidence: 0.9 });
      expect(manager.getState()).toBe('COMMAND_CAPTURE');

      // Feed frames
      for (let i = 0; i < 5; i++) {
        manager.handleAudioFrame(createSyntheticFrame({ rms: 500, sequenceNumber: i }));
      }

      // Finish command capture
      await (manager as any).finishCommandCapture('VAD speech ended');

      expect(finalEvents.length).toBe(1);
      const finalPayload = finalEvents[0];
      expect(finalPayload.voiceSessionId).toBeDefined();
      expect(finalPayload.voiceSessionId).toMatch(/^vs-/);
      expect(finalPayload.commandId).toBeDefined();
      expect(finalPayload.commandId).toMatch(/^cmd-/);
      expect(finalPayload.text).toBe('Open calculator');

      expect(commandHandler).toHaveBeenCalledTimes(1);
      expect(commandHandler).toHaveBeenCalledWith('Open calculator', {
        voiceSessionId: finalPayload.voiceSessionId,
        commandId: finalPayload.commandId
      });

      // Attempt duplicate finishCommandCapture with same frames/text in same session
      await (manager as any).finishCommandCapture('Duplicate call');
      // Should still be exactly 1 call
      expect(commandHandler).toHaveBeenCalledTimes(1);
      expect(finalEvents.length).toBe(1);

      await manager.stop();
    });
  });

  describe('Self-Wake & Echo Suppression Guard', () => {
    it('discards audio frames when MeghAI is speaking or within echo cooldown', async () => {
      const eventBus = new EventBus();
      const audioCapture = new AudioCaptureService({ mockCapture: true });
      const audioPlayback = new AudioPlaybackService({ eventBus });

      const manager = new VoiceInputManager({
        audioCapture,
        audioOutput: audioPlayback,
        eventBus
      });

      await manager.startPassiveListening();

      // Set playback state to playing
      vi.spyOn(audioPlayback, 'isPlaying').mockReturnValue(true);

      const triggerWakeSpy = vi.spyOn(manager as any, 'triggerWakeCheck');

      // Feed speech energy frame
      manager.handleAudioFrame(createSyntheticFrame({ rms: 2000, sequenceNumber: 1 }));

      // Frames should be suppressed and rollingWakeFrames kept empty
      expect(triggerWakeSpy).not.toHaveBeenCalled();
      expect((manager as any).rollingWakeFrames.length).toBe(0);

      await manager.stop();
    });
  });

  describe('Server Voice Command Handling & 429 Quota Exhaustion', () => {
    it('deduplicates identical voice commands arriving with the same commandId', async () => {
      const server = new MeghAIServer(tempDir);
      server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });

      let executionCount = 0;
      vi.spyOn(server, 'processUserRequest').mockImplementation(async () => {
        executionCount++;
        return { status: 'COMPLETED', reply: 'ok' };
      });

      const options = (server as any).voiceInput['commandHandler'];

      // Send first command
      await (server as any).voiceInput['commandHandler']('Create a note', {
        voiceSessionId: 'vs-test-1',
        commandId: 'cmd-test-1'
      });

      expect(executionCount).toBe(1);

      // Send duplicate with same commandId
      await (server as any).voiceInput['commandHandler']('Create a note', {
        voiceSessionId: 'vs-test-1',
        commandId: 'cmd-test-1'
      });

      // Must be deduplicated by server.processedVoiceCommands
      expect(executionCount).toBe(1);
    });

    it('emits VOICE_MODEL_RATE_LIMITED and graceful TASK_FAILED when model provider returns HTTP 429', async () => {
      const server = new MeghAIServer(tempDir);
      server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });

      const rateLimitEvents: any[] = [];
      const taskFailedEvents: any[] = [];

      server.eventBus.subscribe('VOICE_MODEL_RATE_LIMITED', (evt) => rateLimitEvents.push(evt.payload));
      server.eventBus.subscribe('TASK_FAILED', (evt) => taskFailedEvents.push(evt.payload));

      // Mock model router to simulate Gemini 429
      const rateLimitError = new Error('Resource has been exhausted (e.g. check quota).');
      (rateLimitError as any).isRateLimit = true;
      (rateLimitError as any).status = 429;

      vi.spyOn(server.modelRouter, 'completeWithFallback').mockRejectedValue(rateLimitError);

      const result = await server.processUserRequest('Explain quantum physics', false, {
        voiceSessionId: 'vs-test-429',
        commandId: 'cmd-test-429',
        source: 'VOICE'
      });

      expect(result.status).toBe('RATE_LIMITED');
      expect(result.reply).toContain('HTTP 429');
      expect(result.reply).toContain('quota exceeded');

      expect(rateLimitEvents.length).toBe(1);
      expect(rateLimitEvents[0].voiceSessionId).toBe('vs-test-429');
      expect(rateLimitEvents[0].commandId).toBe('cmd-test-429');

      expect(taskFailedEvents.length).toBe(1);
      expect(taskFailedEvents[0].status).toBe('RATE_LIMITED');
      expect(taskFailedEvents[0].reply).toContain('HTTP 429');
      expect(taskFailedEvents[0].commandId).toBe('cmd-test-429');
    });

    it('GeminiProvider complete fails fast on HTTP 429 without retrying alternate models', async () => {
      const provider = new GeminiProvider('dummy-key');
      vi.spyOn(provider, 'getApiKey').mockReturnValue('valid-test-key');

      let fetchCallCount = 0;
      global.fetch = vi.fn().mockImplementation(async () => {
        fetchCallCount++;
        return {
          ok: false,
          status: 429,
          text: async () => JSON.stringify({
            error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).' }
          })
        };
      }) as any;

      try {
        await provider.complete({
          messages: [{ role: 'user', content: 'hi' }]
        });
        expect.unreachable('Should have thrown');
      } catch (err: any) {
        expect(err.isRateLimit).toBe(true);
        expect(err.status).toBe(429);
        expect(err.message).toContain('HTTP 429');
      }

      // Crucial: fetch was called exactly ONCE, not retried for alternate models
      expect(fetchCallCount).toBe(1);
    });
  });
});
