import type { IntentFamily, IntentClassification, Entity } from '@meghai/shared-types';
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
export declare class LanguageDetector {
    private static readonly HINDI_DEV_REGEX;
    private static readonly BENGALI_DEV_REGEX;
    private static readonly HINGLISH_TOKENS;
    private static readonly HARYANVI_TOKENS;
    private static readonly BHOJPURI_TOKENS;
    private static readonly BENGLISH_TOKENS;
    static detect(text: string): LanguageDetectionResult;
}
/**
 * Entity Resolver with Alias Support (Section 19)
 */
export declare class EntityResolver {
    private static readonly FILE_EXT_REGEX;
    private static readonly TIME_REGEX;
    private static readonly APP_MAP;
    static resolve(text: string): Entity[];
}
/**
 * Ambiguity Engine (Section 20)
 * Critical ambiguity must not be guessed.
 */
export declare class AmbiguityEngine {
    static checkAmbiguity(intent: IntentFamily, entities: Entity[], rawText: string): {
        isAmbiguous: boolean;
        clarificationPrompt?: string;
        missingEntities: string[];
    };
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
export declare class MemoryCommandParser {
    private static readonly TALKING_ABOUT_MEMORY_REGEX;
    static isMemoryCommand(text: string): {
        isCommand: boolean;
        action?: 'STORE' | 'FORGET';
    };
    static parse(text: string): ParsedMemoryCommand;
}
/**
 * Intent Engine (Section 18)
 * Classifies intent family and supports compound requests.
 */
export declare class IntentEngine {
    static classify(text: string): IntentClassification;
}
/**
 * Standardized Core Input Pipeline (Section 14)
 */
export declare class InputPipeline {
    static process(rawText: string): {
        normalizedText: string;
        language: LanguageDetectionResult;
        intent: IntentClassification;
        timestamp: string;
    };
}
import type { DailyBrief, RoutineEntry, TaskEntry } from '@meghai/shared-types';
/**
 * Proactivity Budget & Quiet Hours Policy (Section 95)
 * Prevents MeghAI from interrupting the user unnecessarily or during quiet hours.
 */
export declare class ProactivityBudget {
    private quietStartHour;
    private quietEndHour;
    private maxDailyInterruptions;
    private interruptionsToday;
    private lastResetDate;
    constructor(quietStartHour?: number, quietEndHour?: number, maxDailyInterruptions?: number);
    checkBudget(date?: Date): {
        allowed: boolean;
        reason?: string;
    };
    recordInterruption(): void;
    getStatus(): {
        interruptionsUsed: number;
        maxAllowed: number;
        isQuietHours: boolean;
    };
}
/**
 * Routine Engine (Section 94)
 * Manages recurring or trigger-based automation routines.
 */
export declare class RoutineEngine {
    private routines;
    constructor();
    private seedDefaultRoutines;
    listRoutines(): RoutineEntry[];
    getRoutine(id: string): RoutineEntry | undefined;
    toggleRoutine(id: string, isEnabled: boolean): RoutineEntry | undefined;
    executeRoutine(id: string): {
        success: boolean;
        routine: RoutineEntry;
        message: string;
    };
}
/**
 * Daily Brief Service (Section 94)
 * Assembles and verifies the user's daily brief without hallucination or false success.
 */
export declare class DailyBriefService {
    static generateBrief(tasks?: TaskEntry[], systemInfo?: {
        status: "HEALTHY";
        details: string;
    }, userName?: string): DailyBrief;
}
//# sourceMappingURL=index.d.ts.map