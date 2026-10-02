import { describe, it, expect } from 'vitest';
import {
  VoiceCatalog,
  VoiceSettingsManager,
  PersonalityStudio
} from '@meghai/voice';

describe('Voice & Personality Studio (Section 69, 70, 98)', () => {
  it('should manage voice settings with pitch, speed, volume, and personality mode', () => {
    const manager = new VoiceSettingsManager({
      selectedVoiceId: 'local-david',
      speechRate: 1.0,
      pitch: 1.0,
      volume: 0.9,
      personalityMode: 'FUTURISTIC_COMPANION'
    });

    const initial = manager.getSettings();
    expect(initial.selectedVoiceId).toBe('local-david');
    expect(initial.speechRate).toBe(1.0);
    expect(initial.personalityMode).toBe('FUTURISTIC_COMPANION');

    // Update settings
    const updated = manager.updateSettings({
      speechRate: 1.25,
      pitch: 0.9,
      personalityMode: 'WARM'
    });

    expect(updated.speechRate).toBe(1.25);
    expect(updated.pitch).toBe(0.9);
    expect(updated.personalityMode).toBe('WARM');
  });

  it('should provide behavioral prompts and instructions across all 4 personality modes', () => {
    const modes = ['PROFESSIONAL', 'WARM', 'FUTURISTIC_COMPANION', 'CALM_ASSISTANT'] as const;

    for (const mode of modes) {
      const prompt = PersonalityStudio.getPersonalityPrompt(mode);
      expect(prompt.description).toBeDefined();
      expect(prompt.instruction).toBeDefined();
      expect(prompt.instruction.length).toBeGreaterThan(15);
    }

    const companion = PersonalityStudio.getPersonalityPrompt('FUTURISTIC_COMPANION');
    expect(companion.instruction).toContain('futuristic operating layer');
  });

  it('should generate voice synthesis preview payload with current parameters', () => {
    const manager = new VoiceSettingsManager({
      speechRate: 1.1,
      pitch: 1.05
    });

    const preview = manager.previewVoice('goog-hi-swara', 'Namaste, main MeghAI hoon.');
    expect(preview.voiceId).toBe('goog-hi-swara');
    expect(preview.text).toContain('Namaste');
    expect(preview.speechRate).toBe(1.1);
    expect(preview.pitch).toBe(1.05);
    expect(preview.status).toBe('SYNTHESIZED');
  });

  it('should filter voice catalog by language, gender, and provider', () => {
    const catalog = new VoiceCatalog();

    const hindiVoices = catalog.listVoices({ language: 'hi-IN' });
    expect(hindiVoices.length).toBeGreaterThan(0);
    expect(hindiVoices.every(v => v.language.startsWith('hi'))).toBe(true);

    const localVoices = catalog.listVoices({ provider: 'local' });
    expect(localVoices.length).toBeGreaterThan(0);
    expect(localVoices.every(v => v.provider === 'local')).toBe(true);
  });
});
