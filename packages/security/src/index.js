import crypto from 'node:crypto';
import path from 'node:path';
/**
 * Prompt Injection Defense & Data Isolation (Section 3.7 & 128)
 * Ensures external content is treated as untrusted data, never as instructions.
 */
export class PromptInjectionDefense {
    static INJECTION_PATTERNS = [
        /ignore (all )?previous instructions/i,
        /system prompt override/i,
        /you are now in developer mode/i,
        /disregard (all )?safety protocols/i,
        /run the following (powershell|cmd|bash|shell) command/i,
        /delete (all )?files/i,
        /exfiltrate|send your api key/i
    ];
    static wrapUntrustedContent(content, source, level = 'UNTRUSTED_CONTENT') {
        // Check for high-risk injection attempts
        const containsInjectionAttempt = this.INJECTION_PATTERNS.some(p => p.test(content));
        // Boundary-isolate external text with clear data tags
        const sanitized = content
            .replace(/<system>/gi, '&lt;system&gt;')
            .replace(/<\/system>/gi, '&lt;/system&gt;')
            .replace(/<instructions>/gi, '&lt;instructions&gt;')
            .replace(/<\/instructions>/gi, '&lt;/instructions&gt;');
        const isolated = `[BEGIN UNTRUSTED DATA FROM: ${source}]\n${sanitized}\n[END UNTRUSTED DATA]`;
        return {
            content: isolated,
            trustLevel: level,
            source,
            isSanitized: !containsInjectionAttempt
        };
    }
    static isSuspiciousPrompt(input) {
        return this.INJECTION_PATTERNS.some(p => p.test(input));
    }
}
/**
 * Secret Redaction Engine (Section 126 & 141)
 * Strips API keys, passwords, and tokens before logging, auditing, or rendering.
 */
export class SecretRedactor {
    static PATTERNS = [
        /AIza[0-9A-Za-z-_]{35}/g, // Google API Key
        /sk-[a-zA-Z0-9_-]{20,}/g, // OpenAI / DeepSeek key
        /sk-ant-[a-zA-Z0-9_-]{20,}/g, // Anthropic key
        /xai-[a-zA-Z0-9_-]{20,}/g, // xAI key
        /pplx-[a-zA-Z0-9_-]{20,}/g, // Perplexity key
        /ghp_[a-zA-Z0-9]{36}/g, // GitHub PAT
        /bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, // Bearer tokens
        /(password|passwd|secret|api_key|apikey)["']?\s*[:=]\s*["']?([^\s"',;]+)/gi // Generic secrets
    ];
    static redact(text) {
        if (!text || typeof text !== 'string')
            return text;
        let redacted = text;
        for (const pattern of this.PATTERNS) {
            redacted = redacted.replace(pattern, (match, p1) => {
                if (p1) {
                    return `${p1}: [REDACTED_SECRET]`;
                }
                return '[REDACTED_SECRET]';
            });
        }
        return redacted;
    }
}
/**
 * Path Validator & Traversal Defense (Section 49 & 129)
 */
export class PathValidator {
    static DENIED_WINDOWS_PATHS = [
        'c:\\windows',
        'c:\\program files',
        'c:\\program files (x86)',
        'c:\\programdata',
        'c:\\recovery',
        'c:\\system volume information'
    ];
    static validatePath(targetPath, allowedRoots) {
        try {
            const normalized = path.resolve(targetPath);
            const lower = normalized.toLowerCase();
            // 1. Check traversal characters
            if (targetPath.includes('..')) {
                // Double check resolved vs allowed
            }
            // 2. Check denied system directories
            for (const denied of this.DENIED_WINDOWS_PATHS) {
                if (lower === denied || lower.startsWith(denied + '\\')) {
                    return { isSafe: false, normalizedPath: normalized, error: `Access denied to protected Windows system location: ${denied}` };
                }
            }
            // 3. If allowed roots specified, ensure path resides strictly within one of them
            if (allowedRoots.length > 0) {
                const inAllowed = allowedRoots.some(root => {
                    const normRoot = path.resolve(root).toLowerCase();
                    return lower === normRoot || lower.startsWith(normRoot + path.sep);
                });
                if (!inAllowed) {
                    return { isSafe: false, normalizedPath: normalized, error: `Path is outside permitted root directories.` };
                }
            }
            return { isSafe: true, normalizedPath: normalized };
        }
        catch (err) {
            return { isSafe: false, normalizedPath: targetPath, error: `Invalid file path: ${err.message}` };
        }
    }
}
/**
 * Secure Typed IPC Authentication (Section 137)
 */
export class IPCSecurity {
    static activeToken = crypto.randomBytes(32).toString('hex');
    static getSessionToken() {
        return this.activeToken;
    }
    static rotateToken() {
        this.activeToken = crypto.randomBytes(32).toString('hex');
        return this.activeToken;
    }
    static verifyToken(candidateToken) {
        if (!candidateToken || typeof candidateToken !== 'string')
            return false;
        try {
            return crypto.timingSafeEqual(Buffer.from(candidateToken), Buffer.from(this.activeToken));
        }
        catch {
            return false;
        }
    }
    static signMessage(payload) {
        return crypto.createHmac('sha256', this.activeToken).update(payload).digest('hex');
    }
    static verifyMessageSignature(payload, signature) {
        const expected = this.signMessage(payload);
        try {
            return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
        }
        catch {
            return false;
        }
    }
}
/**
 * Emergency Kill Switch Registry (Section 55)
 * Immediately stops agent tasks, tool calls, model streaming, and subprocesses.
 */
export class KillSwitch {
    static isActivated = false;
    static registeredAbortControllers = new Set();
    static registeredProcesses = new Set();
    static listeners = new Set();
    static registerAbortController(controller) {
        if (this.isActivated) {
            controller.abort();
        }
        else {
            this.registeredAbortControllers.add(controller);
        }
        return () => this.registeredAbortControllers.delete(controller);
    }
    static registerProcess(proc) {
        if (this.isActivated) {
            proc.kill();
        }
        else {
            this.registeredProcesses.add(proc);
        }
        return () => this.registeredProcesses.delete(proc);
    }
    static onKill(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    static stopMegh(reason = 'Emergency Kill Switch Triggered by User') {
        this.isActivated = true;
        let controllersCount = 0;
        let processesCount = 0;
        // Abort all active tasks and model streams
        for (const controller of this.registeredAbortControllers) {
            try {
                controller.abort(reason);
                controllersCount++;
            }
            catch {
                // Ignore already aborted
            }
        }
        this.registeredAbortControllers.clear();
        // Kill all registered automation child processes
        for (const proc of this.registeredProcesses) {
            try {
                proc.kill();
                processesCount++;
            }
            catch {
                // Ignore already dead
            }
        }
        this.registeredProcesses.clear();
        // Notify listeners
        for (const listener of this.listeners) {
            try {
                listener(reason);
            }
            catch {
                // Prevent listener error from stopping kill sequence
            }
        }
        return { cancelledControllers: controllersCount, killedProcesses: processesCount };
    }
    static reset() {
        this.isActivated = false;
    }
    static isActive() {
        return this.isActivated;
    }
}
//# sourceMappingURL=index.js.map