import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  VoiceCatalogService,
  VoiceSettingsManager,
  WindowsOneCoreTTSProvider,
  WindowsSapiTTSProvider,
  OpenAITTSProvider,
  ElevenLabsTTSProvider,
  GoogleCloudTTSProvider
} from '../../packages/voice/src/index.js';
import {
  PersonalityManager,
  BUILTIN_PERSONALITIES
} from '../../packages/ai-core/src/personality.js';
import {
  ModelSettingsManager
} from '../../packages/config/src/index.js';

describe('Voice Studio & AI Personality Production Suite', () => {
  let tempDir: string;
  let voiceSettingsPath: string;
  let modelSettingsPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meghai-voice-test-'));
    voiceSettingsPath = path.join(tempDir, 'voice-settings.json');
    modelSettingsPath = path.join(tempDir, 'model-settings.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Accurate & Truthful Voice Catalog Counts', () => {
    it('aggregates exactly 107 real provider-accessible voices across all 5 providers', () => {
      const catalog = new VoiceCatalogService();
      const allVoices = catalog.listVoices();

      expect(allVoices.length).toBe(107);
    });

    it('reports truthful stats with strictly separated offline-ready and cloud-key voices', () => {
      const catalog = new VoiceCatalogService();
      const stats = catalog.getStats();

      expect(stats.total).toBe(107);
      expect(stats.totalVoices).toBe(107);
      expect(stats.totalOfflineReady).toBe(11); // 8 OneCore + 3 SAPI
      expect(stats.totalCloud).toBe(96);        // 44 Google + 46 ElevenLabs + 6 OpenAI

      // Without cloud API keys set in test environment, exactly 11 voices are available
      expect(stats.available).toBe(11);
      expect(stats.totalAvailable).toBe(11);
      // It must NOT falsely advertise "100+ voices available"
      expect(stats.available).toBeLessThan(stats.total);
    });

    it('contains exact provider breakdown', () => {
      const catalog = new VoiceCatalogService();
      const oneCoreVoices = catalog.listVoices({ provider: 'windows-onecore' });
      const sapiVoices = catalog.listVoices({ provider: 'windows-sapi' });
      const googleVoices = catalog.listVoices({ provider: 'google-cloud' });
      const elevenVoices = catalog.listVoices({ provider: 'elevenlabs' });
      const openaiVoices = catalog.listVoices({ provider: 'openai' });

      expect(oneCoreVoices.length).toBe(8);
      expect(sapiVoices.length).toBe(3);
      expect(googleVoices.length).toBe(44);
      expect(elevenVoices.length).toBe(46);
      expect(openaiVoices.length).toBe(6);
      expect(oneCoreVoices.length + sapiVoices.length + googleVoices.length + elevenVoices.length + openaiVoices.length).toBe(107);
    });
  });

  describe('2. Provider Capabilities, Controls & Characteristics Truthfulness', () => {
    it('Windows OneCore supports speed and pitch controls, and includes characteristics', async () => {
      const provider = new WindowsOneCoreTTSProvider();
      const voices = await provider.listVoices();
      expect(voices.length).toBe(8);

      for (const v of voices) {
        expect(v.supportedControls).toEqual(expect.arrayContaining(['speed', 'pitch']));
        expect(v.supportedControls).not.toContain('stability');
        expect(v.providerVoiceId).toBeDefined();
        expect(v.characteristics).toBeDefined();
        expect(v.characteristics!.length).toBeGreaterThan(0);
      }
    });

    it('Windows SAPI supports only speed control (no pitch/stability)', async () => {
      const provider = new WindowsSapiTTSProvider();
      const voices = await provider.listVoices();
      expect(voices.length).toBe(3);

      for (const v of voices) {
        expect(v.supportedControls).toEqual(['speed']);
        expect(v.supportedControls).not.toContain('pitch');
        expect(v.supportedControls).not.toContain('stability');
        expect(v.characteristics).toBeDefined();
        expect(v.characteristics!.length).toBeGreaterThan(0);
      }
    });

    it('Google Cloud supports speed and pitch controls', async () => {
      const provider = new GoogleCloudTTSProvider();
      const voices = await provider.listVoices();
      expect(voices.length).toBe(44);

      for (const v of voices) {
        expect(v.supportedControls).toEqual(expect.arrayContaining(['speed', 'pitch']));
        expect(v.supportedControls).not.toContain('stability');
        expect(v.providerVoiceId).toBeDefined();
        expect(v.characteristics).toBeDefined();
        expect(v.characteristics!.length).toBeGreaterThan(0);
      }
    });

    it('ElevenLabs supports speed, stability, similarity, style (pitch unsupported)', async () => {
      const provider = new ElevenLabsTTSProvider();
      const voices = await provider.listVoices();
      expect(voices.length).toBe(46);

      for (const v of voices) {
        expect(v.supportedControls).toEqual(expect.arrayContaining(['speed', 'stability', 'similarity', 'style']));
        expect(v.supportedControls).not.toContain('pitch');
        expect(v.providerVoiceId).toBeDefined();
        expect(v.characteristics).toBeDefined();
        expect(v.characteristics!.length).toBeGreaterThan(0);
      }
    });

    it('OpenAI Speech supports only speed control (pitch, stability unsupported)', async () => {
      const provider = new OpenAITTSProvider();
      const voices = await provider.listVoices();
      expect(voices.length).toBe(6);

      for (const v of voices) {
        expect(v.supportedControls).toEqual(['speed']);
        expect(v.supportedControls).not.toContain('pitch');
        expect(v.supportedControls).not.toContain('stability');
        expect(v.providerVoiceId).toBeDefined();
        expect(v.characteristics).toBeDefined();
        expect(v.characteristics!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('3. Deepened 12 AI Personalities with Concrete Behavioral Constraints', () => {
    it('defines exactly 12 distinct personality profiles', () => {
      const manager = new PersonalityManager();
      const profiles = manager.listProfiles();
      expect(profiles.length).toBe(12);
      expect(BUILTIN_PERSONALITIES.length).toBe(12);
    });

    it('enforces behavioral constraints, tone, and formatting preferences on every profile', () => {
      const manager = new PersonalityManager();
      const profiles = manager.listProfiles();

      const validVisualStyles = [
        'precise',
        'soft',
        'orbital',
        'breathing',
        'technical',
        'network',
        'dynamic',
        'minimal'
      ];

      for (const p of profiles) {
        expect(p.id).toBeTruthy();
        expect(p.name).toBeTruthy();
        expect(p.description).toBeTruthy();
        expect(p.systemInstruction).toBeTruthy();
        expect(p.systemInstruction.length).toBeGreaterThan(30);

        // Constraints and parameters
        expect(p.tone).toBeTruthy();
        expect(p.verbosity).toBeTruthy();
        expect(p.humorLevel).toBeTruthy();
        expect(p.initiativeLevel).toBeTruthy();
        expect(p.technicalDepth).toBeTruthy();

        // Suggested voices and characteristics
        expect(p.suggestedVoiceCharacteristics).toBeDefined();
        expect(p.suggestedVoiceCharacteristics!.length).toBeGreaterThan(0);
        expect(p.suggestedVoiceIds).toBeDefined();
        expect(p.suggestedVoiceIds!.length).toBeGreaterThan(0);

        // Visual styles supported by AICore
        expect(validVisualStyles).toContain(p.visualStyle);
      }
    });

    it('builds comprehensive personality system prompt with behavioral rules', () => {
      const manager = new PersonalityManager();
      manager.setPersonality('minimalist');

      const fullPrompt = manager.buildSystemPrompt();
      expect(fullPrompt).toContain('MINIMALIST');
      expect(fullPrompt).toContain('signal-to-noise ratio');
      expect(fullPrompt).toContain('Zero filler');
    });

    it('provides accurate personality telemetry', () => {
      const manager = new PersonalityManager();
      manager.setPersonality('coding_partner');

      const telemetry = manager.getTelemetry();
      expect(telemetry.activePersonalityId).toBe('coding_partner');
      expect(telemetry.activeProfile.name).toBe('Coding Partner');
      expect(telemetry.activeProfile.visualStyle).toBe('precise');
      expect(telemetry.activeProfile.tone).toContain('Analytical');
      expect(telemetry.activeProfile.verbosity).toBe('comprehensive');
      expect(telemetry.activeProfile.suggestedVoiceIds).toContain('onecore-heera');
      expect(telemetry.totalProfiles).toBe(12);
    });
  });

  describe('4. Strict Triple Independence (Model, Voice, Personality)', () => {
    it('switching model does not modify voice or personality', () => {
      const voiceMgr = new VoiceSettingsManager({ selectedVoiceId: 'onecore-heera' }, voiceSettingsPath);
      const modelMgr = new ModelSettingsManager(modelSettingsPath);
      const personalityMgr = new PersonalityManager();

      personalityMgr.setPersonality('research_analyst');
      expect(personalityMgr.getActivePersonalityId()).toBe('research_analyst');

      // Update model
      modelMgr.updateSettings({ selectedProvider: 'gemini', selectedModel: 'gemini-3.8-flash' });
      expect(modelMgr.getSettings().selectedProvider).toBe('gemini');

      // Voice and personality remain completely unchanged
      expect(voiceMgr.getSettings().selectedVoiceId).toBe('onecore-heera');
      expect(personalityMgr.getActivePersonalityId()).toBe('research_analyst');
    });

    it('switching voice does not modify model or personality', () => {
      const voiceMgr = new VoiceSettingsManager({ selectedVoiceId: 'onecore-heera' }, voiceSettingsPath);
      const modelMgr = new ModelSettingsManager(modelSettingsPath);
      const personalityMgr = new PersonalityManager();

      modelMgr.updateSettings({ selectedProvider: 'local-ollama', selectedModel: 'llama3.2:latest' });
      personalityMgr.setPersonality('warm');

      // Update voice
      voiceMgr.updateSettings({ selectedVoiceId: 'onecore-zira', speechRate: 1.1 });
      expect(voiceMgr.getSettings().selectedVoiceId).toBe('onecore-zira');
      expect(voiceMgr.getSettings().speechRate).toBe(1.1);

      // Model and personality remain completely unchanged
      expect(modelMgr.getSettings().selectedProvider).toBe('local-ollama');
      expect(modelMgr.getSettings().selectedModel).toBe('llama3.2:latest');
      expect(personalityMgr.getActivePersonalityId()).toBe('warm');
    });

    it('switching personality does not modify voice or model', () => {
      const voiceMgr = new VoiceSettingsManager({ selectedVoiceId: 'onecore-mark' }, voiceSettingsPath);
      const modelMgr = new ModelSettingsManager(modelSettingsPath);
      const personalityMgr = new PersonalityManager();

      modelMgr.updateSettings({ selectedProvider: 'openai', selectedModel: 'gpt-4o' });

      // Update personality
      personalityMgr.setPersonality('creative_partner');
      expect(personalityMgr.getActivePersonalityId()).toBe('creative_partner');

      // Model and voice remain completely unchanged
      expect(modelMgr.getSettings().selectedProvider).toBe('openai');
      expect(modelMgr.getSettings().selectedModel).toBe('gpt-4o');
      expect(voiceMgr.getSettings().selectedVoiceId).toBe('onecore-mark');
    });

    it('persists voice settings across restarts independently', () => {
      const voiceMgr1 = new VoiceSettingsManager(
        { selectedVoiceId: 'onecore-ravi', speechRate: 1.25, pitch: 0.9, volume: 0.85, autoSpeak: 'ASK' },
        voiceSettingsPath
      );
      voiceMgr1.updateSettings({ selectedVoiceId: 'onecore-ravi' });

      // Load new instance from disk
      const voiceMgr2 = new VoiceSettingsManager({}, voiceSettingsPath);
      const loaded = voiceMgr2.getSettings();

      expect(loaded.selectedVoiceId).toBe('onecore-ravi');
      expect(loaded.speechRate).toBe(1.25);
      expect(loaded.pitch).toBe(0.9);
      expect(loaded.volume).toBe(0.85);
      expect(loaded.autoSpeak).toBe('ASK');
    });
  });
});
