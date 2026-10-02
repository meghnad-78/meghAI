import type {
  IntentFamily,
  IntentClassification,
  Entity,
  RiskLevel
} from '@meghai/shared-types';

export interface LanguageDetectionResult {
  detectedLanguage: 'en' | 'hi' | 'bn' | 'hr' | 'bh' | 'hinglish' | 'benglish';
  confidence: number;
  isCodeSwitched: boolean;
  preservedText: string;
}

/**
 * Multilingual & Indian Code-Switching Language Detector (Section 16 & 17)
 * Launch languages: English, Hindi, Bengali, Haryanvi, Bhojpuri + Hinglish/Benglish.
 */
export class LanguageDetector {
  private static readonly HINDI_DEV_REGEX = /[\u0900-\u097F]/;
  private static readonly BENGALI_DEV_REGEX = /[\u0980-\u09FF]/;

  private static readonly HINGLISH_TOKENS = new Set([
    'mera', 'meri', 'karo', 'karna', 'kardo', 'laga', 'dena', 'aur', 'ka', 'ki',
    'ke', 'baje', 'kal', 'aaj', 'parso', 'kaha', 'kaise', 'batao', 'dikhaye'
  ]);

  private static readonly HARYANVI_TOKENS = new Set([
    'ib', 'kade', 'kitt', 'konya', 'manne', 'tanne', 'gahla', 'se', 'sa'
  ]);

  private static readonly BHOJPURI_TOKENS = new Set([
    'baani', 'ba', 'kahe', 'hamar', 'tohar', 'kekar', 'kari', 'rahua', 'babu'
  ]);

  private static readonly BENGLISH_TOKENS = new Set([
    'amar', 'amader', 'koro', 'korun', 'korte', 'ei', 'oi', 'dekhao', 'bolo',
    'shuncho', 'somoy', 'kobe', 'ektu'
  ]);

  public static detect(text: string): LanguageDetectionResult {
    const trimmed = text.trim();
    if (!trimmed) {
      return { detectedLanguage: 'en', confidence: 1.0, isCodeSwitched: false, preservedText: text };
    }

    // 1. Script checks
    if (this.BENGALI_DEV_REGEX.test(trimmed)) {
      return { detectedLanguage: 'bn', confidence: 0.98, isCodeSwitched: false, preservedText: text };
    }
    if (this.HINDI_DEV_REGEX.test(trimmed)) {
      return { detectedLanguage: 'hi', confidence: 0.98, isCodeSwitched: false, preservedText: text };
    }

    // 2. Tokenize lowercase latin words
    const tokens = trimmed.toLowerCase().split(/\s+/).map(t => t.replace(/[^a-z0-9]/g, ''));
    let hinglishCount = 0;
    let haryanviCount = 0;
    let bhojpuriCount = 0;
    let benglishCount = 0;

    for (const token of tokens) {
      if (this.HARYANVI_TOKENS.has(token)) haryanviCount++;
      if (this.BHOJPURI_TOKENS.has(token)) bhojpuriCount++;
      if (this.BENGLISH_TOKENS.has(token)) benglishCount++;
      if (this.HINGLISH_TOKENS.has(token)) hinglishCount++;
    }

    if (haryanviCount > 0) {
      return { detectedLanguage: 'hr', confidence: 0.9, isCodeSwitched: true, preservedText: text };
    }
    if (bhojpuriCount > 0) {
      return { detectedLanguage: 'bh', confidence: 0.9, isCodeSwitched: true, preservedText: text };
    }
    if (benglishCount > 0) {
      return { detectedLanguage: 'benglish', confidence: 0.88, isCodeSwitched: true, preservedText: text };
    }
    if (hinglishCount > 0) {
      return { detectedLanguage: 'hinglish', confidence: 0.92, isCodeSwitched: true, preservedText: text };
    }

    return { detectedLanguage: 'en', confidence: 0.95, isCodeSwitched: false, preservedText: text };
  }
}

/**
 * Entity Resolver with Alias Support (Section 19)
 */
export class EntityResolver {
  private static readonly FILE_EXT_REGEX = /\b[\w-]+\.(pdf|docx|txt|md|xlsx|csv|js|ts|json|py|png|jpg)\b/gi;
  private static readonly TIME_REGEX = /\b(\d{1,2}(:\d{2})?\s*(am|pm|baje)?|tomorrow|kal|yesterday|today|aaj)\b/gi;
  private static readonly APP_MAP: Record<string, string> = {
    'vs code': 'code',
    'vscode': 'code',
    'chrome': 'chrome',
    'google chrome': 'chrome',
    'edge': 'msedge',
    'calculator': 'calc',
    'notepad': 'notepad',
    'spotify': 'spotify',
    'explorer': 'explorer'
  };

  public static resolve(text: string): Entity[] {
    const entities: Entity[] = [];
    const lower = text.toLowerCase();

    // 1. Files & Aliases
    const fileMatches = text.match(this.FILE_EXT_REGEX);
    if (fileMatches) {
      for (const f of fileMatches) {
        entities.push({
          id: `entity-file-${f}`,
          type: 'FILE',
          value: f,
          confidence: 0.95
        });
      }
    }
    if (lower.includes('my resume') || lower.includes('mera resume')) {
      entities.push({
        id: 'entity-file-resume-alias',
        type: 'FILE',
        value: 'resume.pdf',
        aliases: ['my resume', 'resume'],
        confidence: 0.85
      });
    }

    // 2. Applications
    for (const [key, appExec] of Object.entries(this.APP_MAP)) {
      if (lower.includes(key)) {
        entities.push({
          id: `entity-app-${appExec}`,
          type: 'APPLICATION',
          value: appExec,
          normalizedValue: appExec,
          aliases: [key],
          confidence: 0.95
        });
      }
    }

    // 3. Time / Date
    const timeMatches = text.match(this.TIME_REGEX);
    if (timeMatches) {
      for (const t of timeMatches) {
        entities.push({
          id: `entity-time-${t}`,
          type: 'DATE_TIME',
          value: t,
          confidence: 0.8
        });
      }
    }

    return entities;
  }
}

/**
 * Ambiguity Engine (Section 20)
 * Critical ambiguity must not be guessed.
 */
export class AmbiguityEngine {
  public static checkAmbiguity(
    intent: IntentFamily,
    entities: Entity[],
    rawText: string
  ): { isAmbiguous: boolean; clarificationPrompt?: string; missingEntities: string[] } {
    const missing: string[] = [];

    // Check Communication
    if (intent === 'COMMUNICATION') {
      const hasRecipient = entities.some(e => e.type === 'PERSON' || e.type === 'EMAIL');
      if (!hasRecipient && (rawText.toLowerCase().includes('send it to him') || rawText.toLowerCase().includes('bhej do'))) {
        missing.push('recipient');
        return {
          isAmbiguous: true,
          missingEntities: missing,
          clarificationPrompt: 'Who would you like me to send this to? Please specify the recipient.'
        };
      }
    }

    // Check File Operation
    if (intent === 'FILE_OPERATION') {
      const hasFile = entities.some(e => e.type === 'FILE');
      if (!hasFile && (rawText.toLowerCase().includes('delete it') || rawText.toLowerCase().includes('hata do'))) {
        missing.push('targetFile');
        return {
          isAmbiguous: true,
          missingEntities: missing,
          clarificationPrompt: 'Which specific file would you like me to delete?'
        };
      }
    }

    return { isAmbiguous: false, missingEntities: [] };
  }
}

/**
 * Intent Engine (Section 18)
 * Classifies intent family and supports compound requests.
 */
export class IntentEngine {
  public static classify(text: string): IntentClassification {
    const lower = text.toLowerCase();
    const entities = EntityResolver.resolve(text);
    const secondary: IntentFamily[] = [];

    let primary: IntentFamily = 'CHAT';
    let confidence = 0.85;

    // 1. Note Intents ("create a note", "note down", "write this down", "ek note banao")
    if (
      lower.includes('note') ||
      lower.includes('write this down') ||
      lower.includes('yad rakhna') ||
      lower.includes('note down')
    ) {
      primary = 'NOTE';
      confidence = 0.95;
    }
    // 2. Reminder / Calendar ("remind me", "reminder laga dena", "calendar")
    else if (lower.includes('remind') || lower.includes('reminder') || lower.includes('yad dilana')) {
      primary = 'REMINDER';
      confidence = 0.95;
    }
    else if (lower.includes('calendar') || lower.includes('schedule') || lower.includes('meeting')) {
      primary = 'CALENDAR';
      confidence = 0.92;
    }
    // 3. Application Control ("open chrome", "launch vs code", "kholo")
    else if (
      (lower.startsWith('open ') || lower.startsWith('launch ') || lower.includes('kholo')) &&
      entities.some(e => e.type === 'APPLICATION')
    ) {
      primary = 'APPLICATION_CONTROL';
      confidence = 0.98;
    }
    // Communication ("send it to him", "send email", "send message", "bhej do")
    else if (
      lower.startsWith('send ') ||
      lower.includes('send it') ||
      lower.includes('message') ||
      lower.includes('email') ||
      lower.includes('bhej do') ||
      lower.includes('bhejo')
    ) {
      primary = 'COMMUNICATION';
      confidence = 0.94;
    }
    // 4. File Search & Operations ("find my resume", "pdf dhoondo", "search for file")
    else if (
      lower.includes('find ') ||
      lower.includes('search ') ||
      lower.includes('dhoondo')
    ) {
      if (entities.some(e => e.type === 'FILE') || lower.includes('file') || lower.includes('pdf')) {
        primary = 'FILE_SEARCH';
        confidence = 0.94;
      } else {
        primary = 'SEARCH';
        confidence = 0.88;
      }
    }
    // 5. Screen Analysis ("what am I looking at", "what's on my screen", "screen dekho")
    else if (
      lower.includes('screen') ||
      lower.includes('looking at') ||
      lower.includes('explain this error') ||
      lower.includes('fix this')
    ) {
      primary = 'SCREEN_ANALYSIS';
      confidence = 0.9;
    }
    // 6. Deep Research
    else if (lower.includes('deep research') || lower.includes('research deeply')) {
      primary = 'DEEP_RESEARCH';
      confidence = 0.95;
    }
    // 7. General Questions
    else if (lower.startsWith('what ') || lower.startsWith('how ') || lower.startsWith('why ') || lower.startsWith('kya ') || lower.startsWith('kaise ')) {
      primary = 'QUESTION';
      confidence = 0.85;
    }

    // Compound requests check
    let isCompound = false;
    if (lower.includes(' and ') || lower.includes(' aur ') || lower.includes(' ebong ')) {
      isCompound = true;
      if (lower.includes('spreadsheet') || lower.includes('comparison')) {
        secondary.push('COMPARISON');
      }
    }

    // Ambiguity Check
    const ambiguity = AmbiguityEngine.checkAmbiguity(primary, entities, text);

    return {
      primaryIntent: primary,
      secondaryIntents: secondary.length > 0 ? secondary : undefined,
      confidence,
      entities,
      ambiguousEntities: ambiguity.missingEntities,
      isCompound,
      requiresClarification: ambiguity.isAmbiguous,
      clarificationPrompt: ambiguity.clarificationPrompt
    };
  }
}

/**
 * Standardized Core Input Pipeline (Section 14)
 */
export class InputPipeline {
  public static process(rawText: string): {
    normalizedText: string;
    language: LanguageDetectionResult;
    intent: IntentClassification;
    timestamp: string;
  } {
    // 1. Strip wake phrase if present ("Hey Megh", "Megh")
    let cleaned = rawText.trim();
    if (/^hey megh[,:]?\s*/i.test(cleaned)) {
      cleaned = cleaned.replace(/^hey megh[,:]?\s*/i, '');
    } else if (/^megh[,:]?\s*/i.test(cleaned)) {
      cleaned = cleaned.replace(/^megh[,:]?\s*/i, '');
    }

    // 2. Language Detection
    const language = LanguageDetector.detect(cleaned);

    // 3. Intent Classification & Entity Resolution
    const intent = IntentEngine.classify(cleaned);

    return {
      normalizedText: cleaned,
      language,
      intent,
      timestamp: new Date().toISOString()
    };
  }
}
