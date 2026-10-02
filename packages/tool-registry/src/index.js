/**
 * Authoritative Tool Registry (Section 43)
 */
export class ToolRegistry {
    tools = new Map();
    constructor() {
        this.registerStandardP0Tools();
    }
    register(tool) {
        this.tools.set(tool.name, tool);
    }
    get(name) {
        return this.tools.get(name);
    }
    list(category) {
        const all = Array.from(this.tools.values());
        if (!category)
            return all;
        return all.filter(t => t.category === category);
    }
    getToolsForAgent(agentRole) {
        return Array.from(this.tools.values()).filter(t => t.allowedAgents.includes('*') || t.allowedAgents.includes(agentRole));
    }
    registerStandardP0Tools() {
        // 1. Note Create
        this.register({
            name: 'note_create',
            version: '1.0.0',
            description: 'Create and persist a new personal note in MeghAI storage.',
            category: 'NOTES',
            inputSchema: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Title of the note' },
                    content: { type: 'string', description: 'Note content in markdown or plain text' },
                    tags: { type: 'array', items: { type: 'string' }, description: 'Optional list of tags' },
                    projectId: { type: 'string', description: 'Optional project ID to associate with' }
                },
                required: ['title', 'content']
            },
            requiredPermissions: [],
            riskLevel: 'LOW',
            allowedAgents: ['*', 'Planner', 'FilesAgent', 'ResearchAgent'],
            timeoutMs: 5000,
            verificationStrategy: 'DATABASE_RECORD',
            rollbackStrategy: 'REVERSIBLE'
        });
        // 2. Note Get & List
        this.register({
            name: 'note_list',
            version: '1.0.0',
            description: 'List personal notes with optional tag or query filter.',
            category: 'NOTES',
            inputSchema: {
                type: 'object',
                properties: {
                    tag: { type: 'string' },
                    query: { type: 'string' }
                }
            },
            requiredPermissions: [],
            riskLevel: 'LOW',
            allowedAgents: ['*'],
            timeoutMs: 5000,
            verificationStrategy: 'NONE'
        });
        // 3. File Read
        this.register({
            name: 'file_read',
            version: '1.0.0',
            description: 'Read the contents of a file within permitted directories.',
            category: 'FILES',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Absolute or relative path to the file' },
                    encoding: { type: 'string', default: 'utf-8' }
                },
                required: ['filePath']
            },
            requiredPermissions: ['FILESYSTEM'],
            riskLevel: 'LOW',
            allowedAgents: ['*', 'FilesAgent', 'CodingAgent', 'ResearchAgent'],
            timeoutMs: 10000,
            verificationStrategy: 'NONE'
        });
        // 4. File Write
        this.register({
            name: 'file_write',
            version: '1.0.0',
            description: 'Write or overwrite a file within permitted directories.',
            category: 'FILES',
            inputSchema: {
                type: 'object',
                properties: {
                    filePath: { type: 'string', description: 'Destination path' },
                    content: { type: 'string', description: 'Text or code content to write' }
                },
                required: ['filePath', 'content']
            },
            requiredPermissions: ['FILESYSTEM'],
            riskLevel: 'MEDIUM',
            allowedAgents: ['FilesAgent', 'CodingAgent'],
            timeoutMs: 10000,
            verificationStrategy: 'FILE_HASH_AND_EXISTS',
            rollbackStrategy: 'REVERSIBLE'
        });
        // 5. File Search
        this.register({
            name: 'file_search',
            version: '1.0.0',
            description: 'Search for files by name, extension, or pattern within permitted folders.',
            category: 'FILES',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Filename substring or extension, e.g. .pdf or resume' },
                    folderPath: { type: 'string', description: 'Optional directory path to search within' }
                },
                required: ['query']
            },
            requiredPermissions: ['FILESYSTEM'],
            riskLevel: 'LOW',
            allowedAgents: ['*', 'FilesAgent', 'ResearchAgent'],
            timeoutMs: 15000,
            verificationStrategy: 'NONE'
        });
        // 6. Task Create & List
        this.register({
            name: 'task_create',
            version: '1.0.0',
            description: 'Create a personal task or reminder.',
            category: 'TASKS',
            inputSchema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    description: { type: 'string' },
                    dueDate: { type: 'string' },
                    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }
                },
                required: ['title']
            },
            requiredPermissions: [],
            riskLevel: 'LOW',
            allowedAgents: ['*'],
            timeoutMs: 5000,
            verificationStrategy: 'DATABASE_RECORD',
            rollbackStrategy: 'REVERSIBLE'
        });
        this.register({
            name: 'task_list',
            version: '1.0.0',
            description: 'List user tasks.',
            category: 'TASKS',
            inputSchema: {
                type: 'object',
                properties: {
                    status: { type: 'string' }
                }
            },
            requiredPermissions: [],
            riskLevel: 'LOW',
            allowedAgents: ['*'],
            timeoutMs: 5000,
            verificationStrategy: 'NONE'
        });
        // 7. System Info
        this.register({
            name: 'system_info',
            version: '1.0.0',
            description: 'Inspect CPU, memory, platform, uptime and battery state.',
            category: 'SYSTEM',
            inputSchema: { type: 'object', properties: {} },
            requiredPermissions: [],
            riskLevel: 'LOW',
            allowedAgents: ['*'],
            timeoutMs: 5000,
            verificationStrategy: 'NONE'
        });
        // 8. Windows Active Window
        this.register({
            name: 'windows_active_window',
            version: '1.0.0',
            description: 'Get current active foreground window title and process name in Windows.',
            category: 'WINDOWS',
            inputSchema: { type: 'object', properties: {} },
            requiredPermissions: ['APPLICATIONS'],
            riskLevel: 'LOW',
            allowedAgents: ['*', 'WindowsAgent'],
            timeoutMs: 5000,
            verificationStrategy: 'NONE'
        });
        // 9. Windows Launch App
        this.register({
            name: 'windows_launch_app',
            version: '1.0.0',
            description: 'Launch a Windows application (e.g. calc, notepad, chrome, code).',
            category: 'WINDOWS',
            inputSchema: {
                type: 'object',
                properties: {
                    appName: { type: 'string', description: 'Application executable or protocol, e.g. calc or notepad' },
                    args: { type: 'array', items: { type: 'string' }, description: 'Command line arguments' }
                },
                required: ['appName']
            },
            requiredPermissions: ['APPLICATIONS'],
            riskLevel: 'MEDIUM',
            allowedAgents: ['WindowsAgent'],
            timeoutMs: 10000,
            verificationStrategy: 'PROCESS_RUNNING'
        });
        // 10. PowerShell Execution
        this.register({
            name: 'powershell_exec',
            version: '1.0.0',
            description: 'Execute a vetted PowerShell command under strict risk and permission control.',
            category: 'SYSTEM',
            inputSchema: {
                type: 'object',
                properties: {
                    command: { type: 'string', description: 'PowerShell script or cmdlet to run' }
                },
                required: ['command']
            },
            requiredPermissions: ['POWERSHELL'],
            riskLevel: 'HIGH',
            allowedAgents: ['WindowsAgent', 'CodingAgent'],
            timeoutMs: 30000,
            verificationStrategy: 'NONE'
        });
    }
}
//# sourceMappingURL=index.js.map