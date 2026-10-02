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
/**
 * Resource Locking Manager (Section 52)
 */
export declare class ResourceLockManager {
    private activeLocks;
    acquire(resourceId: string): boolean;
    release(resourceId: string): void;
    isLocked(resourceId: string): boolean;
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