/**
 * Trust Classification for Content (Section 128)
 */
export type TrustLevel = 'SYSTEM' | 'USER' | 'TRUSTED_APP' | 'USER_APPROVED_FILE' | 'EXTERNAL_WEB' | 'UNTRUSTED_CONTENT';
export interface WrappedContent {
    content: string;
    trustLevel: TrustLevel;
    source: string;
    isSanitized: boolean;
}
/**
 * Prompt Injection Defense & Data Isolation (Section 3.7 & 128)
 * Ensures external content is treated as untrusted data, never as instructions.
 */
export declare class PromptInjectionDefense {
    private static readonly INJECTION_PATTERNS;
    static wrapUntrustedContent(content: string, source: string, level?: TrustLevel): WrappedContent;
    static isSuspiciousPrompt(input: string): boolean;
}
/**
 * Secret Redaction Engine (Section 126 & 141)
 * Strips API keys, passwords, and tokens before logging, auditing, or rendering.
 */
export declare class SecretRedactor {
    private static readonly PATTERNS;
    static redact(text: string): string;
}
/**
 * Path Validator & Traversal Defense (Section 49 & 129)
 */
export declare class PathValidator {
    private static readonly DENIED_WINDOWS_PATHS;
    static getStandardSafeRoots(customWorkspaceDir?: string): string[];
    static validatePath(targetPath: string, allowedRoots: string[]): {
        isSafe: boolean;
        normalizedPath: string;
        error?: string;
    };
    static isPathAllowed(targetPath: string, allowedRoots?: string[]): boolean;
}
/**
 * Secure Typed IPC Authentication (Section 137)
 */
export declare class IPCSecurity {
    private static activeToken;
    static getSessionToken(): string;
    static rotateToken(): string;
    static verifyToken(candidateToken: string): boolean;
    static signMessage(payload: string): string;
    static verifyMessageSignature(payload: string, signature: string): boolean;
}
/**
 * Emergency Kill Switch Registry (Section 55)
 * Immediately stops agent tasks, tool calls, model streaming, and subprocesses.
 */
export declare class KillSwitch {
    private static isActivated;
    private static registeredAbortControllers;
    private static registeredProcesses;
    private static listeners;
    private static resetListeners;
    static registerAbortController(controller: AbortController): () => void;
    static registerProcess(proc: {
        pid: number;
        kill: () => void;
    }): () => void;
    static onKill(listener: (reason: string) => void): () => void;
    static onReset(listener: (reason: string) => void): () => void;
    static trigger(reason?: string): {
        cancelledControllers: number;
        killedProcesses: number;
    };
    static stopMegh(reason?: string): {
        cancelledControllers: number;
        killedProcesses: number;
    };
    static reset(reason?: string): {
        success: boolean;
        active: boolean;
        status: 'RESET';
    };
    static isActive(): boolean;
}
//# sourceMappingURL=index.d.ts.map