/**
 * 4-Tier Risk Engine & Action Preview Generator (Section 58 & 61)
 */
export class RiskEngine {
    static CRITICAL_COMMAND_PATTERNS = [
        /rmdir\s+\/s/i,
        /del\s+\/[sfq]/i,
        /remove-item.*-recurse/i,
        /format\s+[a-z]:/i,
        /diskpart/i,
        /reg\s+(delete|add)/i,
        /set-executionpolicy/i,
        /net\s+user/i,
        /shutdown/i,
        /stop-computer/i
    ];
    static HIGH_RISK_COMMAND_PATTERNS = [
        /curl\s+.*\|\s*(bash|sh|powershell|iex)/i,
        /invoke-webrequest.*\|\s*iex/i,
        /stop-process/i,
        /taskkill/i,
        /npm\s+install\s+-g/i,
        /pip\s+install/i
    ];
    static assess(toolName, args, category, defaultRisk = 'LOW', rollbackStrategy = 'IRREVERSIBLE') {
        const reasons = [];
        let isDestructive = false;
        let isExternalCommunication = false;
        let computedLevel = defaultRisk;
        const lowerTool = toolName.toLowerCase();
        // 1. Check Destructive File Operations
        if (lowerTool.includes('delete') || lowerTool.includes('remove') || lowerTool.includes('truncate') || lowerTool.includes('drop')) {
            isDestructive = true;
            reasons.push('Action deletes or removes existing data.');
            computedLevel = this.elevate(computedLevel, 'HIGH');
        }
        // 2. Check Bulk Operations
        const pathArg = (args['path'] || args['targetPath'] || args['filePath'] || '');
        if (pathArg && (pathArg === '/' || pathArg.toLowerCase() === 'c:\\' || pathArg.includes('*'))) {
            isDestructive = true;
            reasons.push('Target involves root or wildcard path pattern.');
            computedLevel = 'CRITICAL';
        }
        // 3. Shell / PowerShell Command Inspection
        const commandArg = (args['command'] || args['commandLine'] || args['script'] || '');
        if (commandArg && typeof commandArg === 'string') {
            if (this.CRITICAL_COMMAND_PATTERNS.some(p => p.test(commandArg))) {
                computedLevel = 'CRITICAL';
                isDestructive = true;
                reasons.push('Command contains critical system modification or bulk deletion commands.');
            }
            else if (this.HIGH_RISK_COMMAND_PATTERNS.some(p => p.test(commandArg))) {
                computedLevel = this.elevate(computedLevel, 'HIGH');
                reasons.push('Command executes external scripts or process termination.');
            }
            else {
                computedLevel = this.elevate(computedLevel, 'MEDIUM');
                reasons.push('Shell command execution carries inherent medium system risk.');
            }
        }
        // 4. External Communications (Email, Messaging, WhatsApp)
        if (category === 'EMAIL' || category === 'MESSAGING' || lowerTool.includes('email') || lowerTool.includes('message') || lowerTool.includes('whatsapp')) {
            isExternalCommunication = true;
            if (lowerTool.includes('send') || lowerTool.includes('post') || lowerTool.includes('publish')) {
                computedLevel = this.elevate(computedLevel, 'HIGH');
                reasons.push('Sending an external message to an outside recipient cannot be undone.');
            }
            else {
                computedLevel = this.elevate(computedLevel, 'LOW'); // Draft / Read
                reasons.push('Drafting or reading messages is low impact.');
            }
        }
        // 5. System Settings / Admin Operations
        if (category === 'SYSTEM' && (lowerTool.includes('reboot') || lowerTool.includes('shutdown') || lowerTool.includes('service'))) {
            computedLevel = 'CRITICAL';
            reasons.push('Action affects overall Windows system availability.');
        }
        const requiresConfirmation = computedLevel === 'HIGH' || computedLevel === 'CRITICAL';
        const rollbackPossible = rollbackStrategy === 'REVERSIBLE' || rollbackStrategy === 'PARTIALLY_REVERSIBLE';
        if (!requiresConfirmation && reasons.length === 0) {
            reasons.push('Standard read-only or low-impact local operation.');
        }
        return {
            level: computedLevel,
            reasons,
            requiresConfirmation,
            isDestructive,
            isExternalCommunication,
            impactScope: category,
            rollbackPossible
        };
    }
    static generateActionPreview(toolName, args, assessment, rollbackStrategy = 'IRREVERSIBLE') {
        let target = 'System';
        if (args['targetPath'] || args['path'] || args['filePath']) {
            target = String(args['targetPath'] || args['path'] || args['filePath']);
        }
        else if (args['recipient'] || args['to'] || args['phone']) {
            target = String(args['recipient'] || args['to'] || args['phone']);
        }
        else if (args['url']) {
            target = String(args['url']);
        }
        else if (args['title']) {
            target = String(args['title']);
        }
        return {
            title: `Confirm Action: ${toolName}`,
            toolName,
            targetDescription: target,
            operationType: assessment.isExternalCommunication ? 'EXTERNAL_SEND' : assessment.isDestructive ? 'DESTRUCTIVE_CHANGE' : 'EXECUTE',
            riskLevel: assessment.level,
            reasons: assessment.reasons,
            reversibility: rollbackStrategy,
            payloadSummary: { ...args },
            requiresExplicitConfirmation: assessment.requiresConfirmation
        };
    }
    static elevate(current, target) {
        const ranks = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
        return ranks[target] > ranks[current] ? target : current;
    }
}
/**
 * Central Confirmation Policy Manager (Section 6 & 61)
 * Enforces explicit user confirmation for high-risk, destructive, or external communication actions.
 */
export class ConfirmationManager {
    pendingRequests = new Map();
    confirmedPlans = new Set();
    confirmedTokens = new Set();
    /**
     * Determine if an action category and risk level strictly requires confirmation.
     */
    static requiresConfirmation(toolName, riskLevel, isDestructive = false, isExternalCommunication = false) {
        const lower = toolName.toLowerCase();
        // Never require confirmation for read-only or safe navigation/launch actions
        if (lower.includes('read') ||
            lower.includes('list') ||
            lower.includes('search') ||
            lower.includes('open_app') ||
            lower.includes('launch') ||
            lower.includes('open_url') ||
            lower.includes('calc') ||
            lower.includes('get_')) {
            return false;
        }
        // High risk, critical, destructive, or external send operations ALWAYS require confirmation
        if (riskLevel === 'HIGH' || riskLevel === 'CRITICAL' || isDestructive) {
            return true;
        }
        if (isExternalCommunication && (lower.includes('send') || lower.includes('publish') || lower.includes('post'))) {
            return true;
        }
        // Destructive keywords
        if (lower.includes('delete') || lower.includes('remove') || lower.includes('drop') || lower.includes('truncate')) {
            return true;
        }
        return false;
    }
    createRequest(params) {
        const token = `conf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const now = new Date();
        const expiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString(); // 5 min expiry
        const request = {
            planId: params.planId,
            stepId: params.stepId,
            actionSummary: params.actionSummary,
            target: params.target,
            riskLevel: params.riskLevel,
            reversible: params.reversible,
            impact: params.impact,
            requiresExplicitConfirmation: true,
            confirmationToken: token,
            createdAt: now.toISOString(),
            expiresAt
        };
        this.pendingRequests.set(token, request);
        return request;
    }
    confirm(token) {
        const req = this.pendingRequests.get(token);
        if (!req)
            return false;
        // Check expiration
        if (new Date() > new Date(req.expiresAt)) {
            this.pendingRequests.delete(token);
            return false;
        }
        this.confirmedTokens.add(token);
        this.confirmedPlans.add(req.planId);
        if (req.stepId) {
            this.confirmedPlans.add(`${req.planId}:${req.stepId}`);
        }
        this.pendingRequests.delete(token);
        return true;
    }
    reject(token) {
        return this.pendingRequests.delete(token);
    }
    isPlanConfirmed(planId, stepId) {
        if (this.confirmedPlans.has(planId))
            return true;
        if (stepId && this.confirmedPlans.has(`${planId}:${stepId}`))
            return true;
        return false;
    }
    getPendingRequests() {
        const now = new Date();
        // Clean expired
        for (const [token, req] of this.pendingRequests.entries()) {
            if (now > new Date(req.expiresAt)) {
                this.pendingRequests.delete(token);
            }
        }
        return Array.from(this.pendingRequests.values());
    }
    getRequestByToken(token) {
        return this.pendingRequests.get(token);
    }
    clear() {
        this.pendingRequests.clear();
        this.confirmedPlans.clear();
        this.confirmedTokens.clear();
    }
}
//# sourceMappingURL=index.js.map