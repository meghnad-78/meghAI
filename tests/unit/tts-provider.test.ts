import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import {
  WindowsSapiTTSProvider,
  AudioPlaybackService,
  VoiceCatalog,
  VoiceSettingsManager
} from '../../packages/voice/src/index';
import { MeghAIServer } from '../../apps/api/src/server';
import { KillSwitch } from '../../packages/security/src/index';

describe('Real Windows TTS Provider & Audio Playback Subsystem', () => {
  let ttsProvider: WindowsSapiTTSProvider;
  let audioService: AudioPlaybackService;

  beforeEach(() => {
    KillSwitch.reset();
    ttsProvider = new WindowsSapiTTSProvider();
    audioService = new AudioPlaybackService();
  });

  afterEach(() => {
    audioService.stop('Test complete cleanup');
    KillSwitch.reset();
  });

  describe('WindowsSapiTTSProvider', () => {
    it('enumerates real installed Windows voices', async () => {
      const voices = await ttsProvider.listVoices();
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);

      // Verify structure of discovered voices
      for (const voice of voices) {
        expect(voice.id).toBeDefined();
        expect(voice.id.startsWith('local-')).toBe(true);
        expect(voice.name).toBeDefined();
        expect(voice.provider).toBe('local');
        expect(voice.language).toBeDefined();
        expect(['female', 'male', 'neutral']).toContain(voice.gender);
        expect(voice.isAvailable).toBe(true);
      }
    });

    it('rejects synthesis with empty or whitespace-only text', async () => {
      await expect(ttsProvider.synthesize('')).rejects.toThrow('TTS synthesis text cannot be empty');
      await expect(ttsProvider.synthesize('   ')).rejects.toThrow('TTS synthesis text cannot be empty');
    });

    it('synthesizes real WAV audio data with audioBuffer and base64', async () => {
      const result = await ttsProvider.synthesize('MeghAI audio synthesis test.', {
        speechRate: 1.0,
        volume: 0.8
      });

      expect(result).toBeDefined();
      expect(result.format).toBe('wav');
      expect(result.voiceId).toBeDefined();
      expect(result.spokenText).toBe('MeghAI audio synthesis test.');
      expect(result.audioFilePath).toBeDefined();
      expect(fs.existsSync(result.audioFilePath!)).toBe(true);
      expect(result.audioBuffer).toBeDefined();
      expect(result.audioBuffer!.length).toBeGreaterThan(100);
      expect(result.audioBase64).toBeDefined();
      expect(result.audioBase64!.length).toBeGreaterThan(100);
      expect(result.durationMs).toBeGreaterThan(0);

      // Clean up file
      if (fs.existsSync(result.audioFilePath!)) {
        try { fs.unlinkSync(result.audioFilePath!); } catch {}
      }
    }, 15000);

    it('respects requested voiceId when synthesizing', async () => {
      const voices = await ttsProvider.listVoices();
      const targetVoice = voices[0];

      const result = await ttsProvider.synthesize('Testing voice selection.', {
        voiceId: targetVoice.id
      });

      expect(result.voiceId).toBe(targetVoice.id);
      if (fs.existsSync(result.audioFilePath!)) {
        try { fs.unlinkSync(result.audioFilePath!); } catch {}
      }
    });
  });

  describe('AudioPlaybackService', () => {
    it('manages status correctly before, during, and after playback', async () => {
      const statusInitial = audioService.getStatus();
      expect(statusInitial.isPlaying).toBe(false);
      expect(audioService.isPlaying()).toBe(false);

      // Synthesize a quick sound
      const synthesis = await ttsProvider.synthesize('Hello world');

      // Start playback (in background)
      const playPromise = audioService.play(synthesis);
      expect(audioService.isPlaying()).toBe(true);

      const statusDuring = audioService.getStatus();
      expect(statusDuring.isPlaying).toBe(true);

      // Wait for playback or stop it
      const stopped = audioService.stop('Stopping test');
      expect(stopped).toBe(true);
      expect(audioService.isPlaying()).toBe(false);

      await playPromise;

      if (fs.existsSync(synthesis.audioFilePath!)) {
        try { fs.unlinkSync(synthesis.audioFilePath!); } catch {}
      }
    });

    it('triggers onStop callback when cancelled', async () => {
      let stopReason = '';
      audioService.onStop((reason) => {
        stopReason = reason;
      });

      const synthesis = await ttsProvider.synthesize('Cancellation test');
      const playPromise = audioService.play(synthesis);

      audioService.stop('Manual cancellation');
      expect(stopReason).toBe('Manual cancellation');

      await playPromise;

      if (fs.existsSync(synthesis.audioFilePath!)) {
        try { fs.unlinkSync(synthesis.audioFilePath!); } catch {}
      }
    });
  });

  describe('VoiceSettingsManager with autoSpeak', () => {
    it('defaults autoSpeak to ON and allows toggling to OFF and ASK', () => {
      const manager = new VoiceSettingsManager({ autoSpeak: 'ON' });
      expect(manager.getSettings().autoSpeak).toBe('ON');

      manager.updateSettings({ autoSpeak: 'OFF' });
      expect(manager.getSettings().autoSpeak).toBe('OFF');

      manager.updateSettings({ autoSpeak: 'ASK' });
      expect(manager.getSettings().autoSpeak).toBe('ASK');
    });
  });

  describe('VoiceCatalog with Real Installed Voices', () => {
    it('exposes real voices across providers without synthetic loops', async () => {
      const catalog = new VoiceCatalog();
      const initialCount = catalog.listVoices().length;

      // 100+ multi-provider real catalog
      expect(initialCount).toBeGreaterThanOrEqual(100);

      await catalog.refreshFromProvider(ttsProvider);
      const refreshedVoices = catalog.listVoices();
      expect(refreshedVoices.length).toBeGreaterThan(0);
      expect(refreshedVoices.some(v => v.provider === 'local')).toBe(true);
    });
  });

  describe('Server Voice API Endpoints Integration', () => {
    let server: MeghAIServer;
    let serverPort: number;

    beforeEach(async () => {
      server = new MeghAIServer();
      serverPort = await server.start(0);
    });

    afterEach(async () => {
      server.audioPlayback.stop('Server teardown');
      await server.stop();
    });

    it('POST /api/v1/voice/preview synthesizes real audio and returns audio payload', async () => {
      const res = await fetch(`http://localhost:${serverPort}/api/v1/voice/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'MeghAI server preview integration test.',
          play: false // Do not hold the test on speakers
        })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.status).toBe('SYNTHESIZED_AND_PLAYED');
      expect(data.text).toContain('MeghAI server preview integration test.');
      expect(data.audioBase64).toBeDefined();
      expect(data.audioBase64.length).toBeGreaterThan(100);
      expect(data.durationMs).toBeGreaterThan(0);
    });

    it('POST /api/v1/voice/stop cancels active speech', async () => {
      const res = await fetch(`http://localhost:${serverPort}/api/v1/voice/stop`, {
        method: 'POST'
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.success).toBe(true);
      expect(data.aiState).toBe('READY');
    });

    it('GET /api/v1/voice/status returns current playback status', async () => {
      server.audioPlayback.stop('Initial test setup');
      const res = await fetch(`http://localhost:${serverPort}/api/v1/voice/status`);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.isPlaying).toBe(false);
    });

    it('emergency kill switch immediately halts audio playback', async () => {
      const synthesis = await server.ttsProvider.synthesize('Emergency kill switch audio termination verification.');
      const playPromise = server.audioPlayback.play(synthesis);
      expect(server.audioPlayback.isPlaying()).toBe(true);

      // Trigger Emergency Kill Switch via HTTP
      const killRes = await fetch(`http://localhost:${serverPort}/api/v1/system/kill`, {
        method: 'POST'
      });

      expect(killRes.status).toBe(200);
      const killData = await killRes.json() as any;
      expect(killData.success).toBe(true);

      // Verify audio playback was immediately stopped
      expect(server.audioPlayback.isPlaying()).toBe(false);

      await playPromise;

      // Reset kill switch for subsequent tests
      await fetch(`http://localhost:${serverPort}/api/v1/system/reset-kill`, {
        method: 'POST'
      });

      if (fs.existsSync(synthesis.audioFilePath!)) {
        try { fs.unlinkSync(synthesis.audioFilePath!); } catch {}
      }
    }, 20000);

    it('text chat returns normal response without speech when autoSpeak is OFF', async () => {
      server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });
      server.audioPlayback.stop('Clear startup chime');

      const res = await fetch(`http://localhost:${serverPort}/api/v1/input/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'create a note titled TTSNote with content verify silent mode' })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.status).toBe('COMPLETED');
      expect(data.reply).toBeDefined();
      expect(server.audioPlayback.isPlaying()).toBe(false);
    }, 20000);

    it('processes speech output when autoSpeak is ON', async () => {
      server.voiceSettings.updateSettings({ autoSpeak: 'ON' });

      // Track timeline events for TTS
      const events: string[] = [];
      server.eventBus.subscribe('*', (evt) => {
        events.push(evt.type);
      });

      const res = await fetch(`http://localhost:${serverPort}/api/v1/input/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'create a note titled VoiceNote with content verify speech output' })
      });

      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.status).toBe('COMPLETED');

      // Allow background speech to trigger
      await new Promise(r => setTimeout(r, 500));
      expect(events).toContain('TTS_STARTED');

      // Stop speech
      server.audioPlayback.stop('Finished test');
    }, 20000);
  });
});
