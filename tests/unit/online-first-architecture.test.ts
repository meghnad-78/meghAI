import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  validateAudioParameters,
  analyzeAudioQuality,
  writePcmToWavBuffer,
  trimSilencePadding,
  STTRouter,
  ElevenLabsSTTProvider,
  GoogleCloudSTTProvider,
  OpenAIWhisperSTTProvider,
  OpenAITTSProvider,
  VoiceCatalogService,
  VoiceInputManager,
  AudioOutputService,
  AudioCueService,
  AudioCaptureService,
  SpeechRecognitionService,
  AcousticWakeWordDetector,
  VoiceActivityDetector,
  stripWakePhrase
} from '../../packages/voice/src/index';
import { EventBus } from '../../packages/events/src/index';
import { ModelRouter } from '../../packages/model-router/src/index';
import { loadStoredCredentials, saveProviderCredential } from '../../packages/config/src/index';
import type { STTProvider, STTOptions, STTResult } from '../../packages/shared-types/src/index';

describe('MeghAI Online-First Architecture Subsystems', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `meghai-online-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('AudioPreprocessor & Format Validation', () => {
    it('accurately validates 16kHz mono 16-bit PCM parameters', () => {
      const valid = validateAudioParameters(16000, 1, 16);
      expect(valid.valid).toBe(true);

      const invalidRate = validateAudioParameters(8000, 1, 16);
      expect(invalidRate.valid).toBe(false);
      expect(invalidRate.reason).toContain('Unsupported sample rate');

      const invalidChannels = validateAudioParameters(16000, 2, 16);
      expect(invalidChannels.valid).toBe(false);
      expect(invalidChannels.reason).toContain('Expected mono audio');
    });

    it('estimates RMS, Peak, and SNR without altering phoneme structure', () => {
      const sampleRate = 16000;
      const durationMs = 200;
      const totalSamples = Math.floor((sampleRate * durationMs) / 1000);
      const buffer = Buffer.alloc(totalSamples * 2);

      for (let i = 0; i < totalSamples; i++) {
        const val = Math.round(15000 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
        buffer.writeInt16LE(val, i * 2);
      }

      const metrics = analyzeAudioQuality(buffer, sampleRate, 1);
      expect(metrics.durationMs).toBe(200);
      expect(metrics.peak).toBeGreaterThan(14000);
      expect(metrics.rms).toBeGreaterThan(8000);
      expect(metrics.snrEstimateDb).toBeGreaterThan(10);
      expect(metrics.clippingRatio).toBe(0);
      expect(metrics.isValid).toBe(true);
    });

    it('generates standard RIFF WAV headers compatible with cloud STT engines', () => {
      const pcmBuffer = Buffer.alloc(1600 * 2); // 100ms
      const wav = writePcmToWavBuffer(pcmBuffer, 16000, 1);

      expect(wav.length).toBe(44 + pcmBuffer.length);
      expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
      expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
      expect(wav.toString('ascii', 12, 16)).toBe('fmt ');
      expect(wav.readUInt16LE(20)).toBe(1); // PCM
      expect(wav.readUInt16LE(22)).toBe(1); // Mono
      expect(wav.readUInt32LE(24)).toBe(16000); // 16kHz
    });

    it('pads trimmed speech audio preserving consonant and vowel boundaries', () => {
      const sampleRate = 16000;
      const soundSamples = 3200; // 200ms
      const silenceSamples = 8000; // 500ms
      const totalBuffer = Buffer.alloc((silenceSamples * 2 + soundSamples) * 2);

      // Write 440Hz tone in the middle
      for (let i = 0; i < soundSamples; i++) {
        const val = Math.round(12000 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
        totalBuffer.writeInt16LE(val, (silenceSamples + i) * 2);
      }

      const trimmed = trimSilencePadding(totalBuffer, 16000);
      expect(trimmed.length).toBeLessThan(totalBuffer.length);
      expect(trimmed.length).toBeGreaterThan(soundSamples * 2);
    });
  });

  describe('STTRouter Multi-Provider Selection & Normalization', () => {
    it('routes Indic languages (Hindi, Bengali, Hinglish) to Google Cloud STT / Gemini', async () => {
      const router = new STTRouter();
      const mockGoogle: STTProvider = {
        id: 'google-cloud-stt',
        name: 'Google Cloud STT',
        isAvailable: () => true,
        isConfigured: () => true,
        transcribe: async () => ({ text: 'নমস্কার', confidence: 0.95, isFinal: true })
      };
      router.registerProvider(mockGoogle);

      const decisionHindi = await router.route({ language: 'hi' });
      expect(decisionHindi.selectedProvider).toBe('google-cloud-stt');
      expect(decisionHindi.reason).toContain('Indic');

      const decisionBengali = await router.route({ language: 'bn' });
      expect(decisionBengali.selectedProvider).toBe('google-cloud-stt');
    });

    it('routes HIGH_ACCURACY mode to ElevenLabs Scribe or OpenAI Whisper', async () => {
      const router = new STTRouter();
      const mockWhisper: STTProvider = {
        id: 'openai-whisper',
        name: 'OpenAI Whisper',
        isAvailable: () => true,
        isConfigured: () => true,
        transcribe: async () => ({ text: 'transcribed text', confidence: 0.98, isFinal: true })
      };
      router.registerProvider(mockWhisper);

      const decision = await router.route({ qualityMode: 'HIGH_ACCURACY' });
      expect(decision.selectedProvider).toBe('openai-whisper');
      expect(decision.qualityMode).toBe('HIGH_ACCURACY');
    });

    it('falls back through chain if preferred online provider throws', async () => {
      const router = new STTRouter();
      const failingOnline: STTProvider = {
        id: 'elevenlabs-scribe',
        name: 'ElevenLabs Scribe',
        isAvailable: () => true,
        isConfigured: () => true,
        transcribe: async () => {
          throw new Error('API Rate Limit or Connection Error');
        }
      };
      const fallbackOnline: STTProvider = {
        id: 'openai-whisper',
        name: 'OpenAI Whisper',
        isAvailable: () => true,
        isConfigured: () => true,
        transcribe: async () => ({
          text: 'Successful fallback audio transcription',
          confidence: 0.95,
          isFinal: true
        })
      };

      router.registerProvider(failingOnline);
      router.registerProvider(fallbackOnline);

      const pcm = Buffer.alloc(3200);
      const result = await router.transcribe(pcm, { language: 'en', providerId: 'elevenlabs-scribe' });

      expect(result.text).toBe('Successful fallback audio transcription');
      expect(result.providerId).toBe('openai-whisper');
    });

    it('normalizes transcripts cleanly separating rawText and interpretedText', () => {
      const router = new STTRouter();
      const raw = 'hey megh open calculator please';
      const normalized = router.normalizeTranscript(raw);

      expect(normalized.rawText).toBe(raw);
      expect(normalized.interpretedText).toBe('Open Calculator');
    });
  });

  describe('Echo Suppression & VoiceInputManager', () => {
    it('discards audio frames when AudioOutputService is actively playing to prevent self-wake loops', async () => {
      const eventBus = new EventBus();
      const audioOutput = new AudioOutputService({ eventBus });
      const audioCapture = new AudioCaptureService({ mockCapture: true });
      const sttService = new SpeechRecognitionService();

      const manager = new VoiceInputManager({
        audioCapture,
        audioOutput,
        eventBus,
        speechRecognition: sttService
      });

      // Spy on wake detector's detectWakePhrase
      const detectSpy = vi.spyOn((manager as any).wakeDetector, 'detectWakePhrase');

      // Put audioOutput into playing state
      (audioOutput as any).state = 'PLAYING_TTS';
      expect(audioOutput.isPlaying()).toBe(true);

      // Send audio frame to manager
      const frameBuffer = Buffer.alloc(6400);
      manager.handleAudioFrame({
        timestamp: Date.now(),
        sampleRate: 16000,
        channels: 1,
        format: 'pcm_s16le',
        sequenceNumber: 1,
        durationMs: 200,
        data: frameBuffer,
        rms: 2000,
        peak: 5000,
        normalizedLevel: 0.15
      });

      // Frame should have been dropped by echo suppression — wake detector must NOT be called
      expect(detectSpy).not.toHaveBeenCalled();

      // Reset state to IDLE
      (audioOutput as any).state = 'IDLE';
      expect(audioOutput.isPlaying()).toBe(false);

      // Now send another frame
      manager.handleAudioFrame({
        timestamp: Date.now(),
        sampleRate: 16000,
        channels: 1,
        format: 'pcm_s16le',
        sequenceNumber: 2,
        durationMs: 200,
        data: frameBuffer,
        rms: 2000,
        peak: 5000,
        normalizedLevel: 0.15
      });

      // Now wake detector SHOULD be consulted (or buffer accumulated)
      // Echo suppression allows processing
      expect(audioOutput.isPlaying()).toBe(false);
    });
  });

  describe('Online Model Router & Failover', () => {
    it('truthfully handles NO_ONLINE_MODEL_CONFIGURED when no online keys exist', async () => {
      const router = new ModelRouter();

      // Temporarily strip test environment flag and cloud keys
      const origEnv = process.env['NODE_ENV'];
      process.env['NODE_ENV'] = 'production';
      const origGemini = process.env['GEMINI_API_KEY'];
      const origOpenAI = process.env['OPENAI_API_KEY'];
      delete process.env['GEMINI_API_KEY'];
      delete process.env['OPENAI_API_KEY'];

      try {
        const decision = await router.route({
          messages: [{ role: 'user', content: 'Hello' }]
        }, {
          routingMode: 'QUALITY',
          allowOfflineFallback: false
        });

        // When in production with no cloud keys, selectedProvider must truthfully be 'none'
        expect(decision.selectedProvider).toBe('none');
        expect(decision.routingReason).toContain('NO_ONLINE_MODEL_CONFIGURED');
      } finally {
        process.env['NODE_ENV'] = origEnv;
        if (origGemini) process.env['GEMINI_API_KEY'] = origGemini;
        if (origOpenAI) process.env['OPENAI_API_KEY'] = origOpenAI;
      }
    });

    it('performs graceful cross-provider fallback when primary online provider fails', async () => {
      const router = new ModelRouter();

      const mockGemini = {
        id: 'gemini' as const,
        name: 'Google Gemini',
        isConfigured: () => true,
        getModels: () => [{
          id: 'gemini-2.5-flash',
          providerId: 'gemini' as const,
          name: 'Gemini 2.5 Flash',
          isLocal: false,
          costPer1kInputTokensUSD: 0.000075,
          costPer1kOutputTokensUSD: 0.0003,
          capabilities: {} as any
        }],
        checkHealth: async () => ({ available: true, latencyMs: 50, isConfigured: true }),
        complete: async () => {
          throw new Error('Gemini API Error 503 Service Unavailable');
        }
      };

      const mockOpenAI = {
        id: 'openai' as const,
        name: 'OpenAI GPT-4o',
        isConfigured: () => true,
        getModels: () => [{
          id: 'gpt-4o',
          providerId: 'openai' as const,
          name: 'GPT-4o',
          isLocal: false,
          costPer1kInputTokensUSD: 0.0025,
          costPer1kOutputTokensUSD: 0.01,
          capabilities: {} as any
        }],
        checkHealth: async () => ({ available: true, latencyMs: 60, isConfigured: true }),
        complete: async () => ({
          content: 'Successful OpenAI fallback completion',
          providerId: 'openai' as const,
          modelId: 'gpt-4o',
          latencyMs: 120,
          tokensUsed: { promptTokens: 10, completionTokens: 12, totalTokens: 22 },
          finishReason: 'stop' as const
        })
      };

      router.registerProvider(mockGemini);
      router.registerProvider(mockOpenAI);

      const res = await router.completeWithFallback({
        messages: [{ role: 'user', content: 'Explain quantum computing' }],
        providerId: 'gemini'
      });

      expect(res.fallbackOccurred).toBe(true);
      expect(res.content).toBe('Successful OpenAI fallback completion');
      expect(res.providerId).toBe('openai');
    });
  });

  describe('Multi-Voice Catalog & OpenAI Speech', () => {
    it('registers OpenAI TTS voices in VoiceCatalogService seed and refresh catalog', async () => {
      const catalog = new VoiceCatalogService();
      const voices = catalog.listVoices();

      const openaiVoices = voices.filter(v => v.provider === 'openai');
      expect(openaiVoices.length).toBeGreaterThanOrEqual(6);
      expect(openaiVoices.some(v => v.id === 'openai-alloy')).toBe(true);
      expect(openaiVoices.some(v => v.id === 'openai-nova')).toBe(true);
      expect(openaiVoices.some(v => v.id === 'openai-shimmer')).toBe(true);
    });
  });

  describe('BYOK Credential Persistence', () => {
    it('persists and loads API credentials from disk', () => {
      const credsPath = path.join(tempDir, 'credentials.json');
      saveProviderCredential('openai', 'sk-test-openai-credential', credsPath);
      saveProviderCredential('elevenlabs', 'eleven-test-key-999', credsPath);

      const loaded = loadStoredCredentials(credsPath);
      expect(loaded['openai']).toBe('sk-test-openai-credential');
      expect(loaded['elevenlabs']).toBe('eleven-test-key-999');
    });
  });

  describe('Wake Phrase Sanitization (stripWakePhrase)', () => {
    it('strips "Hey Megh" prefix cleanly with varied punctuation', () => {
      expect(stripWakePhrase('Hey Megh, what time is it?').cleaned).toBe('what time is it?');
      expect(stripWakePhrase('Hey Megh, what time is it?').wakeStripped).toBe(true);
      expect(stripWakePhrase('Hey Megh: turn on dark mode').cleaned).toBe('turn on dark mode');
      expect(stripWakePhrase('hey megh open calendar').cleaned).toBe('open calendar');
      expect(stripWakePhrase('HEY MEGH! write an email').cleaned).toBe('write an email');
    });

    it('strips bare "Megh" prefix cleanly', () => {
      expect(stripWakePhrase('Megh, list my notes').cleaned).toBe('list my notes');
      expect(stripWakePhrase('megh summarize the brief').cleaned).toBe('summarize the brief');
      expect(stripWakePhrase('Megh, list my notes').wakeStripped).toBe(true);
    });

    it('preserves clean commands without wake phrases intact', () => {
      expect(stripWakePhrase('what is quantum computing?').cleaned).toBe('what is quantum computing?');
      expect(stripWakePhrase('what is quantum computing?').wakeStripped).toBe(false);
      expect(stripWakePhrase('open calculator').cleaned).toBe('open calculator');
    });

    it('returns empty string if utterance contains only wake phrase', () => {
      expect(stripWakePhrase('Hey Megh').cleaned).toBe('');
      expect(stripWakePhrase('Hey Megh').wakeStripped).toBe(true);
      expect(stripWakePhrase('Megh,').cleaned).toBe('');
      expect(stripWakePhrase('Megh,').wakeStripped).toBe(true);
    });
  });

  describe('Online-First Realtime STT Enforcement', () => {
    it('returns NO_ONLINE_STT_CONFIGURED when no online STT credentials are present and never falls back to Windows Dictation', async () => {
      const origEleven = process.env['ELEVENLABS_API_KEY'];
      const origGoogle = process.env['GOOGLE_APPLICATION_CREDENTIALS'];
      const origGoogleKey = process.env['GOOGLE_CLOUD_API_KEY'];
      const origOpenAI = process.env['OPENAI_API_KEY'];

      delete process.env['ELEVENLABS_API_KEY'];
      delete process.env['GOOGLE_APPLICATION_CREDENTIALS'];
      delete process.env['GOOGLE_CLOUD_API_KEY'];
      delete process.env['OPENAI_API_KEY'];

      try {
        const dummyCredsPath = path.join(tempDir, 'empty-creds.json');
        fs.writeFileSync(dummyCredsPath, JSON.stringify({}), 'utf-8');

        const sttRouter = new STTRouter();
        const dummyWav = Buffer.alloc(1600);

        const decision = await sttRouter.route({});
        expect(decision.selectedProvider).toBe('none');
        expect(decision.reason).toContain('NO_ONLINE_STT_CONFIGURED');
        expect(decision.fallbackChain).not.toContain('windows_dictation');

        await expect(sttRouter.transcribe(dummyWav)).rejects.toThrow(/NO_ONLINE_STT_CONFIGURED/);
      } finally {
        if (origEleven) process.env['ELEVENLABS_API_KEY'] = origEleven;
        if (origGoogle) process.env['GOOGLE_APPLICATION_CREDENTIALS'] = origGoogle;
        if (origGoogleKey) process.env['GOOGLE_CLOUD_API_KEY'] = origGoogleKey;
        if (origOpenAI) process.env['OPENAI_API_KEY'] = origOpenAI;
      }
    });
  });
});
