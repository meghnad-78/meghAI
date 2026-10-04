import type { PermissionScope, PermissionMode, PermissionGrant, RiskLevel, AutonomyLevel, SessionPermissionGrant, PersistentPermissionGrant, TrustedRoutineDefinition, AutonomousExecutionPolicy, PermissionAutoGrantedPayload, PermissionDecision, PermissionExplanation, PermissionEvaluationResult } from '@meghai/shared-types';
export type { PermissionDecision, PermissionExplanation, PermissionEvaluationResult };
/**
 * Standard Default Auto-Allow Tools
 * Routine and low-risk actions authorized without asking (Section 2)
 */
export declare const DEFAULT_AUTO_ALLOW_TOOLS: Set<string>;
/**
 * Trusted-Scope Reversible Filesystem Tools
 * Reversible modifications authorized automatically inside approved roots (Section 3)
 */
export declare const TRUSTED_SCOPE_FS_TOOLS: Set<string>;
/**
 * High-Risk Actions that MUST still require explicit user confirmation (Section 4)
 */
export declare const CONFIRMATION_REQUIRED_TOOLS: Set<string>;
/**
 * Read-Only Tools for STRICT_CONFIRMATION level
 */
export declare const READ_ONLY_TOOLS: Set<string>;
/**
 * Hard-Blocked Security Invariants (Section 5)
 */
export declare const HARD_BLOCKED_PATTERNS: RegExp[];
/**
 * Sensitive System / Secret Directories that must NEVER be accessed autonomously
 */
export declare const SENSITIVE_DIRS: string[];
/**
 * Authoritative Permission Broker & Autonomous Execution Policy (Section 57, 59 & v0.4.1)
 * Evaluates whether a requested capability/scope is permitted for execution.
 * Enforces: BLOCK > EXPLICIT DENY > REQUIRED CONFIRMATION > USER GRANT > TRUSTED SCOPE > DEFAULT AUTO-ALLOW
 */
export declare class PermissionBroker {
    private grants;
    private allowedRoots;
    private autonomyLevel;
    private sessionGrants;
    private persistentGrants;
    private userOverrides;
    private trustedRoutines;
    private recentDecisions;
    private storageFilePath?;
    constructor(initialAllowedRoots?: string[], storageFilePath?: string);
    private initializeDefaults;
    private loadPersistentState;
    private savePersistentState;
    getAutonomyPolicy(): AutonomousExecutionPolicy;
    setAutonomyLevel(level: AutonomyLevel): void;
    getAutonomyLevel(): AutonomyLevel;
    setUserOverride(key: string, value: 'ASK' | 'ALLOW' | 'DENY' | 'ALWAYS_ALLOW' | 'ALWAYS_PROMPT' | 'ALWAYS_DENY'): void;
    clearUserOverride(key: string): void;
    getUserOverrides(): Record<string, 'ASK' | 'ALLOW' | 'DENY'>;
    setAllowedRoots(roots: string[]): void;
    getAllowedRoots(): string[];
    addTrustedRoot(root: string): void;
    removeTrustedRoot(root: string): void;
    createSessionGrant(grantOrTool: string | Omit<SessionPermissionGrant, 'id' | 'createdAt'>, targetRoot?: string, durationMs?: number, sessionId?: string): SessionPermissionGrant;
    listSessionGrants(sessionId?: string): SessionPermissionGrant[];
    clearSessionGrants(sessionId?: string): void;
    addPersistentGrant(grantOrTool: string | Omit<PersistentPermissionGrant, 'id' | 'createdAt'>, targetPattern?: string, grantedBy?: string): PersistentPermissionGrant;
    revokePersistentGrant(id: string): boolean;
    listPersistentGrants(): PersistentPermissionGrant[];
    registerTrustedRoutine(routine: TrustedRoutineDefinition): void;
    getTrustedRoutine(id: string): TrustedRoutineDefinition | undefined;
    recordDecision(decision: PermissionAutoGrantedPayload): void;
    getRecentDecisions(limit?: number): PermissionAutoGrantedPayload[];
    grant(scope: PermissionScope, mode: PermissionMode, targets?: string[]): PermissionGrant;
    revoke(scope: PermissionScope): void;
    listGrants(): PermissionGrant[];
    getGrant(scope: PermissionScope): PermissionGrant | undefined;
    /**
     * Helper: check if target path is strictly inside a root directory
     */
    private isPathInsideRoot;
    /**
     * Helper: check if path touches a sensitive system directory
     */
    private isSensitiveDirectory;
    /**
     * Helper: map tool ID to canonical permission scope
     */
    getScopeForTool(toolId: string): PermissionScope;
    /**
     * Authoritative Action Evaluation Engine (Section 11 Precedence)
     * Enforces: BLOCK > EXPLICIT DENY > REQUIRED CONFIRMATION > USER GRANT > TRUSTED SCOPE > DEFAULT AUTO-ALLOW
     */
    evaluateAction(toolId: string, target?: string, context?: {
        sessionId?: string;
        routineId?: string;
        riskLevel?: RiskLevel;
        isReversible?: boolean;
        userConfirmed?: boolean;
        commandArgs?: Record<string, unknown>;
    }): PermissionEvaluationResult;
    /**
     * Evaluate whether an action is permitted by general scope (Backwards Compatibility)
     */
    evaluate(scope: PermissionScope, target?: string): PermissionEvaluationResult;
}
//# sourceMappingURL=index.d.ts.map