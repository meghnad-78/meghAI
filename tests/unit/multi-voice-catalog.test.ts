import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  VoiceCatalogService,
  WindowsOneCoreTTSProvider,
  WindowsSapiTTSProvider,
  GoogleCloudTTSProvider,
  ElevenLabsTTSProvider,
  AudioCueService,
  AudioOutputService,
  VoiceSettingsManager
} from '../../packages/voice/src/index';
import { KillSwitch } from '../../packages/security/src/index';

describe('MeghAI Multi-Provider Voice Catalog & Audio Cue System', () => {
  let catalogService: VoiceCatalogService;
  let outputService: AudioOutputService;

  beforeEach(async () => {
    KillSwitch.reset();
    catalogService = new VoiceCatalogService();
    await catalogService.initialize();
    outputService = new AudioOutputService();
  });

  afterEach(() => {
    outputService.stop('Test cleanup');
    KillSwitch.reset();
  });

  describe('VoiceCatalogService (100+ Voice Multi-Provider Catalog)', () => {
    it('aggregates 100+ distinct voices across all 4 providers', async () => {
      const allVoices = await catalogService.listVoices();
      expect(allVoices.length).toBeGreaterThanOrEqual(100);

      const stats = await catalogService.getStats();
      expect(stats.totalVoices).toBeGreaterThanOrEqual(101);
      expect(stats.totalOfflineReady).toBe(11); // 3 SAPI + 8 OneCore
      expect(stats.totalCloud).toBeGreaterThanOrEqual(90);        // 44 Google + 46 ElevenLabs (+ 6 OpenAI)
      expect(stats.providers['windows-sapi'].total).toBe(3);
      expect(stats.providers['windows-onecore'].total).toBe(8);
      expect(stats.providers['google-cloud-tts'].total).toBe(44);
      expect(stats.providers['elevenlabs'].total).toBe(46);
    });

    it('truthfully tags availability based on offline readiness and API keys', async () => {
      const allVoices = await catalogService.listVoices();
      
      // All local Windows voices must be available offline
      const localVoices = allVoices.filter(v => v.provider === 'windows-sapi' || v.provider === 'windows-onecore');
      for (const v of localVoices) {
        expect(v.isAvailable).toBe(true);
        expect(v.available).toBe(true);
      }

      // Available only filter returns only available voices
      const availableVoices = await catalogService.listVoices({ availableOnly: true });
      expect(availableVoices.length).toBeGreaterThanOrEqual(11);
      for (const v of availableVoices) {
        expect(v.available).toBe(true);
      }
    });

    it('filters voices by provider', async () => {
      const oneCoreVoices = await catalogService.listVoices({ provider: 'windows-onecore' });
      expect(oneCoreVoices.length).toBe(8);
      expect(oneCoreVoices.every(v => v.provider === 'windows-onecore')).toBe(true);

      const googleVoices = await catalogService.listVoices({ provider: 'google-cloud-tts' });
      expect(googleVoices.length).toBe(44);
      expect(googleVoices.every(v => v.provider === 'google-cloud')).toBe(true);

      const elevenVoices = await catalogService.listVoices({ provider: 'elevenlabs' });
      expect(elevenVoices.length).toBe(46);
      expect(elevenVoices.every(v => v.provider === 'elevenlabs')).toBe(true);
    });

    it('filters voices by language and naturalness', async () => {
      const hindiVoices = await catalogService.listVoices({ language: 'hi' });
      expect(hindiVoices.length).toBeGreaterThan(0);
      expect(hindiVoices.every(v => v.language.startsWith('hi'))).toBe(true);

      const studioVoices = await catalogService.listVoices({ naturalness: 'studio' });
      expect(studioVoices.length).toBeGreaterThan(0);
      expect(studioVoices.every(v => v.naturalness === 'studio')).toBe(true);

      const generativeVoices = await catalogService.listVoices({ naturalness: 'generative' });
      expect(generativeVoices.length).toBe(49); // 46 ElevenLabs + 3 Google Journey
      expect(generativeVoices.every(v => v.naturalness === 'generative')).toBe(true);
    });

    it('looks up individual voice profiles correctly', async () => {
      const heera = await catalogService.getVoice('onecore-heera');
      expect(heera).toBeDefined();
      expect(heera?.name).toContain('Heera');
      expect(heera?.provider).toBe('windows-onecore');

      const nonExistent = await catalogService.getVoice('unknown-voice-id');
      expect(nonExistent).toBeUndefined();
    });

    it('routes synthesis to local provider and falls back gracefully', async () => {
      const res = await catalogService.synthesize('Fallback test message', {
        voiceId: 'onecore-heera'
      });
      expect(res).toBeDefined();
      expect(res.audioBuffer).toBeDefined();
      expect(res.audioBuffer!.length).toBeGreaterThan(100);
      expect(res.format).toBe('wav');
    }, 15000);
  });

  describe('WindowsOneCoreTTSProvider (WinRT SpeechSynthesizer)', () => {
    let onecore: WindowsOneCoreTTSProvider;

    beforeEach(() => {
      onecore = new WindowsOneCoreTTSProvider();
    });

    it('lists 8 verified installed OneCore voices on Windows', async () => {
      const voices = await onecore.listVoices();
      expect(voices.length).toBe(8);

      const names = voices.map(v => v.name);
      expect(names).toContain('Microsoft Heera');
      expect(names).toContain('Microsoft Ravi');
      expect(names).toContain('Microsoft David');
      expect(names).toContain('Microsoft Zira');

      for (const v of voices) {
        expect(v.provider).toBe('windows-onecore');
        expect(v.isAvailable).toBe(true);
        expect(v.naturalness).toBe('neural');
      }
    });

    it('isAvailable returns true on this Windows system', async () => {
      const avail = await onecore.isAvailable();
      expect(avail).toBe(true);
    });

    it('synthesizes real 16kHz PCM WAV audio via OneCore PowerShell script', async () => {
      const res = await onecore.synthesize('OneCore synthesis unit test.', {
        voiceId: 'onecore-heera'
      });
      expect(res).toBeDefined();
      expect(res.format).toBe('wav');
      expect(res.sampleRate).toBe(16000);
      expect(res.audioBuffer).toBeDefined();
      expect(res.audioBuffer!.length).toBeGreaterThan(100);
      expect(res.audioFilePath).toBeDefined();
      expect(fs.existsSync(res.audioFilePath!)).toBe(true);

      // Verify RIFF header
      const riff = res.audioBuffer!.slice(0, 4).toString('ascii');
      const wave = res.audioBuffer!.slice(8, 12).toString('ascii');
      expect(riff).toBe('RIFF');
      expect(wave).toBe('WAVE');

      // Cleanup
      try { fs.unlinkSync(res.audioFilePath!); } catch {}
    }, 15000);
  });

  describe('AudioCueService (Procedural Offline PCM Cues)', () => {
    const cueTypes = ['startup', 'listening', 'thinking', 'answer_ready', 'interrupt'] as const;

    for (const cue of cueTypes) {
      it(`generates valid 16-bit PCM RIFF WAV buffer for "${cue}" cue`, () => {
        const wavBuffer = AudioCueService.getCueBuffer(cue);
        expect(wavBuffer).toBeDefined();
        expect(wavBuffer.length).toBeGreaterThan(44); // Greater than standard WAV header size

        // Validate RIFF header
        expect(wavBuffer.slice(0, 4).toString('ascii')).toBe('RIFF');
        expect(wavBuffer.slice(8, 12).toString('ascii')).toBe('WAVE');
        expect(wavBuffer.slice(12, 16).toString('ascii')).toBe('fmt ');

        // Validate audio format: 1 (PCM), channels: 1 (mono)
        const audioFormat = wavBuffer.readUInt16LE(20);
        const channels = wavBuffer.readUInt16LE(22);
        const sampleRate = wavBuffer.readUInt32LE(24);
        const bitsPerSample = wavBuffer.readUInt16LE(34);

        expect(audioFormat).toBe(1); // Linear PCM
        expect(channels).toBe(1);    // Mono
        expect(sampleRate).toBe(22050); // 22.05kHz procedural rate
        expect(bitsPerSample).toBe(16); // 16-bit
      });
    }

    it('creates temporary cue file on disk and returns valid path', async () => {
      const filePath = await AudioCueService.getCueFilePath('answer_ready');
      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath.endsWith('.wav')).toBe(true);
    });
  });

  describe('AudioOutputService (Sound Controller & Thinking Loop)', () => {
    it('manages output state transition across cues and TTS', async () => {
      expect(outputService.getState()).toBe('IDLE');
      expect(outputService.isPlaying()).toBe(false);

      const status = outputService.getStatus();
      expect(status.state).toBe('IDLE');
      expect(status.isPlaying).toBe(false);
    });

    it('starts and stops thinking loop without errors', async () => {
      outputService.startThinkingLoop();
      expect(outputService.isThinkingLoopActive()).toBe(true);

      outputService.stopThinkingLoop();
      expect(outputService.isThinkingLoopActive()).toBe(false);
    });

    it('halts all playback and cues when emergency stop is triggered', async () => {
      outputService.startThinkingLoop();
      outputService.stop('Emergency kill switch');

      expect(outputService.getState()).toBe('IDLE');
      expect(outputService.isPlaying()).toBe(false);
      expect(outputService.isThinkingLoopActive()).toBe(false);
    });
  });

  describe('VoiceSettingsManager (Persistence & Default ON)', () => {
    const testSettingsPath = path.join(os.tmpdir(), `meghai-test-settings-${Date.now()}.json`);

    afterEach(() => {
      try {
        if (fs.existsSync(testSettingsPath)) fs.unlinkSync(testSettingsPath);
      } catch {}
    });

    it('defaults autoSpeak to ON and selectedVoiceId to onecore-heera', () => {
      const manager = new VoiceSettingsManager({}, testSettingsPath);
      const settings = manager.getSettings();

      expect(settings.autoSpeak).toBe('ON');
      expect(settings.selectedVoiceId).toBe('onecore-heera');
      expect(settings.speechRate).toBe(1.0);
      expect(settings.pitch).toBe(1.0);
      expect(settings.volume).toBe(1.0);
    });

    it('updates settings and persists across instance reload', () => {
      const manager1 = new VoiceSettingsManager({}, testSettingsPath);
      manager1.updateSettings({
        autoSpeak: 'OFF',
        selectedVoiceId: 'onecore-ravi',
        speechRate: 1.15
      });

      const updated = manager1.getSettings();
      expect(updated.autoSpeak).toBe('OFF');
      expect(updated.selectedVoiceId).toBe('onecore-ravi');
      expect(updated.speechRate).toBe(1.15);

      // Create new instance which reloads from testSettingsPath
      const manager2 = new VoiceSettingsManager({}, testSettingsPath);
      const reloaded = manager2.getSettings();
      expect(reloaded.autoSpeak).toBe('OFF');
      expect(reloaded.selectedVoiceId).toBe('onecore-ravi');
      expect(reloaded.speechRate).toBe(1.15);
    });
  });
});
