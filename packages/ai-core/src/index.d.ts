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
//# sourceMappingURL=index.d.ts.map