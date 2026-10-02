import { describe, it, expect } from 'vitest';
import { WakeWordDetector, VoiceCatalog } from '../../packages/voice/src/index';

describe('VoiceCatalog & WakeWordDetector Integration', () => {
  it('detects both "Hey Megh" and "Megh" wake triggers and extracts the command', () => {
    const res1 = WakeWordDetector.isWakeTrigger('Hey Megh, open settings');
    expect(res1.isTriggered).toBe(true);
    expect(res1.cleanedText).toBe('open settings');

    const res2 = WakeWordDetector.isWakeTrigger('Megh: write a note for today');
    expect(res2.isTriggered).toBe(true);
    expect(res2.cleanedText).toBe('write a note for today');

    const res3 = WakeWordDetector.isWakeTrigger('Hello computer, can you help me?');
    expect(res3.isTriggered).toBe(false);
  });

  it('filters voices by language, provider, and gender', () => {
    const catalog = new VoiceCatalog();
    const allVoices = catalog.listVoices();
    expect(allVoices.length).toBeGreaterThan(0);

    const hindiVoices = catalog.listVoices({ language: 'hi' });
    expect(hindiVoices.length).toBeGreaterThan(0);
    expect(hindiVoices[0].language).toContain('hi');

    const englishFemaleVoices = catalog.listVoices({ language: 'en', gender: 'female' });
    expect(englishFemaleVoices.length).toBeGreaterThan(0);
    expect(englishFemaleVoices.every(v => v.gender === 'female')).toBe(true);
  });
});
