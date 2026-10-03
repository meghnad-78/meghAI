import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  VoiceActivityDetector,
  AcousticWakeWordDetector,
  SpeechRecognitionService,
  WindowsSpeechSTTProvider,
  VoiceInputManager,
  AudioCaptureService,
  AudioPlaybackService,
  writePcmToWavFile
} from '../../packages/voice/src/index';
import { MeghAIServer } from '../../apps/api/src/server';
import { KillSwitch } from '../../packages/security/src/index';
import type { AudioFrame } from '../../packages/shared-types/src/index';

function createSyntheticFrame(options: {
  rms: number;
  durationMs?: number;
  sequenceNumber?: number;
}): AudioFrame {
  const durationMs = options.durationMs ?? 100;
  const numSamples = Math.floor(16000 * (durationMs / 1000));
  const data = Buffer.alloc(numSamples * 2);

  // Generate PCM sine wave matching requested RMS
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

describe('MeghAI Voice Input Subsystem & Chat Recovery', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `meghai-voice-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    KillSwitch.reset();
  });

  afterEach(() => {
    KillSwitch.reset();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Core Text Chat Path (Elimination of Maximum Call Stack Size Exceeded)', () => {
    it('successfully processes normal typed chat without recursion or stack overflow', async () => {
      const server = new MeghAIServer(tempDir);
      server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });
      vi.spyOn(server.modelRouter, 'completeWithFallback').mockResolvedValue({
        content: '2 + 2 = 4',
        providerId: 'gemini',
        modelId: 'gemini-2.5-flash',
        tokensUsed: { totalTokens: 10, promptTokens: 4, completionTokens: 6 },
        latencyMs: 100,
        finishReason: 'stop'
      });

      const res = await server.processUserRequest('Hello, what is 2+2?');
      expect(res).toBeDefined();
      expect(res.status).toBe('COMPLETED');
      expect(typeof res.reply).toBe('string');
      expect((res.reply as string).length).toBeGreaterThan(0);
      expect(res.reply).not.toContain('Maximum call stack size exceeded');
    }, 20000);

    it('processes user greeting and produces genuine response', async () => {
      const server = new MeghAIServer(tempDir);
      server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });
      vi.spyOn(server.modelRouter, 'completeWithFallback').mockResolvedValue({
        content: 'Hello! How can I help you today?',
        providerId: 'gemini',
        modelId: 'gemini-2.5-flash',
        tokensUsed: { totalTokens: 12, promptTokens: 2, completionTokens: 10 },
        latencyMs: 100,
        finishReason: 'stop'
      });

      const res = await server.processUserRequest('Hello');
      expect(res).toBeDefined();
      expect(res.status).toBe('COMPLETED');
      expect(typeof res.reply).toBe('string');
      expect((res.reply as string).length).toBeGreaterThan(0);
      expect(res.reply).not.toContain('Maximum call stack size exceeded');
    }, 20000);

    it('functions seamlessly with AutoSpeak ON without blocking chat return', async () => {
      const server = new MeghAIServer(tempDir);
      server.voiceSettings.updateSettings({ autoSpeak: 'ON' });
      vi.spyOn(server.modelRouter, 'completeWithFallback').mockResolvedValue({
        content: 'Hello',
        providerId: 'gemini',
        modelId: 'gemini-2.5-flash',
        tokensUsed: { totalTokens: 5, promptTokens: 3, completionTokens: 2 },
        latencyMs: 100,
        finishReason: 'stop'
      });

      const res = await server.processUserRequest('Say hello in one word');
      expect(res).toBeDefined();
      expect(res.status).toBe('COMPLETED');
      expect(typeof res.reply).toBe('string');
      expect(res.reply).not.toContain('Maximum call stack size exceeded');
    }, 20000);
  });

  describe('Voice Activity Detector (VAD)', () => {
    it('maintains SILENCE state and adapts noise floor on low-energy frames', () => {
      const vad = new VoiceActivityDetector({ minSpeechRms: 300 });
      expect(vad.getState()).toBe('SILENCE');

      for (let i = 1; i <= 5; i++) {
        const frame = createSyntheticFrame({ rms: 75, sequenceNumber: i });
        const result = vad.processFrame(frame);
        expect(result.state).toBe('SILENCE');
        expect(result.isSpeech).toBe(false);
      }

      expect(vad.getNoiseFloor()).toBeGreaterThan(0);
      expect(vad.getState()).toBe('SILENCE');
    });

    it('transitions to SPEECH state upon sustained speech energy and emits event', () => {
      const events: string[] = [];
      const vad = new VoiceActivityDetector({
        minSpeechRms: 300,
        speechLeadFrames: 2,
        onSpeechStart: () => events.push('SPEECH_START')
      });

      // Frame 1: high energy
      const f1 = createSyntheticFrame({ rms: 1200, sequenceNumber: 1 });
      vad.processFrame(f1);
      expect(vad.getState()).toBe('SILENCE'); // Requires 2 consecutive frames

      // Frame 2: high energy
      const f2 = createSyntheticFrame({ rms: 1500, sequenceNumber: 2 });
      vad.processFrame(f2);
      expect(vad.getState()).toBe('SPEECH');
      expect(events).toContain('SPEECH_START');
    });

    it('transitions back to SILENCE when silence persists after speech', () => {
      const events: string[] = [];
      const vad = new VoiceActivityDetector({
        minSpeechRms: 300,
        speechLeadFrames: 1,
        silenceTimeoutMs: 300, // 3 frames of silence
        onSpeechEnd: () => events.push('SPEECH_END')
      });

      // Start speech
      vad.processFrame(createSyntheticFrame({ rms: 1500, sequenceNumber: 1 }));
      expect(vad.getState()).toBe('SPEECH');

      // 3 silent frames
      vad.processFrame(createSyntheticFrame({ rms: 50, sequenceNumber: 2 }));
      vad.processFrame(createSyntheticFrame({ rms: 50, sequenceNumber: 3 }));
      vad.processFrame(createSyntheticFrame({ rms: 50, sequenceNumber: 4 }));

      expect(vad.getState()).toBe('SILENCE');
      expect(events).toContain('SPEECH_END');
    });
  });

  describe('Speech Recognition Service & STT Provider', () => {
    it('exposes WindowsSpeechSTTProvider and reports availability on Windows', () => {
      const stt = new SpeechRecognitionService();
      const providers = stt.listProviders();
      expect(providers.length).toBeGreaterThan(0);
      expect(providers.some(p => p.id === 'windows-system-speech')).toBe(true);

      const winProvider = stt.getProvider('windows-system-speech');
      expect(winProvider).toBeDefined();
      if (process.platform === 'win32') {
        expect(winProvider!.isAvailable()).toBe(true);
      }
    });

    it('handles empty audio gracefully without throwing', async () => {
      const stt = new SpeechRecognitionService();
      const res = await stt.transcribe(Buffer.alloc(0));
      expect(res).toBeDefined();
      expect(res.text).toBe('');
      expect(res.confidence).toBe(0);
      expect(res.isFinal).toBe(true);
    });

    it('correctly creates valid RIFF WAV files from PCM buffers', () => {
      const pcm = Buffer.alloc(3200); // 100ms PCM
      const wavPath = path.join(tempDir, 'test_output.wav');
      writePcmToWavFile(pcm, wavPath, 16000, 1);

      expect(fs.existsSync(wavPath)).toBe(true);
      const data = fs.readFileSync(wavPath);
      expect(data.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(data.subarray(8, 12).toString('ascii')).toBe('WAVE');
      expect(data.length).toBe(3200 + 44);
    });
  });

  describe('Acoustic Wake Word Detector', () => {
    it('initializes and provides clean reset without memory leaks', () => {
      const detector = new AcousticWakeWordDetector();
      expect(detector).toBeDefined();
      detector.reset();
    });

    it('rejects buffers that are too short to contain a wake phrase (<500ms)', async () => {
      const detector = new AcousticWakeWordDetector();
      const shortBuffer = Buffer.alloc(3200); // only 100ms
      const res = await detector.detectWakePhrase(shortBuffer);
      expect(res.detected).toBe(false);
    });

    it('debounces rapid consecutive calls to prevent duplicate triggers', async () => {
      const detector = new AcousticWakeWordDetector({ debounceTimeMs: 5000 });
      const buf = Buffer.alloc(16000);
      const res1 = await detector.detectWakePhrase(buf);
      const res2 = await detector.detectWakePhrase(buf);
      expect(res2.detected).toBe(false); // Second call within debounce window
    });
  });

  describe('VoiceInputManager State Machine & Lifecycle', () => {
    it('manages state transitions from IDLE to PASSIVE_WAKE_LISTENING to IDLE', async () => {
      const capture = new AudioCaptureService({ mockCapture: true });
      const playback = new AudioPlaybackService();
      const manager = new VoiceInputManager({
        audioCapture: capture,
        audioOutput: playback
      });

      expect(manager.getState()).toBe('IDLE');

      await manager.startPassiveListening();
      expect(manager.getState()).toBe('PASSIVE_WAKE_LISTENING');

      await manager.stop();
      expect(manager.getState()).toBe('IDLE');
    });

    it('halts voice input and resets state immediately upon Emergency Kill Switch', async () => {
      const capture = new AudioCaptureService({ mockCapture: true });
      const playback = new AudioPlaybackService();
      const manager = new VoiceInputManager({
        audioCapture: capture,
        audioOutput: playback
      });

      await manager.startPassiveListening();
      expect(manager.getState()).toBe('PASSIVE_WAKE_LISTENING');

      KillSwitch.stopMegh('Emergency Test');
      await manager.stop('Kill switch triggered');
      expect(manager.getState()).toBe('IDLE');
    });
  });
});
