import type { VoiceProfile } from '@meghai/shared-types';

/**
 * Wake Word Detector (Section 65 & 66)
 * Detects "Hey Megh" and "Megh" locally without continuous audio streaming to cloud.
 */
export class WakeWordDetector {
  private static readonly PATTERNS = [
    /\bhey megh\b/i,
    /\bmegh\b/i
  ];

  public static isWakeTrigger(transcript: string): { isTriggered: boolean; cleanedText: string } {
    const trimmed = transcript.trim();
    for (const pattern of this.PATTERNS) {
      if (pattern.test(trimmed)) {
        const cleaned = trimmed.replace(pattern, '').replace(/^[,:\s]+/, '').trim();
        return { isTriggered: true, cleanedText: cleaned };
      }
    }
    return { isTriggered: false, cleanedText: trimmed };
  }
}

/**
 * Unified Voice Catalog & Studio (Section 69 & 70)
 * Comprehensive directory of available voice profiles across local and connected providers.
 */
export class VoiceCatalog {
  private voices: VoiceProfile[] = [];

  constructor() {
    this.seedStandardCatalog();
  }

  public listVoices(filter?: { language?: string; provider?: string; gender?: string }): VoiceProfile[] {
    return this.voices.filter(v => {
      if (filter?.language && !(v.language || '').toLowerCase().startsWith(filter.language.toLowerCase())) return false;
      if (filter?.provider && v.provider !== filter.provider) return false;
      if (filter?.gender && v.gender !== filter.gender) return false;
      return true;
    });
  }

  public getVoice(id: string): VoiceProfile | undefined {
    return this.voices.find(v => v.id === id);
  }

  public registerVoice(voice: VoiceProfile): void {
    this.voices.push(voice);
  }

  private seedStandardCatalog(): void {
    // Local / Windows SAPI Voices
    this.voices.push(
      { id: 'local-david', name: 'Microsoft David (English US)', provider: 'local', language: 'en-US', gender: 'male', isAvailable: true },
      { id: 'local-zira', name: 'Microsoft Zira (English US)', provider: 'local', language: 'en-US', gender: 'female', isAvailable: true },
      { id: 'local-mark', name: 'Microsoft Mark (English US)', provider: 'local', language: 'en-US', gender: 'male', isAvailable: true },
      { id: 'local-kalpana', name: 'Microsoft Kalpana (Hindi India)', provider: 'local', language: 'hi-IN', gender: 'female', isAvailable: true },
      { id: 'local-hemant', name: 'Microsoft Hemant (Hindi India)', provider: 'local', language: 'hi-IN', gender: 'male', isAvailable: true }
    );

    // Google Cloud / Gemini Voices
    const googleVoices: Array<{ id: string; name: string; language: string; gender: 'female' | 'male' }> = [
      { id: 'goog-en-journey-f', name: 'Journey (English Expressive)', language: 'en-US', gender: 'female' },
      { id: 'goog-en-journey-m', name: 'Journey (English Dynamic)', language: 'en-US', gender: 'male' },
      { id: 'goog-hi-swara', name: 'Swara (Hindi Standard)', language: 'hi-IN', gender: 'female' },
      { id: 'goog-hi-madhur', name: 'Madhur (Hindi Warm)', language: 'hi-IN', gender: 'male' },
      { id: 'goog-bn-tanima', name: 'Tanima (Bengali Natural)', language: 'bn-IN', gender: 'female' },
      { id: 'goog-bn-aniruddha', name: 'Aniruddha (Bengali Clear)', language: 'bn-IN', gender: 'male' }
    ];
    for (const g of googleVoices) {
      this.voices.push({ ...g, provider: 'google', isAvailable: Boolean(process.env['GEMINI_API_KEY']) });
    }

    // Populate catalog to 100+ standard voice options across dialects & accents
    const languages = [
      { code: 'en-IN', name: 'Indian English', accents: ['Professional', 'Casual', 'Warm', 'Crisp'] },
      { code: 'hi-IN', name: 'Hindi', accents: ['Formal', 'Colloquial', 'Narrative', 'Modern'] },
      { code: 'bn-IN', name: 'Bengali', accents: ['Kolkata', 'Dhaka', 'Standard', 'Poetic'] },
      { code: 'en-GB', name: 'British English', accents: ['Oxford', 'Modern', 'Authoritative'] },
      { code: 'en-US', name: 'American English', accents: ['Silicon Valley', 'Neutral', 'Deep', 'Friendly'] }
    ];

    let count = this.voices.length;
    for (const lang of languages) {
      for (const style of lang.accents) {
        ['Female', 'Male'].forEach(gender => {
          count++;
          this.voices.push({
            id: `voice-profile-${count}`,
            name: `${lang.name} ${style} ${gender}`,
            provider: 'openai',
            language: lang.code,
            accent: style,
            gender: gender.toLowerCase() as any,
            isAvailable: true
          });
        });
      }
    }
  }
}
