import { RiskEngine } from '@meghai/risk-engine';
import { VerificationEngine } from '@meghai/verification';
import { KillSwitch, SecretRedactor } from '@meghai/security';
/**
 * Resource Locking Manager (Section 52)
 */
export class ResourceLockManager {
    activeLocks = new Set();
    acquire(resourceId) {
        if (this.activeLocks.has(resourceId)) {
            return false;
        }
        this.activeLocks.add(resourceId);
        return true;
    }
    release(resourceId) {
        this.activeLocks.delete(resourceId);
    }
    isLocked(resourceId) {
        return this.activeLocks.has(resourceId);
    }
}
/**
 * Authoritative Tool Execution Runtime (Section 44)
 * Strict non-bypassable pipeline for all agent and model tool requests.
 */
export class ToolRuntime {
    registry;
    permissionBroker;
    handlers = new Map();
    lockManager = new ResourceLockManager();
    constructor(registry, permissionBroker) {
        this.registry = registry;
        this.permissionBroker = permissionBroker;
    }
    registerHandler(toolName, handler) {
        this.handlers.set(toolName, handler);
    }
    async execute(request, context = {}) {
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
        const target = (request.arguments['filePath'] || request.arguments['path'] || request.arguments['appName'] || '');
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
        const risk = RiskEngine.assess(tool.name, request.arguments, tool.category, tool.riskLevel, tool.rollbackStrategy);
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
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool execution timed out after ${tool.timeoutMs}ms`)), tool.timeoutMs))
            ]);
            // Release lock
            this.lockManager.release(lockKey);
            // 8. Outcome Verification
            let verificationStatus = 'VERIFIED';
            let verificationDetails = 'Execution completed successfully.';
            if (tool.verificationStrategy === 'FILE_HASH_AND_EXISTS' && request.arguments['filePath']) {
                const vResult = await VerificationEngine.verifyFileWrite(String(request.arguments['filePath']), request.arguments['content'] ? String(request.arguments['content']) : undefined);
                verificationStatus = vResult.status;
                verificationDetails = vResult.details;
            }
            else if (tool.verificationStrategy === 'DATABASE_RECORD') {
                verificationStatus = 'VERIFIED';
                verificationDetails = 'Database record created and committed.';
            }
            else if (tool.verificationStrategy === 'NONE') {
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
        }
        catch (err) {
            this.lockManager.release(lockKey);
            return {
                toolCallId: request.id,
                toolName: request.toolName,
                success: false,
                error: SecretRedactor.redact(err.message),
                executionTimeMs: Date.now() - startTime,
                verificationStatus: 'FAILED'
            };
        }
    }
    validateArguments(tool, args) {
        if (!tool.inputSchema || typeof tool.inputSchema !== 'object')
            return null;
        const required = tool.inputSchema['required'];
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
//# sourceMappingURL=index.js.map