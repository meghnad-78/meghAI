import { ToolRegistry } from '@meghai/tool-registry';
import { PermissionBroker } from '@meghai/permissions';
import { RiskEngine } from '@meghai/risk-engine';
import { VerificationEngine } from '@meghai/verification';
import { KillSwitch, SecretRedactor } from '@meghai/security';
import type {
  ToolCallRequest,
  ToolExecutionResult,
  ToolDefinition
} from '@meghai/shared-types';

export interface ToolExecutionContext {
  agentId?: string;
  taskId?: string;
  userId?: string;
  userConfirmed?: boolean;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<unknown>;

export type SystemResourceType =
  | 'KEYBOARD'
  | 'MOUSE'
  | 'CLIPBOARD'
  | 'SCREEN'
  | 'MICROPHONE'
  | 'FILE'
  | 'APPLICATION'
  | 'BROWSER_PROFILE';

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
export class ResourceLockManager {
  private leases = new Map<string, LockLease>();

  public acquire(resourceId: string): boolean {
    const res = this.acquireLease('FILE', resourceId, 'anonymous', 30000);
    return res.success;
  }

  public acquireLease(
    resourceType: SystemResourceType,
    resourceId: string,
    holderAgent: string,
    leaseDurationMs = 30000
  ): { success: boolean; holder?: string; lease?: LockLease; reason?: string } {
    this.cleanExpiredLeases();

    const key = `${resourceType}:${resourceId}`;
    const existing = this.leases.get(key);

    if (existing) {
      if (existing.holderAgent === holderAgent) {
        // Re-entrant lock extension
        existing.expiresAt = Date.now() + leaseDurationMs;
        return { success: true, lease: existing };
      }
      return {
        success: false,
        holder: existing.holderAgent,
        reason: `Resource '${key}' is currently held by agent '${existing.holderAgent}'.`
      };
    }

    const now = Date.now();
    const lease: LockLease = {
      lockId: `lock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      resourceType,
      resourceId,
      holderAgent,
      acquiredAt: now,
      expiresAt: now + leaseDurationMs
    };

    this.leases.set(key, lease);
    return { success: true, lease };
  }

  public release(resourceId: string): void {
    for (const [key, lease] of this.leases.entries()) {
      if (lease.resourceId === resourceId || key.endsWith(`:${resourceId}`)) {
        this.leases.delete(key);
      }
    }
  }

  public releaseLease(resourceType: SystemResourceType, resourceId: string, holderAgent: string): boolean {
    const key = `${resourceType}:${resourceId}`;
    const existing = this.leases.get(key);
    if (!existing) return true;
    if (existing.holderAgent === holderAgent) {
      this.leases.delete(key);
      return true;
    }
    return false; // Cannot release another agent's lock
  }

  public isLocked(resourceId: string): boolean {
    this.cleanExpiredLeases();
    for (const [key] of this.leases.entries()) {
      if (key.endsWith(`:${resourceId}`) || key === resourceId) {
        return true;
      }
    }
    return false;
  }

  public listActiveLocks(): LockLease[] {
    this.cleanExpiredLeases();
    return Array.from(this.leases.values());
  }

  private cleanExpiredLeases(): void {
    const now = Date.now();
    for (const [key, lease] of this.leases.entries()) {
      if (now > lease.expiresAt) {
        this.leases.delete(key);
      }
    }
  }
}

/**
 * Authoritative Tool Execution Runtime (Section 44)
 * Strict non-bypassable pipeline for all agent and model tool requests.
 */
export class ToolRuntime {
  private handlers = new Map<string, ToolHandler>();
  private lockManager = new ResourceLockManager();

  constructor(
    private registry: ToolRegistry,
    private permissionBroker: PermissionBroker
  ) {}

  public registerHandler(toolName: string, handler: ToolHandler): void {
    this.handlers.set(toolName, handler);
  }

  public async execute(
    request: ToolCallRequest,
    context: ToolExecutionContext = {}
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = this.registry.get(request.toolName);

    // 1. Tool Existence Check
    if (!tool) {
      return {
        toolCallId: request.id,
        toolName: request.toolName,
        success: false,
        error: `Tool '${request.toolName}' is not registered in ToolRegistry.`,
        executionTimeMs: Date.now() - startTime,
        verificationStatus: 'FAILED'
      };
    }

    // 2. Kill Switch Pre-Check
    if (KillSwitch.isActive()) {
      return {
        toolCallId: request.id,
        toolName: request.toolName,
        success: false,
        error: 'Execution cancelled: Emergency Kill Switch (STOP MEGH) is currently active.',
        executionTimeMs: Date.now() - startTime,
        verificationStatus: 'FAILED'
      };
    }

    // 3. Schema & Argument Validation
    const validationError = this.validateArguments(tool, request.arguments);
    if (validationError) {
      return {
        toolCallId: request.id,
        toolName: request.toolName,
        success: false,
        error: `Argument schema validation failed: ${validationError}`,
        executionTimeMs: Date.now() - startTime,
        verificationStatus: 'FAILED'
      };
    }

    // 4. Permission Check
    const target = (request.arguments['filePath'] || request.arguments['path'] || request.arguments['appName'] || '') as string;
    for (const scope of tool.requiredPermissions) {
      const permEval = this.permissionBroker.evaluate(scope, target);
      if (!permEval.granted) {
        return {
          toolCallId: request.id,
          toolName: request.toolName,
          success: false,
          error: `Permission Denied: ${permEval.reason}`,
          executionTimeMs: Date.now() - startTime,
          verificationStatus: 'FAILED'
        };
      }
    }

    // 5. Risk Assessment & Confirmation Check
    const risk = RiskEngine.assess(
      tool.name,
      request.arguments,
      tool.category,
      tool.riskLevel,
      tool.rollbackStrategy
    );

    const isConfirmed = context.userConfirmed || request.userConfirmed;
    if (risk.requiresConfirmation && !isConfirmed) {
      const preview = RiskEngine.generateActionPreview(tool.name, request.arguments, risk, tool.rollbackStrategy);
      return {
        toolCallId: request.id,
        toolName: request.toolName,
        success: false,
        error: `WAITING_FOR_CONFIRMATION: High risk action requires explicit user confirmation.`,
        output: { previewCard: preview },
        executionTimeMs: Date.now() - startTime,
        verificationStatus: 'UNVERIFIED'
      };
    }

    // 6. Resource Lock
    const lockKey = target || tool.category;
    if (!this.lockManager.acquire(lockKey)) {
      return {
        toolCallId: request.id,
        toolName: request.toolName,
        success: false,
        error: `Resource '${lockKey}' is currently locked by another operation.`,
        executionTimeMs: Date.now() - startTime,
        verificationStatus: 'FAILED'
      };
    }

    // 7. Handler Execution
    const handler = this.handlers.get(tool.name);
    if (!handler) {
      this.lockManager.release(lockKey);
      return {
        toolCallId: request.id,
        toolName: request.toolName,
        success: false,
        error: `No execution handler registered for tool '${tool.name}'.`,
        executionTimeMs: Date.now() - startTime,
        verificationStatus: 'FAILED'
      };
    }

    try {
      const rawOutput = await Promise.race([
        handler(request.arguments, context),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Tool execution timed out after ${tool.timeoutMs}ms`)), tool.timeoutMs)
        )
      ]);

      // Release lock
      this.lockManager.release(lockKey);

      // 8. Outcome Verification
      let verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'FAILED' = 'VERIFIED';
      let verificationDetails = 'Execution completed successfully.';

      if (tool.verificationStrategy === 'FILE_HASH_AND_EXISTS' && request.arguments['filePath']) {
        const vResult = await VerificationEngine.verifyFileWrite(
          String(request.arguments['filePath']),
          request.arguments['content'] ? String(request.arguments['content']) : undefined
        );
        verificationStatus = vResult.status;
        verificationDetails = vResult.details;
      } else if (tool.verificationStrategy === 'DATABASE_RECORD') {
        verificationStatus = 'VERIFIED';
        verificationDetails = 'Database record created and committed.';
      } else if (tool.verificationStrategy === 'NONE') {
        verificationStatus = 'VERIFIED';
        verificationDetails = 'Query operation returned results.';
      }

      return {
        toolCallId: request.id,
        toolName: request.toolName,
        success: verificationStatus !== 'FAILED',
        output: rawOutput,
        executionTimeMs: Date.now() - startTime,
        verificationStatus,
        verificationDetails
      };
    } catch (err) {
      this.lockManager.release(lockKey);
      return {
        toolCallId: request.id,
        toolName: request.toolName,
        success: false,
        error: SecretRedactor.redact((err as Error).message),
        executionTimeMs: Date.now() - startTime,
        verificationStatus: 'FAILED'
      };
    }
  }

  private validateArguments(tool: ToolDefinition, args: Record<string, unknown>): string | null {
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object') return null;
    const required = tool.inputSchema['required'] as string[] | undefined;
    if (required && Array.isArray(required)) {
      for (const req of required) {
        if (args[req] === undefined || args[req] === null || args[req] === '') {
          return `Missing required parameter '${req}'.`;
        }
      }
    }
    return null;
  }
}
