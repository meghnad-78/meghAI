import type { PermissionScope, PermissionMode, PermissionGrant } from '@meghai/shared-types';
export interface PermissionEvaluationResult {
    granted: boolean;
    requiresConfirmation: boolean;
    reason: string;
}
/**
 * Authoritative Permission Broker (Section 57 & 59)
 * Evaluates whether a requested capability/scope is permitted for execution.
 */
export declare class PermissionBroker {
    private grants;
    private allowedRoots;
    constructor(initialAllowedRoots?: string[]);
    private initializeDefaults;
    setAllowedRoots(roots: string[]): void;
    getAllowedRoots(): string[];
    grant(scope: PermissionScope, mode: PermissionMode, targets?: string[]): PermissionGrant;
    revoke(scope: PermissionScope): void;
    listGrants(): PermissionGrant[];
    getGrant(scope: PermissionScope): PermissionGrant | undefined;
    /**
     * Evaluate whether an action is permitted.
     */
    evaluate(scope: PermissionScope, target?: string): PermissionEvaluationResult;
}
//# sourceMappingURL=index.d.ts.map