import { ToolRegistry } from '@meghai/tool-registry';
import { PermissionBroker } from '@meghai/permissions';
import type { ToolCallRequest, ToolExecutionResult } from '@meghai/shared-types';
export interface ToolExecutionContext {
    agentId?: string;
    taskId?: string;
    userId?: string;
    userConfirmed?: boolean;
}
export type ToolHandler = (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<unknown>;
export type SystemResourceType = 'KEYBOARD' | 'MOUSE' | 'CLIPBOARD' | 'SCREEN' | 'MICROPHONE' | 'FILE' | 'APPLICATION' | 'BROWSER_PROFILE';
export interface LockLease {
    lockId: string;
    resourceType: SystemResourceType;
    resourceId: string;
    holderAgent: string;
    acquiredAt: number;
    expiresAt: number;
}
/**
 * Resource Locking Manager (Section 52 & Phase 1.16)
 * Prevents multiple agents from concurrently conflicting over system resources.
 */
export declare class ResourceLockManager {
    private leases;
    acquire(resourceId: string): boolean;
    acquireLease(resourceType: SystemResourceType, resourceId: string, holderAgent: string, leaseDurationMs?: number): {
        success: boolean;
        holder?: string;
        lease?: LockLease;
        reason?: string;
    };
    release(resourceId: string): void;
    releaseLease(resourceType: SystemResourceType, resourceId: string, holderAgent: string): boolean;
    isLocked(resourceId: string): boolean;
    listActiveLocks(): LockLease[];
    private cleanExpiredLeases;
}
/**
 * Authoritative Tool Execution Runtime (Section 44)
 * Strict non-bypassable pipeline for all agent and model tool requests.
 */
export declare class ToolRuntime {
    private registry;
    private permissionBroker;
    private handlers;
    private lockManager;
    constructor(registry: ToolRegistry, permissionBroker: PermissionBroker);
    registerHandler(toolName: string, handler: ToolHandler): void;
    execute(request: ToolCallRequest, context?: ToolExecutionContext): Promise<ToolExecutionResult>;
    private validateArguments;
}
//# sourceMappingURL=index.d.ts.map