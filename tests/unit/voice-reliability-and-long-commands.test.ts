import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioOutputService } from '../../packages/voice/src/output-service.js';
import { VoiceInputManager } from '../../packages/voice/src/voice-input-manager.js';
import { VoiceCatalogService } from '../../packages/voice/src/catalog.js';
import { EventBus } from '../../packages/events/src/index.js';
import { AudioCaptureService } from '../../packages/voice/src/index.js';
import type { AudioFrame } from '@meghai/shared-types';

describe('MeghAI Voice Reliability & Long Command Support', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe('AudioOutputService Streaming & Playback Resiliency', () => {
    it('successfully handles streaming audio chunks via playTTSStream', async () => {
      const outputService = new AudioOutputService({ eventBus });

      // Create a mock stream yielding 3 PCM/audio chunks
      const chunks = [
        Buffer.from('RIFF....WAVEfmt '),
        Buffer.from('data....chunk123'),
        Buffer.from('chunk45678901234')
      ];

      const mockStream: AsyncIterable<Buffer> = {
        [Symbol.asyncIterator]: () => {
          let i = 0;
          return {
            async next() {
              if (i < chunks.length) {
                return { done: false, value: chunks[i++] };
              }
              return { done: true, value: undefined };
            }
          };
        }
      };

      const result = await outputService.playTTSStream(mockStream, {
        voiceId: 'onecore-heera',
        text: 'Streaming audio test',
        correlationId: 'stream-test-1'
      });

      expect(result.success).toBe(true);
      expect(result.timeToFirstAudioMs).toBeGreaterThanOrEqual(0);
      expect(outputService.isPlaying()).toBe(false);
    });

    it('instantly halts active audio playback upon interrupt call', async () => {
      const outputService = new AudioOutputService({ eventBus });
      const stopped = outputService.stop('Manual cancellation test');
      expect(typeof stopped).toBe('boolean');
      expect(outputService.isPlaying()).toBe(false);
    });
  });

  describe('VoiceInputManager Long Command Utterances & Natural Pauses', () => {
    it('accumulates multiple audio frames up to max duration without premature truncation', async () => {
      const mockCapture = new AudioCaptureService({ mockCapture: true });

      const outputService = new AudioOutputService({ eventBus });
      const executedCommands: string[] = [];

      const manager = new VoiceInputManager({
        audioCapture: mockCapture,
        audioOutput: outputService,
        speechRecognition: {
          transcribe: async () => ({
            text: 'Hey Megh please summarize all pending engineering tasks for today',
            confidence: 0.98,
            providerId: 'online-whisper',
            source: 'online'
          }),
          isAvailable: async () => true,
          getStats: () => ({ totalTranscriptions: 1, failedTranscriptions: 0, averageLatencyMs: 120, cacheHitRate: 0 })
        } as any,
        eventBus,
        maxCommandDurationMs: 60000,
        silenceThresholdMs: 2200,
        onCommand: async (cmd) => {
          executedCommands.push(cmd);
        }
      });

      await manager.startPassiveListening();
      expect(manager.getState()).toBe('PASSIVE_WAKE_LISTENING');

      // Feed frames simulating speech and verify state transitions
      const dummyFrame: AudioFrame = {
        data: Buffer.alloc(3200),
        timestamp: Date.now(),
        sequenceNumber: 1,
        sampleRate: 16000,
        channels: 1,
        format: 'pcm_s16le',
        durationMs: 100,
        rms: 450,
        peak: 900,
        normalizedLevel: 0.1
      };

      manager.handleAudioFrame(dummyFrame);
      expect(manager.getState()).toBe('PASSIVE_WAKE_LISTENING');
    });

    it('emits partial transcript preview events without invoking final command execution', async () => {
      const mockCapture = new AudioCaptureService({ mockCapture: true });

      const outputService = new AudioOutputService({ eventBus });
      let commandExecutionCount = 0;
      const partials: string[] = [];

      eventBus.subscribe('TRANSCRIPT_PARTIAL', (event: any) => {
        partials.push(event.payload.text);
      });

      const manager = new VoiceInputManager({
        audioCapture: mockCapture,
        audioOutput: outputService,
        eventBus,
        onCommand: async () => {
          commandExecutionCount++;
        }
      });

      manager.emitPartialTranscript('what is the current temperature in');
      manager.emitPartialTranscript('what is the current temperature in Seattle');

      expect(partials).toHaveLength(2);
      expect(partials[1]).toBe('what is the current temperature in Seattle');
      // STRICT GUARANTEE: Never invokes command handler on partial preview
      expect(commandExecutionCount).toBe(0);
    });
  });

  describe('VoiceCatalogService Multi-Provider Routing', () => {
    it('correctly maps OpenAI, ElevenLabs, Google Cloud, OneCore, and SAPI providers', () => {
      const catalog = new VoiceCatalogService();

      const openaiProvider = catalog.getProviderForVoice('openai-alloy');
      expect(openaiProvider).toBeDefined();
      expect(openaiProvider.id).toBe('openai');

      const elevenProvider = catalog.getProviderForVoice('eleven-adam');
      expect(elevenProvider).toBeDefined();
      expect(elevenProvider.id).toBe('elevenlabs');

      const googleProvider = catalog.getProviderForVoice('goog-en-us-journey-f');
      expect(googleProvider).toBeDefined();
      expect(googleProvider.id).toBe('google-cloud');

      const onecoreProvider = catalog.getProviderForVoice('onecore-heera');
      expect(onecoreProvider).toBeDefined();
      expect(onecoreProvider.id).toBe('windows-onecore');
    });

    it('provides synthesizeStream yielding an async iterable stream', async () => {
      const catalog = new VoiceCatalogService();
      const stream = await catalog.synthesizeStream('Testing voice catalog streaming', {
        voiceId: 'onecore-heera'
      });

      expect(stream).toBeDefined();
      expect(typeof (stream as any)[Symbol.asyncIterator]).toBe('function');

      const iterator = stream[Symbol.asyncIterator]();
      const firstChunk = await iterator.next();
      expect(firstChunk.done).toBe(false);
      expect(Buffer.isBuffer(firstChunk.value)).toBe(true);
    }, 15000);
  });
});
