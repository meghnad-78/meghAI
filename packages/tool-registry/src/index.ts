import type { ToolDefinition, ToolCategory } from '@meghai/shared-types';

/**
 * Authoritative Tool Registry (Section 43)
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor() {
    this.registerStandardP0Tools();
  }

  public register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  public get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  public list(category?: ToolCategory): ToolDefinition[] {
    const all = Array.from(this.tools.values());
    if (!category) return all;
    return all.filter(t => t.category === category);
  }

  public getToolsForAgent(agentRole: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(t =>
      t.allowedAgents.includes('*') || t.allowedAgents.includes(agentRole)
    );
  }

  private registerStandardP0Tools(): void {
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
      riskLevel: 'LOW',
      allowedAgents: ['WindowsAgent', '*'],
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

    this.registerUniversalActionTools();
  }

  private registerUniversalActionTools(): void {
    // -------------------------------------------------------------------------
    // WINDOWS & FILESYSTEM TOOLS (v0.4.0)
    // -------------------------------------------------------------------------
    const winTools: ToolDefinition[] = [
      {
        name: 'windows.open_app',
        version: '1.0.0',
        description: 'Launch a Windows application safely (e.g. Calculator, Notepad, Chrome, VS Code).',
        category: 'WINDOWS',
        inputSchema: {
          type: 'object',
          properties: {
            appName: { type: 'string', description: 'Name of the app (e.g. calc, notepad, chrome, code, spotify)' },
            args: { type: 'array', items: { type: 'string' } }
          },
          required: ['appName']
        },
        requiredPermissions: ['APPLICATIONS'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'PROCESS_RUNNING'
      },
      {
        name: 'windows.close_app',
        version: '1.0.0',
        description: 'Close or terminate a running application by process name or PID.',
        category: 'WINDOWS',
        inputSchema: {
          type: 'object',
          properties: {
            processName: { type: 'string', description: 'Process name or executable' },
            pid: { type: 'number', description: 'Process ID' }
          }
        },
        requiredPermissions: ['APPLICATIONS'],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.focus_app',
        version: '1.0.0',
        description: 'Bring an application window to the foreground.',
        category: 'WINDOWS',
        inputSchema: {
          type: 'object',
          properties: { appName: { type: 'string' } },
          required: ['appName']
        },
        requiredPermissions: ['APPLICATIONS'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'WINDOW_ACTIVE'
      },
      {
        name: 'windows.list_apps',
        version: '1.0.0',
        description: 'List currently open applications and their window titles.',
        category: 'WINDOWS',
        inputSchema: { type: 'object', properties: {} },
        requiredPermissions: ['APPLICATIONS'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.get_active_window',
        version: '1.0.0',
        description: 'Get the title and process of the currently active window.',
        category: 'WINDOWS',
        inputSchema: { type: 'object', properties: {} },
        requiredPermissions: ['APPLICATIONS'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.open_url',
        version: '1.0.0',
        description: 'Open a URL in the user default browser.',
        category: 'WINDOWS',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string', description: 'Web URL to navigate to' } },
          required: ['url']
        },
        requiredPermissions: ['APPLICATIONS'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.open_file',
        version: '1.0.0',
        description: 'Open a file in its default registered Windows application.',
        category: 'WINDOWS',
        inputSchema: {
          type: 'object',
          properties: { filePath: { type: 'string' } },
          required: ['filePath']
        },
        requiredPermissions: ['FILESYSTEM', 'APPLICATIONS'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.open_folder',
        version: '1.0.0',
        description: 'Open a folder in Windows File Explorer.',
        category: 'WINDOWS',
        inputSchema: {
          type: 'object',
          properties: { folderPath: { type: 'string' } },
          required: ['folderPath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.create_file',
        version: '1.0.0',
        description: 'Create a new text or code file within permitted folders.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: 'Target file path' },
            content: { type: 'string', description: 'Initial file content' }
          },
          required: ['filePath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'FILE_HASH_AND_EXISTS'
      },
      {
        name: 'windows.read_file',
        version: '1.0.0',
        description: 'Read the contents of a local file safely.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: { filePath: { type: 'string' } },
          required: ['filePath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.write_file',
        version: '1.0.0',
        description: 'Write or overwrite content in a file within permitted folders.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['filePath', 'content']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'FILE_HASH_AND_EXISTS'
      },
      {
        name: 'windows.append_file',
        version: '1.0.0',
        description: 'Append text to an existing file.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['filePath', 'content']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'FILE_HASH_AND_EXISTS'
      },
      {
        name: 'windows.rename_file',
        version: '1.0.0',
        description: 'Rename an existing file or directory.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: {
            oldPath: { type: 'string' },
            newPath: { type: 'string' }
          },
          required: ['oldPath', 'newPath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.move_file',
        version: '1.0.0',
        description: 'Move a file from source to destination path.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: {
            sourcePath: { type: 'string' },
            destPath: { type: 'string' }
          },
          required: ['sourcePath', 'destPath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.copy_file',
        version: '1.0.0',
        description: 'Copy a file to another location.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: {
            sourcePath: { type: 'string' },
            destPath: { type: 'string' }
          },
          required: ['sourcePath', 'destPath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'FILE_HASH_AND_EXISTS'
      },
      {
        name: 'windows.delete_file',
        version: '1.0.0',
        description: 'Delete a file permanently within permitted folders.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: { filePath: { type: 'string' } },
          required: ['filePath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'HIGH',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE',
        rollbackStrategy: 'IRREVERSIBLE'
      },
      {
        name: 'windows.create_folder',
        version: '1.0.0',
        description: 'Create a new directory within permitted folders.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: { folderPath: { type: 'string' } },
          required: ['folderPath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.list_folder',
        version: '1.0.0',
        description: 'List files and subdirectories inside a permitted directory.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: { folderPath: { type: 'string' } },
          required: ['folderPath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.search_files',
        version: '1.0.0',
        description: 'Search files matching query inside permitted directory.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            folderPath: { type: 'string' },
            maxResults: { type: 'number' }
          },
          required: ['query']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 15000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.get_file_metadata',
        version: '1.0.0',
        description: 'Retrieve file metadata including size, creation and modification timestamps.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: { filePath: { type: 'string' } },
          required: ['filePath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.clipboard.read',
        version: '1.0.0',
        description: 'Read the current text from Windows clipboard.',
        category: 'WINDOWS',
        inputSchema: { type: 'object', properties: {} },
        requiredPermissions: ['CLIPBOARD'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 3000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.clipboard.write',
        version: '1.0.0',
        description: 'Write text to the Windows clipboard.',
        category: 'WINDOWS',
        inputSchema: {
          type: 'object',
          properties: { text: { type: 'string' } },
          required: ['text']
        },
        requiredPermissions: ['CLIPBOARD'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 3000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'windows.take_screenshot',
        version: '1.0.0',
        description: 'Capture screenshot of the Windows desktop.',
        category: 'WINDOWS',
        inputSchema: {
          type: 'object',
          properties: { destinationPath: { type: 'string' } }
        },
        requiredPermissions: ['SCREEN'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'FILE_HASH_AND_EXISTS'
      },
      {
        name: 'windows.get_system_info',
        version: '1.0.0',
        description: 'Inspect CPU, memory, OS version and system metrics.',
        category: 'SYSTEM',
        inputSchema: { type: 'object', properties: {} },
        requiredPermissions: [],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      }
    ];

    for (const t of winTools) {
      this.register(t);
      // Also register underscore alias
      const underscoreName = t.name.replace(/\./g, '_');
      if (underscoreName !== t.name) {
        this.register({ ...t, name: underscoreName });
      }
    }

    // -------------------------------------------------------------------------
    // BROWSER TOOLS (v0.4.0)
    // -------------------------------------------------------------------------
    const browserTools: ToolDefinition[] = [
      {
        name: 'browser.open',
        version: '1.0.0',
        description: 'Open a browser session or new tab.',
        category: 'BROWSER',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' } }
        },
        requiredPermissions: ['BROWSER'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 15000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'browser.navigate',
        version: '1.0.0',
        description: 'Navigate the active browser tab to a specified URL.',
        category: 'BROWSER',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' } },
          required: ['url']
        },
        requiredPermissions: ['BROWSER'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 20000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'browser.search',
        version: '1.0.0',
        description: 'Search the web for a query and return top results safely.',
        category: 'BROWSER',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query']
        },
        requiredPermissions: ['BROWSER'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 20000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'browser.read_page',
        version: '1.0.0',
        description: 'Extract readable sanitized text and links from the current web page.',
        category: 'BROWSER',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string' } }
        },
        requiredPermissions: ['BROWSER'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 15000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'browser.get_tabs',
        version: '1.0.0',
        description: 'List open browser tabs.',
        category: 'BROWSER',
        inputSchema: { type: 'object', properties: {} },
        requiredPermissions: ['BROWSER'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'browser.switch_tab',
        version: '1.0.0',
        description: 'Switch active browser tab by ID.',
        category: 'BROWSER',
        inputSchema: {
          type: 'object',
          properties: { tabId: { type: 'string' } },
          required: ['tabId']
        },
        requiredPermissions: ['BROWSER'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'browser.close_tab',
        version: '1.0.0',
        description: 'Close a browser tab by ID.',
        category: 'BROWSER',
        inputSchema: {
          type: 'object',
          properties: { tabId: { type: 'string' } },
          required: ['tabId']
        },
        requiredPermissions: ['BROWSER'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      }
    ];

    for (const t of browserTools) {
      this.register(t);
      const underscoreName = t.name.replace(/\./g, '_');
      if (underscoreName !== t.name) {
        this.register({ ...t, name: underscoreName });
      }
    }

    // -------------------------------------------------------------------------
    // PRODUCTIVITY TOOLS: NOTES & TASKS & DOCUMENTS (v0.4.0)
    // -------------------------------------------------------------------------
    const prodTools: ToolDefinition[] = [
      {
        name: 'notes.create',
        version: '1.0.0',
        description: 'Create a personal note in persistent storage.',
        category: 'NOTES',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } }
          },
          required: ['title', 'content']
        },
        requiredPermissions: [],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'DATABASE_RECORD'
      },
      {
        name: 'notes.read',
        version: '1.0.0',
        description: 'Read a note by ID or title.',
        category: 'NOTES',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, title: { type: 'string' } }
        },
        requiredPermissions: [],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'notes.search',
        version: '1.0.0',
        description: 'Search personal notes for matching keywords.',
        category: 'NOTES',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' }, tag: { type: 'string' } }
        },
        requiredPermissions: [],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'notes.delete',
        version: '1.0.0',
        description: 'Delete a note by ID.',
        category: 'NOTES',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        requiredPermissions: [],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'DATABASE_RECORD'
      },
      {
        name: 'tasks.create',
        version: '1.0.0',
        description: 'Create a task or todo item in persistent storage.',
        category: 'TASKS',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
            dueDate: { type: 'string' }
          },
          required: ['title']
        },
        requiredPermissions: [],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'DATABASE_RECORD'
      },
      {
        name: 'tasks.list',
        version: '1.0.0',
        description: 'List user tasks with optional status filter.',
        category: 'TASKS',
        inputSchema: {
          type: 'object',
          properties: { status: { type: 'string' } }
        },
        requiredPermissions: [],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'tasks.complete',
        version: '1.0.0',
        description: 'Mark a task as completed.',
        category: 'TASKS',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' }, title: { type: 'string' } }
        },
        requiredPermissions: [],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'DATABASE_RECORD'
      },
      {
        name: 'tasks.delete',
        version: '1.0.0',
        description: 'Delete a task by ID.',
        category: 'TASKS',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id']
        },
        requiredPermissions: [],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'DATABASE_RECORD'
      },
      {
        name: 'documents.read',
        version: '1.0.0',
        description: 'Read and extract content from a text or PDF document safely.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: { filePath: { type: 'string' } },
          required: ['filePath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 15000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'documents.summarize',
        version: '1.0.0',
        description: 'Summarize content from a document file.',
        category: 'FILES',
        inputSchema: {
          type: 'object',
          properties: { filePath: { type: 'string' } },
          required: ['filePath']
        },
        requiredPermissions: ['FILESYSTEM'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 15000,
        verificationStrategy: 'NONE'
      }
    ];

    for (const t of prodTools) {
      this.register(t);
      const underscoreName = t.name.replace(/\./g, '_');
      if (underscoreName !== t.name) {
        this.register({ ...t, name: underscoreName });
      }
    }

    // -------------------------------------------------------------------------
    // ADAPTER TOOLS: CALENDAR, EMAIL, MESSAGING, SAFE SHELL (v0.4.0)
    // -------------------------------------------------------------------------
    const adapterTools: ToolDefinition[] = [
      {
        name: 'calendar.list',
        version: '1.0.0',
        description: 'List upcoming events from connected calendar provider.',
        category: 'CALENDAR',
        inputSchema: { type: 'object', properties: {} },
        requiredPermissions: ['CALENDAR'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'calendar.create',
        version: '1.0.0',
        description: 'Create an event in the connected calendar provider.',
        category: 'CALENDAR',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            date: { type: 'string' },
            time: { type: 'string' },
            durationMinutes: { type: 'number' }
          },
          required: ['title', 'date']
        },
        requiredPermissions: ['CALENDAR'],
        riskLevel: 'MEDIUM',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'API_CONFIRMATION'
      },
      {
        name: 'email.search',
        version: '1.0.0',
        description: 'Search emails from connected email provider.',
        category: 'EMAIL',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query']
        },
        requiredPermissions: ['EMAIL'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'email.draft',
        version: '1.0.0',
        description: 'Create a draft email without sending.',
        category: 'EMAIL',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'array', items: { type: 'string' } },
            subject: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['to', 'subject', 'body']
        },
        requiredPermissions: ['EMAIL'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'email.send',
        version: '1.0.0',
        description: 'Send an email to external recipients (Requires User Confirmation).',
        category: 'EMAIL',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'array', items: { type: 'string' } },
            subject: { type: 'string' },
            body: { type: 'string' }
          },
          required: ['to', 'subject', 'body']
        },
        requiredPermissions: ['EMAIL'],
        riskLevel: 'HIGH',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'API_CONFIRMATION',
        rollbackStrategy: 'IRREVERSIBLE'
      },
      {
        name: 'messaging.draft',
        version: '1.0.0',
        description: 'Draft an instant message for external messaging provider.',
        category: 'MESSAGING',
        inputSchema: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            recipient: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['recipient', 'content']
        },
        requiredPermissions: ['MESSAGING'],
        riskLevel: 'LOW',
        allowedAgents: ['*'],
        timeoutMs: 5000,
        verificationStrategy: 'NONE'
      },
      {
        name: 'messaging.send',
        version: '1.0.0',
        description: 'Send an instant message to external recipient (Requires User Confirmation).',
        category: 'MESSAGING',
        inputSchema: {
          type: 'object',
          properties: {
            platform: { type: 'string' },
            recipient: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['recipient', 'content']
        },
        requiredPermissions: ['MESSAGING'],
        riskLevel: 'HIGH',
        allowedAgents: ['*'],
        timeoutMs: 10000,
        verificationStrategy: 'API_CONFIRMATION',
        rollbackStrategy: 'IRREVERSIBLE'
      },
      {
        name: 'shell.safe_execute',
        version: '1.0.0',
        description: 'Execute allowlisted developer commands safely (npm test, npm run build, git status, ollama list).',
        category: 'SYSTEM',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command from the strict allowlist' },
            cwd: { type: 'string', description: 'Permitted working directory' }
          },
          required: ['command']
        },
        requiredPermissions: ['POWERSHELL'],
        riskLevel: 'HIGH',
        allowedAgents: ['*'],
        timeoutMs: 60000,
        verificationStrategy: 'NONE'
      }
    ];

    for (const t of adapterTools) {
      this.register(t);
      const underscoreName = t.name.replace(/\./g, '_');
      if (underscoreName !== t.name) {
        this.register({ ...t, name: underscoreName });
      }
    }

    const aliases: Record<string, string> = {
      'browser.navigate': 'browser.open_url',
      'calendar.create': 'calendar.create_event',
      'email.send': 'email.send_email',
      'messaging.send': 'messaging.send_message'
    };
    for (const [src, alias] of Object.entries(aliases)) {
      const toolDef = this.get(src);
      if (toolDef) {
        this.register({ ...toolDef, name: alias });
        this.register({ ...toolDef, name: alias.replace(/\./g, '_') });
      }
    }
  }
}

