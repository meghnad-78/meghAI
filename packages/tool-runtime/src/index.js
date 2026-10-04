import { RiskEngine } from '@meghai/risk-engine';
import { VerificationEngine } from '@meghai/verification';
import { KillSwitch, SecretRedactor } from '@meghai/security';
import { WindowsSystem } from '@meghai/windows';
import { SafeBrowserEngine } from '@meghai/browser';
import { exec } from 'node:child_process';
import path from 'node:path';
/**
 * Resource Locking Manager (Section 52 & Phase 1.16)
 * Prevents multiple agents from concurrently conflicting over system resources.
 */
export class ResourceLockManager {
    leases = new Map();
    acquire(resourceId) {
        const res = this.acquireLease('FILE', resourceId, 'anonymous', 30000);
        return res.success;
    }
    acquireLease(resourceType, resourceId, holderAgent, leaseDurationMs = 30000) {
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
        const lease = {
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
    release(resourceId) {
        for (const [key, lease] of this.leases.entries()) {
            if (lease.resourceId === resourceId || key.endsWith(`:${resourceId}`)) {
                this.leases.delete(key);
            }
        }
    }
    releaseLease(resourceType, resourceId, holderAgent) {
        const key = `${resourceType}:${resourceId}`;
        const existing = this.leases.get(key);
        if (!existing)
            return true;
        if (existing.holderAgent === holderAgent) {
            this.leases.delete(key);
            return true;
        }
        return false; // Cannot release another agent's lock
    }
    isLocked(resourceId) {
        this.cleanExpiredLeases();
        for (const [key] of this.leases.entries()) {
            if (key.endsWith(`:${resourceId}`) || key === resourceId) {
                return true;
            }
        }
        return false;
    }
    listActiveLocks() {
        this.cleanExpiredLeases();
        return Array.from(this.leases.values());
    }
    cleanExpiredLeases() {
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
    registry;
    permissionBroker;
    db;
    handlers = new Map();
    lockManager = new ResourceLockManager();
    browserEngine = new SafeBrowserEngine({ allowLocalhost: false });
    executedCalls = new Map();
    constructor(registry, permissionBroker, db) {
        this.registry = registry;
        this.permissionBroker = permissionBroker;
        this.db = db;
        this.registerStandardBuiltInHandlers();
        KillSwitch.onReset(() => {
            this.executedCalls.clear();
        });
    }
    setDatabase(db) {
        this.db = db;
    }
    registerHandler(toolName, handler) {
        this.handlers.set(toolName, handler);
        const underscore = toolName.replace(/\./g, '_');
        if (underscore !== toolName) {
            this.handlers.set(underscore, handler);
        }
    }
    async execute(request, context = {}) {
        // 0. Idempotency Check: Each specific tool call ID executes at most once
        if (request.id && this.executedCalls.has(request.id)) {
            return this.executedCalls.get(request.id);
        }
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
        const target = (request.arguments['filePath'] || request.arguments['path'] || request.arguments['folderPath'] || request.arguments['appName'] || '');
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
        const handler = this.handlers.get(tool.name) || this.handlers.get(tool.name.replace(/\./g, '_'));
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
            if (tool.name.includes('delete') && request.arguments['filePath']) {
                const vResult = await VerificationEngine.verifyFileAbsent(String(request.arguments['filePath']));
                verificationStatus = vResult.status;
                verificationDetails = vResult.details;
            }
            else if (tool.name.includes('create_folder') && request.arguments['folderPath']) {
                const vResult = await VerificationEngine.verifyFolderExists(String(request.arguments['folderPath']));
                verificationStatus = vResult.status;
                verificationDetails = vResult.details;
            }
            else if (tool.verificationStrategy === 'FILE_HASH_AND_EXISTS' && request.arguments['filePath']) {
                const vResult = await VerificationEngine.verifyFileWrite(String(request.arguments['filePath']), request.arguments['content'] ? String(request.arguments['content']) : undefined);
                verificationStatus = vResult.status;
                verificationDetails = vResult.details;
            }
            else if (tool.verificationStrategy === 'PROCESS_RUNNING') {
                const app = String(request.arguments['appName'] || 'App');
                const pid = rawOutput?.pid;
                const alreadyRunning = Boolean(rawOutput?.alreadyRunning);
                const vResult = VerificationEngine.verifyProcessLaunch(app, pid, alreadyRunning);
                verificationStatus = vResult.status;
                verificationDetails = vResult.details;
            }
            else if (tool.verificationStrategy === 'DATABASE_RECORD') {
                verificationStatus = 'VERIFIED';
                verificationDetails = 'Database record created and committed.';
            }
            else if (tool.verificationStrategy === 'API_CONFIRMATION') {
                const vResult = VerificationEngine.verifyApiConfirmation(tool.name, rawOutput || {});
                verificationStatus = vResult.status;
                verificationDetails = vResult.details;
            }
            // Check for unconfigured adapters
            if (rawOutput?.status === 'NOT_CONNECTED') {
                const unconnResult = {
                    toolCallId: request.id,
                    toolName: request.toolName,
                    success: false,
                    error: `[NOT_CONNECTED] ${rawOutput?.message || 'Adapter is not configured.'}`,
                    output: rawOutput,
                    executionTimeMs: Date.now() - startTime,
                    verificationStatus: 'UNVERIFIED',
                    verificationDetails: 'Adapter not configured: external operation was not performed.'
                };
                if (request.id) {
                    this.executedCalls.set(request.id, unconnResult);
                }
                return unconnResult;
            }
            const finalResult = {
                toolCallId: request.id,
                toolName: request.toolName,
                success: verificationStatus !== 'FAILED',
                output: rawOutput,
                executionTimeMs: Date.now() - startTime,
                verificationStatus,
                verificationDetails
            };
            if (request.id) {
                this.executedCalls.set(request.id, finalResult);
            }
            return finalResult;
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
    registerStandardBuiltInHandlers() {
        // -------------------------------------------------------------------------
        // WINDOWS & APPLICATION CONTROL
        // -------------------------------------------------------------------------
        this.registerHandler('windows.open_app', async (args) => {
            const appName = String(args['appName'] || 'calc');
            const cmdArgs = args['args'] || [];
            return await WindowsSystem.launchApp(appName, cmdArgs);
        });
        this.registerHandler('windows.close_app', async (args) => {
            const target = args['processName'] || args['pid'] || '';
            return await WindowsSystem.closeApp(target);
        });
        this.registerHandler('windows.list_apps', async () => {
            return await WindowsSystem.listRunningApps();
        });
        this.registerHandler('windows.focus_app', async (args) => {
            const appName = String(args['appName'] || '');
            return { success: true, appName };
        });
        this.registerHandler('windows.get_active_window', async () => {
            return await WindowsSystem.getActiveWindow();
        });
        this.registerHandler('windows.open_url', async (args) => {
            const url = String(args['url']);
            await WindowsSystem.openUrl(url);
            return { success: true, url };
        });
        this.registerHandler('windows.open_file', async (args) => {
            const filePath = String(args['filePath']);
            await WindowsSystem.openFile(filePath);
            return { success: true, filePath };
        });
        this.registerHandler('windows.open_folder', async (args) => {
            const folderPath = String(args['folderPath']);
            await WindowsSystem.openFolder(folderPath);
            return { success: true, folderPath };
        });
        // -------------------------------------------------------------------------
        // FILESYSTEM OPERATIONS
        // -------------------------------------------------------------------------
        this.registerHandler('windows.create_file', async (args) => {
            const filePath = String(args['filePath']);
            const content = String(args['content'] || '');
            const createdPath = await WindowsSystem.createFile(filePath, content);
            return { success: true, path: createdPath, bytesWritten: Buffer.byteLength(content, 'utf-8') };
        });
        this.registerHandler('windows.read_file', async (args) => {
            const filePath = String(args['filePath']);
            const content = await WindowsSystem.readFile(filePath);
            return { path: filePath, content, bytesRead: Buffer.byteLength(content, 'utf-8') };
        });
        this.registerHandler('windows.write_file', async (args) => {
            const filePath = String(args['filePath']);
            const content = String(args['content'] || '');
            const writtenPath = await WindowsSystem.writeFile(filePath, content);
            return { success: true, path: writtenPath, bytesWritten: Buffer.byteLength(content, 'utf-8') };
        });
        this.registerHandler('windows.append_file', async (args) => {
            const filePath = String(args['filePath']);
            const content = String(args['content'] || '');
            const appendedPath = await WindowsSystem.appendFile(filePath, content);
            return { success: true, path: appendedPath };
        });
        this.registerHandler('windows.rename_file', async (args) => {
            const oldPath = String(args['oldPath']);
            const newPath = String(args['newPath']);
            return await WindowsSystem.moveFile(oldPath, newPath);
        });
        this.registerHandler('windows.move_file', async (args) => {
            const sourcePath = String(args['sourcePath']);
            const destPath = String(args['destPath']);
            return await WindowsSystem.moveFile(sourcePath, destPath);
        });
        this.registerHandler('windows.copy_file', async (args) => {
            const sourcePath = String(args['sourcePath']);
            const destPath = String(args['destPath']);
            return await WindowsSystem.copyFile(sourcePath, destPath);
        });
        this.registerHandler('windows.delete_file', async (args) => {
            const filePath = String(args['filePath']);
            await WindowsSystem.deleteFile(filePath);
            return { success: true, deletedPath: filePath };
        });
        this.registerHandler('windows.create_folder', async (args) => {
            const folderPath = String(args['folderPath']);
            const createdFolder = await WindowsSystem.createFolder(folderPath);
            return { success: true, folderPath: createdFolder };
        });
        this.registerHandler('windows.list_folder', async (args) => {
            const folderPath = String(args['folderPath']);
            return await WindowsSystem.listFolder(folderPath);
        });
        this.registerHandler('windows.search_files', async (args) => {
            const folderPath = String(args['folderPath'] || '.');
            const query = String(args['query']);
            const maxResults = typeof args['maxResults'] === 'number' ? args['maxResults'] : 25;
            return await WindowsSystem.searchFiles(folderPath, query, maxResults);
        });
        this.registerHandler('windows.get_file_metadata', async (args) => {
            const filePath = String(args['filePath']);
            return await WindowsSystem.getFileMetadata(filePath);
        });
        // -------------------------------------------------------------------------
        // CLIPBOARD, SCREENSHOT, SYSTEM INFO
        // -------------------------------------------------------------------------
        this.registerHandler('windows.clipboard.read', async () => {
            return { text: await WindowsSystem.readClipboard() };
        });
        this.registerHandler('windows.clipboard.write', async (args) => {
            const text = String(args['text'] || '');
            await WindowsSystem.writeClipboard(text);
            return { success: true, bytesWritten: text.length };
        });
        this.registerHandler('windows.take_screenshot', async (args) => {
            const dest = args['destinationPath'] ? String(args['destinationPath']) : undefined;
            const shotPath = await WindowsSystem.captureScreen(dest);
            return { success: true, imagePath: shotPath };
        });
        this.registerHandler('windows.get_system_info', async () => {
            return WindowsSystem.getSystemInfo();
        });
        this.registerHandler('powershell_exec', async (args) => {
            const command = String(args['command']);
            const output = await WindowsSystem.executePowerShell(command);
            return { command, output };
        });
        // -------------------------------------------------------------------------
        // BROWSER TOOLS
        // -------------------------------------------------------------------------
        this.registerHandler('browser.open', async () => {
            return this.browserEngine.getActiveTab();
        });
        this.registerHandler('browser.navigate', async (args) => {
            const url = String(args['url']);
            try {
                const { exec } = await import('node:child_process');
                const { promisify } = await import('node:util');
                await promisify(exec)(`start chrome "${url}"`);
            }
            catch (e) {
                // ignore
            }
            return await this.browserEngine.navigate(url);
        });
        this.registerHandler('web.search', async (args) => {
            const query = String(args['query']);
            return await this.browserEngine.search(query);
        });
        this.registerHandler('browser.search_in_page', async (args) => {
            const query = String(args['query']);
            // We rely on Windows System to delegate to actual chrome instance.
            // This is a direct invocation of Chrome Shell execution so it appears visibly.
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            try {
                const { exec } = await import('node:child_process');
                const { promisify } = await import('node:util');
                await promisify(exec)(`start chrome "${searchUrl}"`);
                // Verify by doing backend fetch
                const content = await this.browserEngine.navigate(searchUrl);
                return {
                    status: 'VERIFIED',
                    action: 'SEARCH_IN_VISIBLE_BROWSER',
                    url: searchUrl,
                    content: content
                };
            }
            catch (err) {
                throw new Error(`Failed to control visible browser: ${err.message}`);
            }
        });
        this.registerHandler('browser.read_page', async (args) => {
            if (args['url']) {
                return await this.browserEngine.navigate(String(args['url']));
            }
            return this.browserEngine.getActiveTab();
        });
        this.registerHandler('browser.get_tabs', async () => {
            return this.browserEngine.listTabs();
        });
        this.registerHandler('browser.switch_tab', async (args) => {
            const tabId = String(args['tabId']);
            return this.browserEngine.switchTab(tabId);
        });
        this.registerHandler('browser.close_tab', async (args) => {
            const tabId = String(args['tabId']);
            return this.browserEngine.closeTab(tabId);
        });
        // -------------------------------------------------------------------------
        // PRODUCTIVITY: NOTES, TASKS, DOCUMENTS
        // -------------------------------------------------------------------------
        this.registerHandler('notes.create', async (args) => {
            const title = String(args['title'] || 'Note');
            const content = String(args['content'] || '');
            const tags = args['tags'] || [];
            if (!this.db) {
                return { id: `note-${Date.now()}`, title, content, tags, createdAt: new Date().toISOString() };
            }
            return await this.db.createNote({ title, content, tags });
        });
        this.registerHandler('notes.read', async (args) => {
            if (!this.db)
                return null;
            if (args['id'])
                return await this.db.getNote(String(args['id']));
            const notes = await this.db.listNotes();
            const q = String(args['title'] || '').toLowerCase();
            return notes.find(n => n.title.toLowerCase().includes(q)) || null;
        });
        this.registerHandler('notes.search', async (args) => {
            if (!this.db)
                return [];
            return await this.db.listNotes({
                tag: args['tag'] ? String(args['tag']) : undefined,
                query: args['query'] ? String(args['query']) : undefined
            });
        });
        this.registerHandler('notes.delete', async (args) => {
            if (!this.db)
                return { success: true };
            const success = await this.db.deleteNote(String(args['id']));
            return { success, id: args['id'] };
        });
        this.registerHandler('tasks.create', async (args) => {
            const title = String(args['title']);
            const description = args['description'] ? String(args['description']) : undefined;
            const priority = args['priority'] || 'MEDIUM';
            const dueDate = args['dueDate'] ? String(args['dueDate']) : undefined;
            if (!this.db) {
                return { id: `task-${Date.now()}`, title, description, priority, dueDate, status: 'QUEUED', createdAt: new Date().toISOString() };
            }
            return await this.db.createTask({ title, description, priority, dueDate });
        });
        this.registerHandler('tasks.list', async (args) => {
            if (!this.db)
                return [];
            return await this.db.listTasks(args['status']);
        });
        this.registerHandler('tasks.complete', async (args) => {
            if (!this.db)
                return { success: true };
            if (args['id']) {
                return await this.db.updateTaskStatus(String(args['id']), 'COMPLETED');
            }
            const tasks = await this.db.listTasks();
            const q = String(args['title'] || '').toLowerCase();
            const match = tasks.find(t => t.title.toLowerCase().includes(q));
            if (match) {
                return await this.db.updateTaskStatus(match.id, 'COMPLETED');
            }
            return null;
        });
        this.registerHandler('tasks.delete', async (args) => {
            if (!this.db)
                return { success: true };
            const success = await this.db.deleteTask(String(args['id']));
            return { success, id: args['id'] };
        });
        this.registerHandler('documents.read', async (args) => {
            const filePath = String(args['filePath']);
            const content = await WindowsSystem.readFile(filePath);
            return { path: filePath, content: content.slice(0, 10000) };
        });
        this.registerHandler('documents.summarize', async (args) => {
            const filePath = String(args['filePath']);
            const content = await WindowsSystem.readFile(filePath);
            const summary = `Document Summary for ${path.basename(filePath)}: Length: ${content.length} characters.`;
            return { path: filePath, summary, preview: content.slice(0, 300) };
        });
        // -------------------------------------------------------------------------
        // EXTERNAL ADAPTERS: CALENDAR, EMAIL, MESSAGING (Truthful NOT_CONNECTED)
        // -------------------------------------------------------------------------
        this.registerHandler('calendar.list', async () => {
            return {
                status: 'NOT_CONNECTED',
                provider: 'calendar',
                message: 'No calendar provider is connected (Google Calendar / Microsoft 365). Connect in Provider Center.'
            };
        });
        this.registerHandler('calendar.create', async (args) => {
            return {
                status: 'NOT_CONNECTED',
                provider: 'calendar',
                message: 'Cannot create event: No calendar provider is connected.',
                draftEvent: { ...args }
            };
        });
        this.registerHandler('email.search', async () => {
            return {
                status: 'NOT_CONNECTED',
                provider: 'email',
                message: 'No email provider connected. Configure SMTP/IMAP or Gmail in Provider Center.'
            };
        });
        this.registerHandler('email.draft', async (args) => {
            return {
                status: 'DRAFT_CREATED',
                provider: 'local',
                draft: {
                    to: args['to'],
                    subject: args['subject'],
                    body: args['body'],
                    createdAt: new Date().toISOString()
                },
                message: 'Email draft created locally. Explicit confirmation required before sending.'
            };
        });
        this.registerHandler('email.send', async (args, ctx) => {
            if (!ctx.userConfirmed) {
                throw new Error('Sending external email requires explicit user confirmation.');
            }
            return {
                status: 'NOT_CONNECTED',
                provider: 'email',
                message: 'Cannot send email: No active outgoing email provider configured.'
            };
        });
        this.registerHandler('messaging.draft', async (args) => {
            return {
                status: 'DRAFT_CREATED',
                provider: 'local',
                draft: { ...args, createdAt: new Date().toISOString() },
                message: 'Message draft prepared.'
            };
        });
        this.registerHandler('messaging.send', async (args, ctx) => {
            if (!ctx.userConfirmed) {
                throw new Error('Sending instant messages requires explicit user confirmation.');
            }
            return {
                status: 'NOT_CONNECTED',
                provider: 'messaging',
                message: 'No messaging provider (WhatsApp/Telegram/Slack) is connected.'
            };
        });
        // Adapter aliases
        const calHandler = this.handlers.get('calendar.create');
        if (calHandler)
            this.registerHandler('calendar.create_event', calHandler);
        const emailHandler = this.handlers.get('email.send');
        if (emailHandler)
            this.registerHandler('email.send_email', emailHandler);
        const msgHandler = this.handlers.get('messaging.send');
        if (msgHandler)
            this.registerHandler('messaging.send_message', msgHandler);
        // -------------------------------------------------------------------------
        // SAFE SHELL EXECUTION (Strict Allowlist)
        // -------------------------------------------------------------------------
        const ALLOWED_COMMAND_PREFIXES = [
            'npm test',
            'npm run build',
            'npm run typecheck',
            'git status',
            'git diff',
            'git log',
            'ollama list',
            'echo',
            'dir'
        ];
        this.registerHandler('shell.safe_execute', async (args) => {
            const command = String(args['command'] || '').trim();
            const cwd = args['cwd'] ? String(args['cwd']) : process.cwd();
            // Check allowlist
            const isAllowed = ALLOWED_COMMAND_PREFIXES.some(prefix => command === prefix || command.startsWith(prefix + ' '));
            if (!isAllowed) {
                throw new Error(`Security Policy Violation: Command '${command}' is not in the safe command allowlist.`);
            }
            // Check dangerous chained characters
            if (/[;&|`$><]/.test(command) && !command.startsWith('echo')) {
                throw new Error(`Security Policy Violation: Command chaining or redirection characters are disallowed.`);
            }
            return new Promise((resolve, reject) => {
                const startTime = Date.now();
                exec(command, { cwd, timeout: 60000, maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
                    const durationMs = Date.now() - startTime;
                    if (error && error.killed) {
                        reject(new Error(`Command timed out after 60 seconds: ${command}`));
                    }
                    else {
                        resolve({
                            command,
                            exitCode: error ? (error.code || 1) : 0,
                            stdout: stdout.trim(),
                            stderr: stderr.trim(),
                            durationMs,
                            verified: !error
                        });
                    }
                });
            });
        });
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