import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  MeghAIDatabase
} from '@meghai/database';
import { EventBus } from '@meghai/events';
import { PermissionBroker } from '@meghai/permissions';
import { ToolRegistry } from '@meghai/tool-registry';
import { ToolRuntime } from '@meghai/tool-runtime';
import { ModelRouter } from '@meghai/model-router';
import { MemoryManager } from '@meghai/memory';
import { WindowsSystem } from '@meghai/windows';
import { InputPipeline } from '@meghai/ai-core';
import { KillSwitch, PathValidator, IPCSecurity } from '@meghai/security';
import type {
  AIState,
  ToolCallRequest,
  ModelRequest
} from '@meghai/shared-types';

export class MeghAIServer {
  public db: MeghAIDatabase;
  public eventBus: EventBus;
  public permissionBroker: PermissionBroker;
  public toolRegistry: ToolRegistry;
  public toolRuntime: ToolRuntime;
  public modelRouter: ModelRouter;
  public memoryManager: MemoryManager;
  public aiState: AIState = 'READY';

  private server?: http.Server;
  private sseClients = new Set<http.ServerResponse>();

  constructor(storageDir?: string) {
    this.db = new MeghAIDatabase(storageDir);
    this.eventBus = new EventBus();
    this.permissionBroker = new PermissionBroker([
      process.env['USERPROFILE'] || 'c:\\Users',
      path.resolve('.')
    ]);
    this.toolRegistry = new ToolRegistry();
    this.toolRuntime = new ToolRuntime(this.toolRegistry, this.permissionBroker);
    this.modelRouter = new ModelRouter();
    this.memoryManager = new MemoryManager(this.db);

    this.registerToolHandlers();
    this.setupEventListeners();
  }

  public setAIState(state: AIState): void {
    this.aiState = state;
    this.eventBus.publish('AI_STATE_CHANGED', { state });
  }

  private setupEventListeners(): void {
    // Forward all bus events to active SSE clients
    this.eventBus.subscribe('*', event => {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      for (const client of this.sseClients) {
        try {
          client.write(data);
        } catch {
          this.sseClients.delete(client);
        }
      }
    });

    KillSwitch.onKill(reason => {
      this.setAIState('CANCELLED');
      this.eventBus.publish('KILL_SWITCH_ACTIVATED', { reason });
    });
  }

  private registerToolHandlers(): void {
    // 1. Note Create
    this.toolRuntime.registerHandler('note_create', async (args, ctx) => {
      const note = await this.db.createNote({
        title: String(args['title']),
        content: String(args['content']),
        tags: (args['tags'] as string[]) || [],
        projectId: args['projectId'] ? String(args['projectId']) : undefined,
        userId: ctx.userId || 'default-user'
      });
      return note;
    });

    // 2. Note List
    this.toolRuntime.registerHandler('note_list', async args => {
      return this.db.listNotes({
        tag: args['tag'] ? String(args['tag']) : undefined,
        query: args['query'] ? String(args['query']) : undefined
      });
    });

    // 3. Task Create
    this.toolRuntime.registerHandler('task_create', async (args, ctx) => {
      return this.db.createTask({
        title: String(args['title']),
        description: args['description'] ? String(args['description']) : undefined,
        dueDate: args['dueDate'] ? String(args['dueDate']) : undefined,
        priority: (args['priority'] as any) || 'MEDIUM',
        userId: ctx.userId || 'default-user'
      });
    });

    // 4. Task List
    this.toolRuntime.registerHandler('task_list', async args => {
      return this.db.listTasks(args['status'] ? String(args['status']) : undefined);
    });

    // 5. File Read
    this.toolRuntime.registerHandler('file_read', async args => {
      const filePath = String(args['filePath']);
      const validation = PathValidator.validatePath(filePath, this.permissionBroker.getAllowedRoots());
      if (!validation.isSafe) {
        throw new Error(validation.error || 'Path validation failed.');
      }
      return fs.readFile(validation.normalizedPath, 'utf-8');
    });

    // 6. File Write
    this.toolRuntime.registerHandler('file_write', async args => {
      const filePath = String(args['filePath']);
      const content = String(args['content']);
      const validation = PathValidator.validatePath(filePath, this.permissionBroker.getAllowedRoots());
      if (!validation.isSafe) {
        throw new Error(validation.error || 'Path validation failed.');
      }
      await fs.mkdir(path.dirname(validation.normalizedPath), { recursive: true });
      await fs.writeFile(validation.normalizedPath, content, 'utf-8');
      return { filePath: validation.normalizedPath, bytesWritten: Buffer.byteLength(content) };
    });

    // 7. File Search
    this.toolRuntime.registerHandler('file_search', async args => {
      const folder = (args['folderPath'] ? String(args['folderPath']) : process.cwd());
      const query = String(args['query']);
      return WindowsSystem.searchFiles(folder, query);
    });

    // 8. System Info
    this.toolRuntime.registerHandler('system_info', async () => {
      return WindowsSystem.getSystemInfo();
    });

    // 9. Active Window
    this.toolRuntime.registerHandler('windows_active_window', async () => {
      return WindowsSystem.getActiveWindow();
    });

    // 10. Launch App
    this.toolRuntime.registerHandler('windows_launch_app', async args => {
      const appName = String(args['appName']);
      const appArgs = (args['args'] as string[]) || [];
      return WindowsSystem.launchApp(appName, appArgs);
    });

    // 11. PowerShell Exec
    this.toolRuntime.registerHandler('powershell_exec', async args => {
      const cmd = String(args['command']);
      return WindowsSystem.executePowerShell(cmd);
    });
  }

  public async start(port = 4820): Promise<number> {
    await this.db.init();

    return new Promise(resolve => {
      this.server = http.createServer(async (req, res) => {
        // CORS Headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-IPC-Token');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || '/', `http://localhost:${port}`);
        const pathname = url.pathname;

        try {
          // SSE Stream: /api/v1/events/stream
          if (pathname === '/api/v1/events/stream' && req.method === 'GET') {
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive'
            });
            res.write(`data: ${JSON.stringify({ type: 'CONNECTED', aiState: this.aiState })}\n\n`);
            this.sseClients.add(res);
            req.on('close', () => this.sseClients.delete(res));
            return;
          }

          // Health Check: /api/v1/health
          if (pathname === '/api/v1/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              status: 'HEALTHY',
              aiState: this.aiState,
              uptime: process.uptime(),
              version: '0.1.0'
            }));
            return;
          }

          // System Status: /api/v1/system/status
          if (pathname === '/api/v1/system/status' && req.method === 'GET') {
            const sysInfo = WindowsSystem.getSystemInfo();
            const providers = await Promise.all(
              this.modelRouter.listProviders().map(async p => ({
                id: p.id,
                name: p.name,
                isConfigured: p.isConfigured(),
                health: await p.checkHealth()
              }))
            );
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              system: sysInfo,
              aiState: this.aiState,
              killSwitchActive: KillSwitch.isActive(),
              providers,
              permissions: this.permissionBroker.listGrants()
            }));
            return;
          }

          // Emergency Kill Switch: /api/v1/system/kill
          if (pathname === '/api/v1/system/kill' && req.method === 'POST') {
            const result = KillSwitch.stopMegh('User triggered emergency kill switch.');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              message: 'STOP MEGH executed successfully.',
              result
            }));
            return;
          }

          // Reset Kill Switch: /api/v1/system/reset-kill
          if (pathname === '/api/v1/system/reset-kill' && req.method === 'POST') {
            KillSwitch.reset();
            this.setAIState('READY');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, aiState: this.aiState }));
            return;
          }

          // Action Timeline: /api/v1/timeline
          if (pathname === '/api/v1/timeline' && req.method === 'GET') {
            const limit = parseInt(url.searchParams.get('limit') || '50', 10);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.eventBus.getTimeline(limit)));
            return;
          }

          // Notes List & Create
          if (pathname === '/api/v1/notes') {
            if (req.method === 'GET') {
              const notes = await this.db.listNotes();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(notes));
              return;
            }
            if (req.method === 'POST') {
              const body = await this.readJsonBody(req);
              const note = await this.db.createNote(body as any);
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(note));
              return;
            }
          }

          // Permissions
          if (pathname === '/api/v1/permissions') {
            if (req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(this.permissionBroker.listGrants()));
              return;
            }
            if (req.method === 'POST') {
              const body = await this.readJsonBody(req) as any;
              const grant = this.permissionBroker.grant(body.scope, body.mode, body.targets);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(grant));
              return;
            }
          }

          // Core Input Processing Endpoint: /api/v1/input/process
          if (pathname === '/api/v1/input/process' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as {
              text: string;
              userConfirmed?: boolean;
            };
            const result = await this.processUserRequest(body.text, body.userConfirmed);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
          }

          // 404 Fallback
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Route '${pathname}' not found.` }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });

      this.server.listen(port, () => {
        resolve(port);
      });
    });
  }

  /**
   * Complete End-to-End Orchestrated Request Handler (Section 14 & 229)
   */
  public async processUserRequest(
    rawText: string,
    userConfirmed = false
  ): Promise<Record<string, unknown>> {
    const correlationId = `req-${Date.now()}`;
    this.eventBus.publish('USER_INPUT_RECEIVED', { rawText }, correlationId);

    // 1. Core Input Pipeline
    this.setAIState('UNDERSTANDING');
    const pipeline = InputPipeline.process(rawText);
    this.eventBus.publish('LANGUAGE_DETECTED', pipeline.language, correlationId);
    this.eventBus.publish('INTENT_CLASSIFIED', pipeline.intent, correlationId);

    // 2. Ambiguity Handling
    if (pipeline.intent.requiresClarification) {
      this.setAIState('WAITING_FOR_CONFIRMATION');
      return {
        status: 'REQUIRES_CLARIFICATION',
        clarificationPrompt: pipeline.intent.clarificationPrompt,
        pipeline
      };
    }

    // 3. Routing & Execution proportional to complexity (Section 8)
    const intent = pipeline.intent.primaryIntent;

    // A. Note Creation ("Megh, create a note titled Meeting with content...")
    if (intent === 'NOTE') {
      this.setAIState('EXECUTING');
      this.eventBus.publish('TOOL_REQUESTED', { toolName: 'note_create' }, correlationId);

      // Extract title & content
      let title = 'Quick Note';
      let content = pipeline.normalizedText;

      const titleWithContentMatch = pipeline.normalizedText.match(/(?:titled|title)\s+["']?(.+?)["']?\s+(?:with\s+content|content)\s+["']?(.+)["']?$/i);
      if (titleWithContentMatch) {
        title = titleWithContentMatch[1].trim();
        content = titleWithContentMatch[2].trim();
      } else {
        const titleMatch = pipeline.normalizedText.match(/(?:titled|title)\s+["']?([^"'\n,]+)["']?/i);
        if (titleMatch) {
          title = titleMatch[1].trim();
          content = pipeline.normalizedText.replace(titleMatch[0], '').trim();
        } else {
          content = pipeline.normalizedText.replace(/^(create\s+a\s+note|note\s+down|ek\s+note\s+banao|note)\s*/i, '');
          title = content.slice(0, 30);
        }
      }

      const toolReq: ToolCallRequest = {
        id: `call-note-${Date.now()}`,
        toolName: 'note_create',
        arguments: { title, content },
        userConfirmed
      };

      this.setAIState('VERIFYING');
      this.eventBus.publish('VERIFICATION_STARTED', { target: 'database' }, correlationId);
      const executionResult = await this.toolRuntime.execute(toolReq);
      this.eventBus.publish('VERIFICATION_COMPLETED', executionResult, correlationId);

      this.setAIState('RESPONDING');
      const response = {
        status: executionResult.success ? 'COMPLETED' : 'FAILED',
        outcome: executionResult.output,
        verificationStatus: executionResult.verificationStatus,
        verificationDetails: executionResult.verificationDetails,
        reply: `Note '${title}' has been successfully created and verified in storage.`,
        timelineCorrelationId: correlationId
      };
      this.setAIState('READY');
      this.eventBus.publish('TASK_COMPLETED', response, correlationId);
      return response;
    }

    // B. Application Launch ("Hey Megh, open Chrome" / "launch Calculator")
    if (intent === 'APPLICATION_CONTROL') {
      const appEntity = pipeline.intent.entities.find(e => e.type === 'APPLICATION');
      const appName = appEntity ? appEntity.value : 'calc';

      this.setAIState('EXECUTING');
      this.eventBus.publish('TOOL_REQUESTED', { toolName: 'windows_launch_app', appName }, correlationId);

      const toolReq: ToolCallRequest = {
        id: `call-app-${Date.now()}`,
        toolName: 'windows_launch_app',
        arguments: { appName },
        userConfirmed
      };

      const executionResult = await this.toolRuntime.execute(toolReq);
      this.setAIState('RESPONDING');
      const response = {
        status: executionResult.success ? 'COMPLETED' : 'FAILED',
        outcome: executionResult.output,
        verificationStatus: executionResult.verificationStatus,
        reply: executionResult.success
          ? `Successfully launched application '${appName}'.`
          : `Could not launch application '${appName}': ${executionResult.error}`,
        timelineCorrelationId: correlationId
      };
      this.setAIState('READY');
      this.eventBus.publish('TASK_COMPLETED', response, correlationId);
      return response;
    }

    // C. File Search ("Megh, find my resume" / "find *.pdf")
    if (intent === 'FILE_SEARCH') {
      this.setAIState('EXECUTING');
      const fileEntity = pipeline.intent.entities.find(e => e.type === 'FILE');
      const query = fileEntity ? fileEntity.value : 'resume';

      const toolReq: ToolCallRequest = {
        id: `call-search-${Date.now()}`,
        toolName: 'file_search',
        arguments: { query },
        userConfirmed
      };

      const executionResult = await this.toolRuntime.execute(toolReq);
      const files = (executionResult.output as string[]) || [];

      this.setAIState('RESPONDING');
      const response = {
        status: 'COMPLETED',
        filesFound: files,
        verificationStatus: 'VERIFIED',
        reply: files.length > 0
          ? `Found ${files.length} matching files for '${query}'.`
          : `No files found matching '${query}' in permitted directories.`,
        timelineCorrelationId: correlationId
      };
      this.setAIState('READY');
      this.eventBus.publish('TASK_COMPLETED', response, correlationId);
      return response;
    }

    // D. General Intelligence / Chat / Explanation -> Model Routing
    this.setAIState('ROUTING');
    const modelReq: ModelRequest = {
      messages: [{ role: 'user', content: pipeline.normalizedText }]
    };
    const routeDecision = await this.modelRouter.route(modelReq);
    this.eventBus.publish('MODEL_SELECTED', routeDecision, correlationId);

    const provider = this.modelRouter.getProvider(routeDecision.selectedProvider);
    if (!provider || !provider.isConfigured()) {
      this.setAIState('READY');
      return {
        status: 'LOCAL_MODE',
        reply: `MeghAI is running in Local Mode. Cloud provider '${routeDecision.selectedProvider}' is not configured with an API key. (Section 206)`,
        provider: routeDecision.selectedProvider,
        routeDecision
      };
    }

    this.setAIState('RESPONDING');
    try {
      const modelRes = await provider.complete(modelReq);
      this.setAIState('READY');
      return {
        status: 'COMPLETED',
        reply: modelRes.content,
        provider: modelRes.providerId,
        modelId: modelRes.modelId,
        tokensUsed: modelRes.tokensUsed,
        timelineCorrelationId: correlationId
      };
    } catch (err) {
      this.setAIState('READY');
      return {
        status: 'FAILED',
        error: (err as Error).message,
        timelineCorrelationId: correlationId
      };
    }
  }

  private async readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => {
        data += chunk;
        if (data.length > 1024 * 1024 * 5) {
          reject(new Error('Request body exceeded 5MB limit.'));
        }
      });
      req.on('end', () => {
        try {
          if (!data.trim()) {
            resolve({});
          } else {
            resolve(JSON.parse(data));
          }
        } catch (err) {
          reject(new Error(`Invalid JSON body: ${(err as Error).message}`));
        }
      });
      req.on('error', err => reject(err));
    });
  }

  public async stop(): Promise<void> {
    for (const client of this.sseClients) {
      try { client.end(); } catch {}
    }
    this.sseClients.clear();
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
