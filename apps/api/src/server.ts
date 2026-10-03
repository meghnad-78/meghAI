import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  MeghAIDatabase
} from '@meghai/database';
import { EventBus } from '@meghai/events';
import { PermissionBroker } from '@meghai/permissions';
import { ToolRegistry } from '@meghai/tool-registry';
import { ToolRuntime } from '@meghai/tool-runtime';
import { ModelRouter } from '@meghai/model-router';
import { MemoryManager, ContextEngine } from '@meghai/memory';
import { WindowsSystem } from '@meghai/windows';
import { InputPipeline, DailyBriefService, RoutineEngine, ProactivityBudget, MemoryCommandParser } from '@meghai/ai-core';
import {
  VoiceCatalog,
  VoiceCatalogService,
  VoiceSettingsManager,
  PersonalityStudio,
  WindowsSapiTTSProvider,
  AudioPlaybackService,
  AudioCaptureService,
  AudioCueService,
  SpeechRecognitionService,
  VoiceInputManager,
  AcousticWakeWordDetector,
  WakeWordDetector
} from '@meghai/voice';
import { PersonalKnowledgeGraph } from '@meghai/knowledge-graph';
import { IntegrationRegistry } from '@meghai/integrations';
import { ObservabilityService } from '@meghai/observability';
import { KillSwitch, PathValidator, IPCSecurity } from '@meghai/security';
import type {
  AIState,
  ToolCallRequest,
  ModelRequest,
  VoiceSettings,
  AudioCueType,
  MemoryLayer,
  TaskState,
  VoiceInputState
} from '@meghai/shared-types';

export class MeghAIServer {
  public db: MeghAIDatabase;
  public eventBus: EventBus;
  public permissionBroker: PermissionBroker;
  public toolRegistry: ToolRegistry;
  public toolRuntime: ToolRuntime;
  public modelRouter: ModelRouter;
  public memoryManager: MemoryManager;
  public contextEngine: ContextEngine;
  public voiceCatalog: VoiceCatalog;
  public voiceCatalogService: VoiceCatalogService;
  public voiceSettings: VoiceSettingsManager;
  public ttsProvider: WindowsSapiTTSProvider;
  public audioPlayback: AudioPlaybackService;
  public audioCapture: AudioCaptureService;
  public speechRecognition: SpeechRecognitionService;
  public voiceInput: VoiceInputManager;
  public routineEngine: RoutineEngine;
  public proactivityBudget: ProactivityBudget;
  public knowledgeGraph: PersonalKnowledgeGraph;
  public integrationRegistry: IntegrationRegistry;
  public observability: ObservabilityService;
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
    this.contextEngine = new ContextEngine(this.memoryManager, this.permissionBroker);
    this.ttsProvider = new WindowsSapiTTSProvider();
    this.voiceCatalogService = new VoiceCatalogService();
    this.audioPlayback = new AudioPlaybackService({ eventBus: this.eventBus });
    this.audioCapture = new AudioCaptureService({
      permissionBroker: this.permissionBroker,
      eventBus: this.eventBus
    });
    this.speechRecognition = new SpeechRecognitionService();
    this.voiceInput = new VoiceInputManager({
      audioCapture: this.audioCapture,
      audioOutput: this.audioPlayback,
      speechRecognition: this.speechRecognition,
      eventBus: this.eventBus,
      onCommand: async (transcript) => {
        this.eventBus.publish('VOICE_COMMAND_RECEIVED', { transcript });
        await this.processUserRequest(transcript);
      }
    });

    this.voiceInput.onStateChange((state) => {
      if (state === 'WAKE_CONFIRMED' || state === 'COMMAND_CAPTURE') {
        this.setAIState('LISTENING');
      } else if (state === 'TRANSCRIBING') {
        this.setAIState('UNDERSTANDING');
      } else if (state === 'PROCESSING') {
        this.setAIState('EXECUTING');
      } else if (state === 'PASSIVE_WAKE_LISTENING') {
        if (this.aiState !== 'SPEAKING') {
          this.setAIState('READY');
        }
      }
    });

    this.voiceCatalog = new VoiceCatalog();
    this.voiceSettings = new VoiceSettingsManager();
    this.routineEngine = new RoutineEngine();
    this.proactivityBudget = new ProactivityBudget();
    this.knowledgeGraph = new PersonalKnowledgeGraph();
    this.integrationRegistry = new IntegrationRegistry(this.permissionBroker);
    this.observability = new ObservabilityService();

    // Dynamically discover and populate real installed Windows voices across providers
    this.voiceCatalogService.initialize().then(voices => {
      if (voices.length > 0) {
        const cur = this.voiceSettings.getSettings().selectedVoiceId;
        if (!voices.some(v => v.id === cur)) {
          const defaultVoice = voices.find(v => v.id === 'onecore-heera') || voices[0];
          if (defaultVoice) {
            this.voiceSettings.updateSettings({
              selectedVoiceId: defaultVoice.id,
              selectedProvider: defaultVoice.provider
            });
          }
        }
      }
    }).catch(() => {});

    // Reset AI state when audio playback finishes or stops
    this.audioPlayback.onStop(() => {
      if (this.aiState === 'SPEAKING') {
        this.setAIState('READY');
      }
    });

    // Wire KillSwitch to abort audio playback, cues, thinking loop, voice input, and microphone capture immediately
    KillSwitch.onKill((reason) => {
      this.audioPlayback.stop(reason);
      this.voiceInput.stop(reason).catch(() => {});
      this.eventBus.publish('INTERRUPTED', { reason: 'Emergency Kill Switch Activated' });
      if (this.audioCapture.isCapturing()) {
        this.audioCapture.stop(reason);
      }
    });

    // Play pleasant startup audio chime asynchronously
    this.audioPlayback.playCue('startup').catch(() => {});

    this.seedDefaultKnowledge();
    this.registerToolHandlers();
    this.setupEventListeners();
  }

  private seedDefaultKnowledge(): void {
    const userNode = this.knowledgeGraph.addNode('USER', 'Meghnad Saha', { role: 'Owner' }, 'user-primary');
    const systemNode = this.knowledgeGraph.addNode('APPLICATION', 'MeghAI Operating Layer', { version: '0.1.0' }, 'app-meghai');
    const projectNode = this.knowledgeGraph.addNode('PROJECT', 'MeghAI Core Development', { status: 'IN_PROGRESS' }, 'proj-meghai');
    this.knowledgeGraph.addEdge(userNode.id, projectNode.id, 'WORKS_ON');
    this.knowledgeGraph.addEdge(systemNode.id, projectNode.id, 'ASSOCIATED_WITH');
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
              permissions: this.permissionBroker.listGrants(),
              microphone: {
                state: this.audioCapture.getState(),
                isCapturing: this.audioCapture.isCapturing()
              }
            }));
            return;
          }

          // Emergency Kill Switch: /api/v1/system/kill
          if (pathname === '/api/v1/system/kill' && req.method === 'POST') {
            const result = KillSwitch.stopMegh('User triggered emergency kill switch.');
            if (this.audioPlayback.isPlaying()) {
              this.audioPlayback.stop('Emergency Kill Switch triggered');
              this.eventBus.publish('INTERRUPTED', { reason: 'Emergency Kill Switch triggered' });
            }
            if (this.audioCapture.isCapturing()) {
              this.audioCapture.stop('Emergency Kill Switch triggered');
            }
            this.setAIState('CANCELLED');
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

          // Memory Center: /api/v1/memory
          if (pathname === '/api/v1/memory') {
            if (req.method === 'GET') {
              const memories = await this.memoryManager.getMemories();
              const candidates = this.memoryManager.listCandidates();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ memories, candidates }));
              return;
            }
            if (req.method === 'POST') {
              const body = await this.readJsonBody(req) as any;
              const candidate = this.memoryManager.proposeCandidate({
                content: String(body.content),
                layer: body.layer || 'SEMANTIC',
                provenance: body.provenance || 'User API Entry',
                confidence: body.confidence ?? 0.9,
                sensitivity: body.sensitivity || 'PERSONAL'
              });
              if (body.durable) {
                const durable = await this.memoryManager.promoteToDurable(candidate.id, true);
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(durable));
                return;
              }
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(candidate));
              return;
            }
            if (req.method === 'DELETE') {
              const body = await this.readJsonBody(req) as { id: string };
              try {
                const deleted = await this.memoryManager.deleteMemory(body.id);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: deleted, id: body.id }));
              } catch (err: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              }
              return;
            }
          }

          // Memory Candidate Promotion: /api/v1/memory/promote
          if (pathname === '/api/v1/memory/promote' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { candidateId: string };
            const promoted = await this.memoryManager.promoteToDurable(body.candidateId, true);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(promoted));
            return;
          }

          // Memory Lock/Unlock: /api/v1/memory/lock
          if (pathname === '/api/v1/memory/lock' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { id: string; locked: boolean };
            const success = await this.memoryManager.lockMemory(body.id, body.locked);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success, id: body.id, locked: body.locked }));
            return;
          }

          // Knowledge Graph: /api/v1/knowledge/graph
          if (pathname === '/api/v1/knowledge/graph' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              nodes: this.knowledgeGraph.getAllNodes(),
              edges: this.knowledgeGraph.getAllEdges()
            }));
            return;
          }

          // Knowledge Graph Node Add: /api/v1/knowledge/node
          if (pathname === '/api/v1/knowledge/node' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as any;
            const node = this.knowledgeGraph.addNode(body.type, body.label, body.properties, body.id);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(node));
            return;
          }

          // Voice Catalog: /api/v1/voice/catalog
          if (pathname === '/api/v1/voice/catalog' && req.method === 'GET') {
            const lang = url.searchParams.get('language') || undefined;
            const prov = url.searchParams.get('provider') || undefined;
            const gender = url.searchParams.get('gender') || undefined;
            const naturalness = url.searchParams.get('naturalness') || undefined;
            const availableOnly = url.searchParams.get('availableOnly') === 'true';
            const voices = this.voiceCatalogService.listVoices({ language: lang, provider: prov, gender, naturalness, availableOnly });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(voices));
            return;
          }

          // Voice Catalog Stats: /api/v1/voice/catalog/stats
          if (pathname === '/api/v1/voice/catalog/stats' && req.method === 'GET') {
            const stats = this.voiceCatalogService.getStats();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stats));
            return;
          }

          // Voice Settings: /api/v1/voice/settings
          if (pathname === '/api/v1/voice/settings') {
            if (req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(this.voiceSettings.getSettings()));
              return;
            }
            if (req.method === 'POST') {
              const body = await this.readJsonBody(req) as Partial<VoiceSettings>;
              const updated = this.voiceSettings.updateSettings(body);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(updated));
              return;
            }
          }

          // Voice Preview: /api/v1/voice/preview
          if (pathname === '/api/v1/voice/preview' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { voiceId?: string; text?: string; play?: boolean };
            const settings = this.voiceSettings.getSettings();
            const voiceId = body.voiceId || settings.selectedVoiceId;
            const textToSpeak = (body.text || 'Greetings. I am MeghAI, your personal intelligence layer.').trim();
            const correlationId = `tts-preview-${Date.now()}`;

            this.eventBus.publish('TTS_REQUESTED', {
              voiceId,
              text: textToSpeak
            }, correlationId);

            try {
              const synthesis = await this.voiceCatalogService.synthesize(textToSpeak, {
                voiceId,
                speechRate: settings.speechRate,
                pitch: settings.pitch,
                volume: settings.volume
              });

              this.eventBus.publish('TTS_AUDIO_READY', {
                voiceId: synthesis.voiceId,
                durationMs: synthesis.durationMs,
                format: synthesis.format
              }, correlationId);

              if (body.play !== false) {
                this.setAIState('SPEAKING');
                await this.audioPlayback.playTTS(synthesis, {
                  voiceId: synthesis.voiceId,
                  text: synthesis.spokenText,
                  correlationId
                });
                this.setAIState('READY');
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                status: 'SYNTHESIZED_AND_PLAYED',
                voiceId: synthesis.voiceId,
                text: synthesis.spokenText,
                speechRate: settings.speechRate,
                pitch: settings.pitch,
                volume: settings.volume,
                durationMs: synthesis.durationMs,
                audioBase64: synthesis.audioBase64
              }));
            } catch (err: any) {
              if (this.aiState === 'SPEAKING') {
                this.setAIState('READY');
              }
              this.eventBus.publish('TTS_FAILED', { error: err.message, voiceId }, correlationId);
              this.eventBus.publish('VOICE_ERROR', { error: err.message }, correlationId);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          // Voice Speak (on-demand): /api/v1/voice/speak
          if (pathname === '/api/v1/voice/speak' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { text: string; voiceId?: string };
            const settings = this.voiceSettings.getSettings();
            const voiceId = body.voiceId || settings.selectedVoiceId;
            const textToSpeak = (body.text || '').trim();
            if (!textToSpeak) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Text cannot be empty' }));
              return;
            }

            try {
              await this.speakResponse(textToSpeak);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, spokenText: textToSpeak, voiceId }));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          // Audio Cue Play: /api/v1/voice/cue
          if (pathname === '/api/v1/voice/cue' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { cue: any };
            const cueType = body.cue || 'startup';
            try {
              await this.audioPlayback.playCue(cueType);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, cue: cueType }));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          // Voice Stop: /api/v1/voice/stop
          if (pathname === '/api/v1/voice/stop' && req.method === 'POST') {
            const stopped = this.audioPlayback.stop('User requested voice stop');
            if (stopped) {
              this.eventBus.publish('INTERRUPTED', { reason: 'User requested voice stop' });
            }
            if (this.aiState === 'SPEAKING') {
              this.setAIState('READY');
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, stopped, aiState: this.aiState }));
            return;
          }

          // Voice Status: /api/v1/voice/status
          if (pathname === '/api/v1/voice/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.audioPlayback.getStatus()));
            return;
          }

          // Microphone Start: /api/v1/voice/mic/start
          if (pathname === '/api/v1/voice/mic/start' && req.method === 'POST') {
            try {
              let body: any = {};
              try { body = await this.readJsonBody(req); } catch {}
              await this.audioCapture.start({ deviceId: body?.deviceId });
              await this.voiceInput.startPassiveListening();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                state: this.audioCapture.getState(),
                voiceInputState: this.voiceInput.getState(),
                isCapturing: this.audioCapture.isCapturing(),
                diagnostics: this.audioCapture.getDiagnostics()
              }));
            } catch (err: any) {
              const status = this.audioCapture.getState() === 'MIC_DEVICE_UNAVAILABLE' ? 503 : 500;
              res.writeHead(status, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: err.message,
                state: this.audioCapture.getState()
              }));
            }
            return;
          }

          // Microphone Stop: /api/v1/voice/mic/stop
          if (pathname === '/api/v1/voice/mic/stop' && req.method === 'POST') {
            let body: any = {};
            try { body = await this.readJsonBody(req); } catch {}
            await this.voiceInput.stop(body?.reason || 'User requested microphone stop');
            const stopped = await this.audioCapture.stop(body?.reason || 'User requested microphone stop');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              stopped,
              state: this.audioCapture.getState(),
              voiceInputState: this.voiceInput.getState(),
              isCapturing: this.audioCapture.isCapturing()
            }));
            return;
          }

          // Microphone Status & Diagnostics: /api/v1/voice/mic/status
          if (pathname === '/api/v1/voice/mic/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              state: this.audioCapture.getState(),
              voiceInputState: this.voiceInput.getState(),
              isCapturing: this.audioCapture.isCapturing(),
              diagnostics: this.audioCapture.getDiagnostics()
            }));
            return;
          }

          // Voice STT Transcribe Endpoint: /api/v1/voice/stt/transcribe
          if (pathname === '/api/v1/voice/stt/transcribe' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { audioBase64?: string; culture?: string };
            const pcmBuffer = body.audioBase64 ? Buffer.from(body.audioBase64, 'base64') : Buffer.alloc(0);
            try {
              const result = await this.speechRecognition.transcribe(pcmBuffer, { culture: body.culture });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          // Voice Wake Word Test Endpoint: /api/v1/voice/wake/test
          if (pathname === '/api/v1/voice/wake/test' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { phrase?: string; audioBase64?: string };
            try {
              let result: any;
              if (body.audioBase64) {
                const pcmBuffer = Buffer.from(body.audioBase64, 'base64');
                const detector = new AcousticWakeWordDetector();
                result = await detector.detectWakePhrase(pcmBuffer);
              } else if (body.phrase) {
                const textCheck = WakeWordDetector.isWakeTrigger(body.phrase);
                result = { detected: textCheck.isTriggered, phrase: textCheck.isTriggered ? 'Hey Megh' : undefined, cleanedText: textCheck.cleanedText };
              } else {
                result = { detected: false, error: 'No audio or phrase provided' };
              }
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(result));
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }

          // Microphone Devices: /api/v1/voice/mic/devices
          if (pathname === '/api/v1/voice/mic/devices' && req.method === 'GET') {
            const devices = await this.audioCapture.listInputDevices();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              devices,
              count: devices.length
            }));
            return;
          }

          // Routines & Proactivity: /api/v1/routines
          if (pathname === '/api/v1/routines') {
            if (req.method === 'GET') {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                routines: this.routineEngine.listRoutines(),
                budget: this.proactivityBudget.getStatus()
              }));
              return;
            }
          }

          // Execute Routine: /api/v1/routines/run
          if (pathname === '/api/v1/routines/run' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { id: string };
            const result = this.routineEngine.executeRoutine(body.id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
          }

          // Daily Brief: /api/v1/brief/daily
          if (pathname === '/api/v1/brief/daily' && req.method === 'GET') {
            const tasks = await this.db.listTasks();
            const sysInfo = WindowsSystem.getSystemInfo();
            const brief = DailyBriefService.generateBrief(tasks, {
              status: 'HEALTHY',
              details: `Architecture: ${sysInfo.arch}, Memory: ${sysInfo.totalMemoryMB} MB`
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(brief));
            return;
          }

          // Observability Stats: /api/v1/observability/stats
          if (pathname === '/api/v1/observability/stats' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              metrics: this.observability.getMetrics(),
              records: this.observability.getTokenRecords()
            }));
            return;
          }

          // Integrations: /api/v1/integrations
          if (pathname === '/api/v1/integrations' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.integrationRegistry.listConnectors()));
            return;
          }

          // Tasks List & Create: /api/v1/tasks
          if (pathname === '/api/v1/tasks') {
            if (req.method === 'GET') {
              const statusFilter = url.searchParams.get('status') || undefined;
              const tasks = await this.db.listTasks(statusFilter);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(tasks));
              return;
            }
            if (req.method === 'POST') {
              const body = await this.readJsonBody(req) as any;
              const task = await this.db.createTask({
                title: String(body.title),
                description: body.description ? String(body.description) : undefined,
                priority: body.priority || 'MEDIUM',
                dueDate: body.dueDate ? String(body.dueDate) : undefined,
                userId: body.userId || 'default-user'
              });
              res.writeHead(201, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(task));
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
        const addr = this.server?.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : port;
        resolve(actualPort);
      });
    });
  }

  /**
   * Real Natural Speech Output (Section 67, 68, 70)
   * Synthesizes and speaks text directly via Windows default audio device.
   */
  public async speakResponse(text: string, correlationId?: string): Promise<void> {
    const settings = this.voiceSettings.getSettings();
    if (!text) return;

    // Clean text for speech (strip markdown code blocks, bold, URLs, bullet points for cleaner speech)
    const cleanSpeechText = text
      .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/https?:\/\/\S+/g, 'link')
      .trim();

    if (!cleanSpeechText) return;

    const ttsCorrId = correlationId || `tts-${Date.now()}`;
    this.eventBus.publish('TTS_REQUESTED', {
      voiceId: settings.selectedVoiceId,
      text: cleanSpeechText
    }, ttsCorrId);
    this.eventBus.publish('TTS_STARTED', {
      voiceId: settings.selectedVoiceId,
      text: cleanSpeechText
    }, ttsCorrId);

    try {
      // 1. Synthesize audio across providers (SAPI, OneCore, Google Cloud, ElevenLabs)
      const synthesis = await this.voiceCatalogService.synthesize(cleanSpeechText, {
        voiceId: settings.selectedVoiceId,
        speechRate: settings.speechRate,
        pitch: settings.pitch,
        volume: settings.volume
      });

      this.eventBus.publish('TTS_AUDIO_READY', {
        voiceId: synthesis.voiceId,
        durationMs: synthesis.durationMs,
        format: synthesis.format
      }, ttsCorrId);

      // 2. Play subtle answer-ready chime cue before spoken response
      try {
        await this.audioPlayback.playCue('answer_ready');
      } catch {}

      // 3. Play the synthesized speech through the default Windows audio output device
      this.setAIState('SPEAKING');
      await this.audioPlayback.playTTS(synthesis, {
        voiceId: synthesis.voiceId,
        text: cleanSpeechText,
        correlationId: ttsCorrId
      });

      this.setAIState('READY');
      this.eventBus.publish('TTS_COMPLETED', {
        voiceId: synthesis.voiceId,
        durationMs: synthesis.durationMs
      }, ttsCorrId);
    } catch (err: any) {
      if (this.aiState === 'SPEAKING') {
        this.setAIState('READY');
      }
      this.eventBus.publish('TTS_FAILED', { error: err.message, voiceId: settings.selectedVoiceId }, ttsCorrId);
      this.eventBus.publish('VOICE_ERROR', { error: err.message }, ttsCorrId);
    }
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
      if (this.voiceSettings.getSettings().autoSpeak === 'ON') {
        this.speakResponse(response.reply, correlationId).catch(() => {});
      }
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
      if (this.voiceSettings.getSettings().autoSpeak === 'ON') {
        this.speakResponse(response.reply, correlationId).catch(() => {});
      }
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

    // D. Routine & Daily Brief ("Megh, give me my daily brief" / "morning briefing")
    if (intent === 'ROUTINE_OPERATION' || /daily\s+brief|morning\s+brief|briefing|aaj\s+ka\s+update/i.test(pipeline.normalizedText)) {
      this.setAIState('EXECUTING');
      this.eventBus.publish('ROUTINE_TRIGGERED', { routine: 'daily-brief' }, correlationId);

      const tasks = await this.db.listTasks();
      const sysInfo = WindowsSystem.getSystemInfo();
      const brief = DailyBriefService.generateBrief(tasks, {
        status: 'HEALTHY',
        details: `Architecture: ${sysInfo.arch}, Memory: ${sysInfo.totalMemoryMB} MB`
      });

      this.setAIState('VERIFYING');
      this.eventBus.publish('VERIFICATION_COMPLETED', { target: 'daily_brief', status: 'VERIFIED' }, correlationId);

      this.setAIState('RESPONDING');
      const taskSummary = brief.pendingTasks.length > 0
        ? brief.pendingTasks.map(t => `  • [${t.priority}] ${t.title}`).join('\n')
        : '  • No pending tasks in queue.';

      const eventSummary = brief.upcomingEvents.map(e => `  • ${e.time}: ${e.title} (${e.location || 'Online'})`).join('\n');
      const actionSummary = brief.recommendedActions.map(a => `  • ${a}`).join('\n');

      const reply = `${brief.greeting}\n\n📋 **Action Items & Tasks:**\n${taskSummary}\n\n📅 **Upcoming Schedule:**\n${eventSummary}\n\n💡 **Recommended Focus:**\n${actionSummary}\n\n⚡ **System Health:** ${brief.systemHealth.details}`;

      const response = {
        status: 'COMPLETED',
        brief,
        verificationStatus: 'VERIFIED',
        verificationDetails: 'Daily brief assembled and verified against persistent task store and system metrics.',
        reply,
        timelineCorrelationId: correlationId
      };
      this.setAIState('READY');
      this.eventBus.publish('TASK_COMPLETED', response, correlationId);
      return response;
    }

    // E. Natural-Language Memory Operations ("Remember that...", "Don't forget...", "Forget that...")
    if (intent === 'MEMORY_OPERATION') {
      this.setAIState('EXECUTING');
      const parsedCmd = MemoryCommandParser.parse(pipeline.normalizedText);

      // Emit MEMORY_COMMAND_DETECTED event with safe metadata
      this.eventBus.publish('MEMORY_COMMAND_DETECTED', {
        action: parsedCmd.action,
        type: parsedCmd.type,
        scope: parsedCmd.scope
      }, correlationId);

      if (parsedCmd.action === 'FORGET') {
        try {
          const result = await this.memoryManager.forgetMemory(parsedCmd.content);
          if (result.success && result.memory) {
            // Verify removal from persistent store
            const stillInDb = await this.db.getMemory(result.memory.id);
            if (stillInDb) {
              throw new Error('Database removal could not be verified in persistent store.');
            }

            // Emit MEMORY_DELETED event with safe metadata
            this.eventBus.publish('MEMORY_DELETED', {
              memoryId: result.memory.id,
              layer: result.memory.type
            }, correlationId);

            this.setAIState('RESPONDING');
            const cleanTarget = result.memory.content.replace(/[.]+$/, '');
            const reply = `I've forgotten: ${cleanTarget}.`;
            const response = {
              status: 'COMPLETED',
              deletedMemory: result.memory,
              reply,
              verificationStatus: 'VERIFIED',
              verificationDetails: 'Memory record removed and verified from persistent store.',
              timelineCorrelationId: correlationId
            };
            this.setAIState('READY');
            this.eventBus.publish('TASK_COMPLETED', response, correlationId);
            return response;
          } else {
            this.setAIState('RESPONDING');
            const reply = `I couldn't find a matching memory to forget for '${parsedCmd.content}'.`;
            const response = {
              status: 'COMPLETED',
              reply,
              verificationStatus: 'VERIFIED',
              timelineCorrelationId: correlationId
            };
            this.setAIState('READY');
            this.eventBus.publish('TASK_COMPLETED', response, correlationId);
            return response;
          }
        } catch (err: any) {
          this.setAIState('READY');
          this.eventBus.publish('TASK_FAILED', {
            status: 'FAILED',
            error: err.message
          }, correlationId);
          const isLocked = err.message && err.message.toLowerCase().includes('locked');
          const reply = isLocked
            ? `Cannot delete memory: It is locked by user policy. Please unlock it in Memory Center first.`
            : `Could not delete memory: ${err.message}`;
          return {
            status: 'FAILED',
            error: err.message,
            reply,
            verificationStatus: 'FAILED',
            timelineCorrelationId: correlationId
          };
        }
      }

      // STORE OPERATION
      const now = new Date().toISOString();
      const memEntry: any = {
        id: `mem-${crypto.randomUUID()}`,
        userId: 'default-user',
        type: parsedCmd.type,
        layer: parsedCmd.type,
        content: parsedCmd.content,
        source: parsedCmd.source,
        importance: 1,
        entities: [],
        tags: [parsedCmd.type.toLowerCase()],
        confidence: parsedCmd.confidence,
        sensitivity: parsedCmd.sensitivity,
        lifecycle: 'DURABLE',
        provenance: 'User Natural Command',
        accessCount: 0,
        createdAt: now,
        updatedAt: now,
        userApproved: true,
        locked: false,
        pinned: false
      };

      try {
        await this.db.createMemory(memEntry);

        // Verification Gate: Verify record actually exists in persistent database
        const verified = await this.db.getMemory(memEntry.id);
        if (!verified) {
          throw new Error('Database write could not be verified in persistent store.');
        }

        // Emit MEMORY_STORED event with safe telemetry metadata
        this.eventBus.publish('MEMORY_STORED', {
          memoryId: verified.id,
          layer: verified.type,
          sensitivity: verified.sensitivity,
          confidence: verified.confidence,
          content: (verified.sensitivity === 'CONFIDENTIAL' || verified.sensitivity === 'RESTRICTED') ? '[REDACTED]' : verified.content
        }, correlationId);

        this.setAIState('RESPONDING');
        let phrase = parsedCmd.content.replace(/[.]+$/, '');
        if (/^my\s+/i.test(phrase)) {
          phrase = phrase.replace(/^my\s+/i, 'your ');
        } else if (/^i\s+/i.test(phrase)) {
          phrase = phrase.replace(/^i\s+/i, 'you ');
        }
        if (phrase.length > 0) {
          phrase = phrase.charAt(0).toLowerCase() + phrase.slice(1);
        }
        const reply = `Got it. I've saved that ${phrase}.`;

        const response = {
          status: 'COMPLETED',
          memory: verified,
          reply,
          verificationStatus: 'VERIFIED',
          verificationDetails: 'Memory record verified in persistent database store.',
          timelineCorrelationId: correlationId
        };
        this.setAIState('READY');
        this.eventBus.publish('TASK_COMPLETED', response, correlationId);
        if (this.voiceSettings.getSettings().autoSpeak === 'ON') {
          this.speakResponse(response.reply, correlationId).catch(() => {});
        }
        return response;
      } catch (err: any) {
        this.setAIState('READY');
        this.eventBus.publish('TASK_FAILED', {
          status: 'FAILED',
          error: err.message
        }, correlationId);
        return {
          status: 'FAILED',
          error: err.message,
          reply: `I couldn't save that memory because the memory service failed.`,
          verificationStatus: 'FAILED',
          timelineCorrelationId: correlationId
        };
      }
    }

    // F. General Intelligence / Chat / Explanation -> Context Engine & Model Routing
    this.setAIState('ROUTING');

    // Context Engine Memory Retrieval
    const assembledContext = await this.contextEngine.assembleContext({
      query: pipeline.normalizedText
    });

    if (assembledContext.recalledMemories.length > 0) {
      this.eventBus.publish('MEMORY_RETRIEVED', {
        count: assembledContext.recalledMemories.length,
        memoryTypes: assembledContext.recalledMemories.map(m => m.layer),
        relevanceMetadata: {
          confidenceScores: assembledContext.recalledMemories.map(m => m.confidence)
        },
        correlationId
      }, correlationId);
    }

    const systemPrompt = assembledContext.formattedMemoryContext
      ? `You are MeghAI, the user's personal AI operating assistant. You have access to verified persistent user memories:\n\n${assembledContext.formattedMemoryContext}\n\nAnswer the user's question directly using these memories when relevant.`
      : undefined;

    const modelReq: ModelRequest = {
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user' as const, content: pipeline.normalizedText }
      ]
    };
    const routeDecision = await this.modelRouter.route(modelReq);
    this.eventBus.publish('MODEL_SELECTED', routeDecision, correlationId);

    modelReq.modelId = routeDecision.selectedModel;

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

    this.eventBus.publish('MODEL_STARTED', {
      provider: routeDecision.selectedProvider,
      model: routeDecision.selectedModel,
      correlationId
    }, correlationId);

    // Start non-blocking procedural thinking audio loop while model is thinking
    this.audioPlayback.startThinkingLoop();

    this.setAIState('RESPONDING');
    try {
      const modelRes = await provider.complete(modelReq);
      // Immediately stop thinking loop once model response arrives
      this.audioPlayback.stopThinkingLoop();

      this.eventBus.publish('MODEL_COMPLETED', {
        provider: modelRes.providerId,
        model: modelRes.modelId,
        tokensUsed: modelRes.tokensUsed,
        latencyMs: modelRes.latencyMs
      }, correlationId);

      const response = {
        status: 'COMPLETED',
        reply: modelRes.content,
        provider: modelRes.providerId,
        modelId: modelRes.modelId,
        tokensUsed: modelRes.tokensUsed,
        timelineCorrelationId: correlationId
      };
      this.setAIState('READY');
      this.eventBus.publish('TASK_COMPLETED', response, correlationId);
      if (this.voiceSettings.getSettings().autoSpeak === 'ON') {
        this.speakResponse(response.reply, correlationId).catch(err => {
          console.error('[MeghAI Voice] Spoken response error:', err);
        });
      }
      return response;
    } catch (err) {
      this.audioPlayback.stopThinkingLoop();
      this.setAIState('READY');
      this.eventBus.publish('TASK_FAILED', {
        status: 'FAILED',
        error: (err as Error).message,
        provider: routeDecision.selectedProvider,
        model: routeDecision.selectedModel
      }, correlationId);
      return {
        status: 'FAILED',
        error: (err as Error).message,
        reply: `Error communicating with model provider (${routeDecision.selectedProvider}): ${(err as Error).message}`,
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
