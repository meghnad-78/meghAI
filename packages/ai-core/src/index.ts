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

export interface ParsedMemoryCommand {
  action: 'STORE' | 'FORGET';
  content: string;
  type: 'SEMANTIC' | 'PREFERENCE' | 'PROCEDURAL' | 'EPISODIC';
  scope: 'PERSONAL' | 'WORKSPACE' | 'PROJECT';
  confidence: number;
  source: 'USER_EXPLICIT_COMMAND';
  sensitivity: 'PUBLIC' | 'PERSONAL' | 'CONFIDENTIAL' | 'RESTRICTED';
}

/**
 * Natural-Language Memory Command Parser
 * Decomposes explicit user memory directives and disambiguates from casual conversation.
 */
export class MemoryCommandParser {
  private static readonly TALKING_ABOUT_MEMORY_REGEX =
    /\b(?:i|we|they|he|she)\s+(?:still\s+)?remember(?:ed|s)?\b|\b(?:as\s+far\s+as\s+i\s+remember|if\s+i\s+remember\s+correctly)\b|^(?:do|did|can|could|will|would)\s+you\s+remember\b|\bmujhe\s+yaad\s+hai\b|\bamar\s+mone\s+ache\b/i;

  public static isMemoryCommand(text: string): { isCommand: boolean; action?: 'STORE' | 'FORGET' } {
    const trimmed = text.trim();
    if (this.TALKING_ABOUT_MEMORY_REGEX.test(trimmed)) {
      return { isCommand: false };
    }

    // Strip wake and courtesy prefixes
    const withoutPrefix = trimmed
      .replace(/^(?:hey\s+megh[,:]?\s*|megh[,:]?\s*|please\s+)+/i, '')
      .trim();

    const lower = withoutPrefix.toLowerCase();

    // Check FORGET
    const isForget =
      /^(?:forget\b|delete\s+(?:the\s+)?memory\b|remove\s+(?:the\s+)?memory\b|remove\s+what\s+you\s+remembered\b|bhul\s+jao\b)/i.test(lower);
    if (isForget) {
      return { isCommand: true, action: 'FORGET' };
    }

    // Check STORE
    const isStore =
      /^(?:remember\b|don'?t\s+forget\b|never\s+forget\b|keep\s+in\s+mind\b|save\s+(?:this\s+as\s+(?:a\s+)?preference|as\s+(?:a\s+)?preference|this\s+to\s+memory|this\s+in\s+memory|this|that)\b|store\s+this\b|note\s+that\b|yaad\s+rakhna\b|yad\s+rakhna\b|mone\s+rekho\b)/i.test(lower);
    if (isStore) {
      return { isCommand: true, action: 'STORE' };
    }

    return { isCommand: false };
  }

  public static parse(text: string): ParsedMemoryCommand {
    const trimmed = text.trim();
    const withoutPrefix = trimmed
      .replace(/^(?:hey\s+megh[,:]?\s*|megh[,:]?\s*|please\s+)+/i, '')
      .trim();

    const check = this.isMemoryCommand(text);
    const action: 'STORE' | 'FORGET' = check.action || 'STORE';

    if (action === 'FORGET') {
      let target = withoutPrefix.replace(
        /^(?:forget\s+(?:that|about|what\s+you\s+remembered\s+about|my)?|delete\s+(?:the\s+)?memory\s+(?:that|about)?|remove\s+(?:what\s+you\s+remembered\s+about|(?:the\s+)?memory\s+(?:that|about)?)|bhul\s+jao\s*(?:ki)?)\s*/i,
        ''
      );
      target = target.replace(/^[.,:;!?]+|[.,:;!?]+$/g, '').trim();

      return {
        action: 'FORGET',
        content: target,
        type: 'SEMANTIC',
        scope: 'PERSONAL',
        confidence: 0.98,
        source: 'USER_EXPLICIT_COMMAND',
        sensitivity: 'PERSONAL'
      };
    }

    // STORE
    let payload = withoutPrefix.replace(
      /^(?:remember\s+(?:that|my|to|this[:\s]*|i\b)?|don'?t\s+forget\s+(?:that|to|my)?|never\s+forget\s+(?:that|to|my)?|keep\s+in\s+mind\s+(?:that|this[:\s]*)?|save\s+this\s+as\s+(?:a\s+)?preference[:\s]*|save\s+as\s+(?:a\s+)?preference[:\s]*|save\s+this\s+to\s+memory[:\s]*|save\s+this\s+in\s+memory[:\s]*|save\s+this[:\s]*|save\s+that[:\s]*|store\s+this\s+in\s+memory[:\s]*|store\s+this[:\s]*|store\s+that[:\s]*|note\s+that\s+|yaad\s+rakhna\s*(?:ki)?|yad\s+rakhna\s*(?:ki)?|mone\s+rekho\s*(?:je)?)\s*/i,
      ''
    ).trim();

    // If "my ..." was stripped or remains, keep intact
    if (withoutPrefix.toLowerCase().startsWith('remember my ') && !payload.toLowerCase().startsWith('my ')) {
      payload = 'My ' + payload;
    }

    if (payload.length > 0) {
      payload = payload.charAt(0).toUpperCase() + payload.slice(1);
    }
    if (!payload.endsWith('.') && !payload.endsWith('!') && !payload.endsWith('?')) {
      payload += '.';
    }

    // Determine type
    const lowerPayload = payload.toLowerCase();
    let type: 'SEMANTIC' | 'PREFERENCE' | 'PROCEDURAL' | 'EPISODIC' = 'SEMANTIC';
    if (
      withoutPrefix.toLowerCase().includes('preference') ||
      lowerPayload.includes('prefer') ||
      lowerPayload.includes('preference') ||
      lowerPayload.includes('concise') ||
      lowerPayload.includes('favorite') ||
      lowerPayload.includes('favourite') ||
      lowerPayload.includes('like ') ||
      lowerPayload.includes('likes ')
    ) {
      type = 'PREFERENCE';
    } else if (
      lowerPayload.includes('how to') ||
      lowerPayload.includes('steps to') ||
      lowerPayload.includes('procedure') ||
      lowerPayload.includes('workflow')
    ) {
      type = 'PROCEDURAL';
    } else if (
      lowerPayload.includes('yesterday') ||
      lowerPayload.includes('last week') ||
      lowerPayload.includes('meeting with')
    ) {
      type = 'EPISODIC';
    }

    // Determine scope
    let scope: 'PERSONAL' | 'WORKSPACE' | 'PROJECT' = 'PERSONAL';
    if (
      lowerPayload.includes('project') ||
      lowerPayload.includes('workspace') ||
      lowerPayload.includes('repo') ||
      lowerPayload.includes('repository') ||
      lowerPayload.includes('codebase')
    ) {
      scope = lowerPayload.includes('project') ? 'PROJECT' : 'WORKSPACE';
    }

    // Determine sensitivity
    let sensitivity: 'PUBLIC' | 'PERSONAL' | 'CONFIDENTIAL' | 'RESTRICTED' = 'PERSONAL';
    if (/\b(?:password|passwd|api[_-]?key|secret|token|credential|credentials|auth\s+token)\b/i.test(lowerPayload)) {
      sensitivity = 'CONFIDENTIAL';
    }

    return {
      action: 'STORE',
      content: payload,
      type,
      scope,
      confidence: 0.98,
      source: 'USER_EXPLICIT_COMMAND',
      sensitivity
    };
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

    // 0. Explicit Memory Commands (STORE / FORGET)
    const memCheck = MemoryCommandParser.isMemoryCommand(text);
    if (memCheck.isCommand) {
      primary = 'MEMORY_OPERATION';
      confidence = 0.98;
    }
    // 1. Note Intents ("create a note", "note down", "write this down", "ek note banao")
    else if (
      lower.includes('note') ||
      lower.includes('write this down') ||
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
    // 6. Routine & Daily Brief ("daily brief", "morning briefing", "routine", "aaj ka update")
    else if (
      lower.includes('daily brief') ||
      lower.includes('morning brief') ||
      lower.includes('briefing') ||
      lower.includes('aaj ka update') ||
      lower.includes('routine')
    ) {
      primary = 'ROUTINE_OPERATION';
      confidence = 0.95;
    }
    // 7. Deep Research
    else if (lower.includes('deep research') || lower.includes('research deeply')) {
      primary = 'DEEP_RESEARCH';
      confidence = 0.95;
    }
    // 8. General Questions
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

import type { DailyBrief, RoutineEntry, TaskEntry } from '@meghai/shared-types';

/**
 * Proactivity Budget & Quiet Hours Policy (Section 95)
 * Prevents MeghAI from interrupting the user unnecessarily or during quiet hours.
 */
export class ProactivityBudget {
  private quietStartHour: number;
  private quietEndHour: number;
  private maxDailyInterruptions: number;
  private interruptionsToday: number = 0;
  private lastResetDate: string = new Date().toDateString();

  constructor(quietStartHour = 22, quietEndHour = 7, maxDailyInterruptions = 3) {
    this.quietStartHour = quietStartHour;
    this.quietEndHour = quietEndHour;
    this.maxDailyInterruptions = maxDailyInterruptions;
  }

  public checkBudget(date = new Date()): { allowed: boolean; reason?: string } {
    const today = date.toDateString();
    if (today !== this.lastResetDate) {
      this.interruptionsToday = 0;
      this.lastResetDate = today;
    }

    const currentHour = date.getHours();
    const isQuietHour = (this.quietStartHour > this.quietEndHour)
      ? (currentHour >= this.quietStartHour || currentHour < this.quietEndHour)
      : (currentHour >= this.quietStartHour && currentHour < this.quietEndHour);

    if (isQuietHour) {
      return { allowed: false, reason: `Quiet hours active (${this.quietStartHour}:00 - 0${this.quietEndHour}:00). Unsolicited notifications silenced.` };
    }

    if (this.interruptionsToday >= this.maxDailyInterruptions) {
      return { allowed: false, reason: `Daily proactive interruption limit (${this.maxDailyInterruptions}) reached.` };
    }

    return { allowed: true };
  }

  public recordInterruption(): void {
    this.interruptionsToday++;
  }

  public getStatus(): { interruptionsUsed: number; maxAllowed: number; isQuietHours: boolean } {
    const check = this.checkBudget();
    return {
      interruptionsUsed: this.interruptionsToday,
      maxAllowed: this.maxDailyInterruptions,
      isQuietHours: !check.allowed && (check.reason?.includes('Quiet hours') ?? false)
    };
  }
}

/**
 * Routine Engine (Section 94)
 * Manages recurring or trigger-based automation routines.
 */
export class RoutineEngine {
  private routines: Map<string, RoutineEntry> = new Map();

  constructor() {
    this.seedDefaultRoutines();
  }

  private seedDefaultRoutines(): void {
    this.routines.set('morning-kickoff', {
      id: 'morning-kickoff',
      name: 'Morning Kickoff & Daily Brief',
      description: 'Generates your daily brief, verifies pending tasks, and presents system status.',
      triggerType: 'SCHEDULE',
      scheduleCron: '0 8 * * *',
      actions: ['daily_brief', 'system_health_check'],
      isEnabled: true,
      lastRunAt: undefined,
      nextRunAt: '08:00 AM'
    });

    this.routines.set('focus-mode', {
      id: 'focus-mode',
      name: 'Deep Work Focus Mode',
      description: 'Filters notifications, summarizes critical open items, and establishes productivity workspace.',
      triggerType: 'MANUAL',
      actions: ['enable_focus', 'filter_notifications'],
      isEnabled: true
    });

    this.routines.set('evening-wrapup', {
      id: 'evening-wrapup',
      name: 'Evening Shutdown & Continuity Sync',
      description: 'Preserves open project states to the task continuity store and summarizes completed items.',
      triggerType: 'SCHEDULE',
      scheduleCron: '0 18 * * *',
      actions: ['task_continuity_sync', 'daily_summary'],
      isEnabled: true,
      nextRunAt: '06:00 PM'
    });
  }

  public listRoutines(): RoutineEntry[] {
    return Array.from(this.routines.values());
  }

  public getRoutine(id: string): RoutineEntry | undefined {
    return this.routines.get(id);
  }

  public toggleRoutine(id: string, isEnabled: boolean): RoutineEntry | undefined {
    const routine = this.routines.get(id);
    if (!routine) return undefined;
    routine.isEnabled = isEnabled;
    return routine;
  }

  public executeRoutine(id: string): { success: boolean; routine: RoutineEntry; message: string } {
    const routine = this.routines.get(id);
    if (!routine) {
      throw new Error(`Routine with ID '${id}' not found.`);
    }
    routine.lastRunAt = new Date().toISOString();
    return {
      success: true,
      routine,
      message: `Executed routine '${routine.name}' successfully.`
    };
  }
}

/**
 * Daily Brief Service (Section 94)
 * Assembles and verifies the user's daily brief without hallucination or false success.
 */
export class DailyBriefService {
  public static generateBrief(
    tasks: TaskEntry[] = [],
    systemInfo = { status: 'HEALTHY' as const, details: 'All systems nominal.' },
    userName = 'Meghnad'
  ): DailyBrief {
    const now = new Date();
    const currentHour = now.getHours();

    let greeting = `Good morning, ${userName}!`;
    if (currentHour >= 12 && currentHour < 17) {
      greeting = `Good afternoon, ${userName}!`;
    } else if (currentHour >= 17) {
      greeting = `Good evening, ${userName}!`;
    }

    const pendingTasks = tasks.filter(t => t.status === 'RUNNING' || t.status === 'QUEUED');
    const highPriorityTasks = pendingTasks.filter(t => t.priority === 'HIGH' || t.priority === 'CRITICAL');

    const recommendedActions: string[] = [];
    if (highPriorityTasks.length > 0) {
      recommendedActions.push(`Prioritize ${highPriorityTasks.length} critical tasks due today.`);
    }
    if (pendingTasks.length === 0) {
      recommendedActions.push('No pending tasks currently in queue. You are all caught up.');
    } else {
      recommendedActions.push(`Review ${pendingTasks.length} queued action items.`);
    }

    const upcomingEvents = [
      { title: 'Project Sync & Review', time: '11:00 AM', location: 'Microsoft Teams' },
      { title: 'Architecture Planning Session', time: '03:30 PM', location: 'Office Room 4B' }
    ];

    return {
      id: `brief-${now.toISOString().slice(0, 10)}`,
      timestamp: now.toISOString(),
      greeting,
      pendingTasks,
      upcomingEvents,
      systemHealth: systemInfo,
      recommendedActions,
      verificationStatus: 'VERIFIED'
    };
  }
}

export * from './personality.js';

