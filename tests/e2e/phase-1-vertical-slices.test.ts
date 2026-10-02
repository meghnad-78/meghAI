import { describe, it, expect, beforeEach } from 'vitest';
import { ModelRouter, MultiModelExecutionEngine } from '@meghai/model-router';
import { MultiAgentOrchestrator } from '@meghai/agents';
import { TaskPlanner, WorkspaceManager, TaskContinuityStore } from '@meghai/planner';
import { ToolRuntime } from '@meghai/tool-runtime';
import { ToolRegistry } from '@meghai/tool-registry';
import { PermissionBroker } from '@meghai/permissions';
import { MeghAIDatabase } from '@meghai/database';
import { MemoryManager, ContextEngine } from '@meghai/memory';
import { RAGPipeline } from '@meghai/rag';
import { ScreenAwarenessEngine } from '@meghai/vision';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

describe('MeghAI Phase 1 Vertical Slices (End-to-End)', () => {
  let db: MeghAIDatabase;
  let permissionBroker: PermissionBroker;
  let toolRegistry: ToolRegistry;
  let toolRuntime: ToolRuntime;
  let orchestrator: MultiAgentOrchestrator;
  let modelRouter: ModelRouter;
  let memoryManager: MemoryManager;
  let contextEngine: ContextEngine;
  let ragPipeline: RAGPipeline;
  let workspaceManager: WorkspaceManager;
  let continuityStore: TaskContinuityStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `meghai-p1-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tempDir, { recursive: true });

    db = new MeghAIDatabase(tempDir);
    permissionBroker = new PermissionBroker([tempDir]);
    toolRegistry = new ToolRegistry();
    toolRuntime = new ToolRuntime(toolRegistry, permissionBroker);
    orchestrator = new MultiAgentOrchestrator();
    modelRouter = new ModelRouter();
    memoryManager = new MemoryManager(db);
    contextEngine = new ContextEngine(memoryManager, permissionBroker);
    ragPipeline = new RAGPipeline();
    workspaceManager = new WorkspaceManager();
    continuityStore = new TaskContinuityStore();
  });

  // =========================================================================
  // SLICE A: "Megh, analyze this screen and explain the error."
  // =========================================================================
  it('SLICE A: Screen Analysis, OCR Error Extraction, and Fix Proposal', async () => {
    // 1. User grants screen permission
    permissionBroker.grant('SCREEN', 'ALLOWED');

    // 2. Vision Engine analyzes screen with active window & OCR text
    const screenResult = await ScreenAwarenessEngine.analyzeScreen(permissionBroker, {
      activeApp: 'Code.exe',
      activeWindowTitle: 'VS Code - MeghAI Voice Module',
      mockOcrText: `TypeError: Cannot read properties of undefined (reading 'toLowerCase')
    at VoiceCatalog.listVoices (packages/voice/src/index.ts:38:43)
    at tests/integration/voice-catalog.test.ts:23:33`
    });

    // 3. Verify real diagnostic outcome
    expect(screenResult.captureId).toBeDefined();
    expect(screenResult.activeApp).toBe('Code.exe');
    expect(screenResult.detectedErrors.length).toBe(1);
    expect(screenResult.detectedErrors[0].type).toBe('TypeError');
    expect(screenResult.visualExplanation).toContain('TypeError');
    expect(screenResult.proposedFix).toContain('optional chaining');
    expect(screenResult.isEphemeral).toBe(true); // Temporary screenshot memory discarded after analysis
  });

  // =========================================================================
  // SLICE B: "Megh, find information in these documents and summarize it."
  // =========================================================================
  it('SLICE B: RAG Document Retrieval, Untrusted Fencing, and Context Summarization', async () => {
    // 1. Ingest project documentation into RAG
    ragPipeline.ingestDocument(
      'arch_spec.md',
      'MeghAI uses an unbypassable 11-step tool execution pipeline. Resource locks prevent conflicting agent access.'
    );
    ragPipeline.ingestDocument(
      'security_model.md',
      'The LLM is not the operating system. Models only propose actions; policy authorizes and runtime executes.'
    );

    // 2. User query triggers hybrid retrieval
    const retrieved = ragPipeline.search('unbypassable tool execution pipeline');
    expect(retrieved.length).toBeGreaterThan(0);
    expect(retrieved[0].source).toBe('arch_spec.md');

    // 3. Context engine assembles context for summarization
    const assembled = await contextEngine.assembleContext({
      query: 'summarize tool execution architecture',
      activeWorkspace: 'MeghAI Core Architecture'
    });

    expect(assembled.activeWorkspace).toBe('MeghAI Core Architecture');
    expect(assembled.tokenEstimate).toBeGreaterThan(0);
  });

  // =========================================================================
  // SLICE C: "Megh, research this topic and verify the findings."
  // =========================================================================
  it('SLICE C: Multi-Agent Research, Citation Gathering, and Truthful Outcome Verification', async () => {
    const plan = TaskPlanner.createCompoundPlan('Research quantum encryption and verify claims', [
      {
        description: 'Gather facts on quantum key distribution',
        agent: 'ResearchAgent',
        tools: ['web_search']
      },
      {
        description: 'Verify facts and assert proof receipt',
        agent: 'VerifierAgent',
        tools: ['verify_outcome'],
        dependencies: ['step-1']
      }
    ]);

    const result = await orchestrator.executePlan(plan, {
      runtime: toolRuntime,
      userConfirmed: true
    });

    expect(result.status).toBe('COMPLETED');

    const step1 = result.getNode('step-1');
    expect(step1?.status).toBe('COMPLETED');
    expect((step1?.output as any).sources.length).toBeGreaterThan(0);

    const step2 = result.getNode('step-2');
    expect(step2?.status).toBe('COMPLETED');
    expect((step2?.output as any).verified).toBe(true);
    expect((step2?.output as any).status).toBe('VERIFIED');
    expect((step2?.output as any).proof).toContain('sha256-verified-outcome');
  });

  // =========================================================================
  // SLICE D: "Megh, continue my unfinished project task."
  // =========================================================================
  it('SLICE D: Task Continuity across Restarts and Workspace Association', async () => {
    // 1. Create a workspace
    const ws = workspaceManager.createWorkspace('Infra Refactor', 'Deploy monitoring stack');

    // 2. Initialize plan with 2 steps
    const plan = TaskPlanner.createCompoundPlan('Deploy prometheus monitoring', [
      { description: 'Write prometheus config', agent: 'CodingAgent', tools: ['file_write'] },
      { description: 'Verify service status', agent: 'VerifierAgent', tools: ['verify_outcome'] }
    ], ws.id);

    // 3. Step 1 completes, Step 2 is still pending
    plan.markNodeCompleted('step-1', { status: 'CONFIG_WRITTEN' });
    workspaceManager.attachTask(ws.id, plan.id);
    continuityStore.savePlan(plan);

    // 4. System / Session resumes: find unfinished task
    const recoveredPlan = continuityStore.findUnfinishedTask('prometheus');
    expect(recoveredPlan).toBeDefined();
    expect(recoveredPlan?.id).toBe(plan.id);

    // Step 2 is now ready for execution
    const readyNodes = recoveredPlan!.getExecutableNodes();
    expect(readyNodes.length).toBe(1);
    expect(readyNodes[0].id).toBe('step-2');

    // 5. Complete recovered plan
    const completedPlan = await orchestrator.executePlan(recoveredPlan!, {
      runtime: toolRuntime,
      userConfirmed: true
    });

    expect(completedPlan.status).toBe('COMPLETED');
    expect(completedPlan.getNode('step-2')?.status).toBe('COMPLETED');
  });

  // =========================================================================
  // SLICE E: "Megh, solve this coding problem in my project." (Multi-Model Orchestration)
  // =========================================================================
  it('SLICE E: Multi-Model Orchestration for Coding Problem Solving', async () => {
    const multiModelEngine = modelRouter.getExecutionEngine();

    // Pipeline exercises specialized models: Planner -> Reasoning/Coding -> Verifier -> Synthesis
    const multiModelResult = await multiModelEngine.executePipeline(
      'Fix null pointer exception in voice catalog filtering',
      [
        {
          role: 'PLANNER',
          prompt: 'Decompose code fix into reproduction, patch, and regression test steps'
        },
        {
          role: 'REASONING',
          prompt: 'Apply optional chaining check on v.language in VoiceCatalog.listVoices'
        },
        {
          role: 'VERIFIER',
          prompt: 'Confirm TypeScript types and verify test case pass rate'
        },
        {
          role: 'SYNTHESIZER',
          prompt: 'Generate concise resolution summary for the user'
        }
      ]
    );

    expect(multiModelResult.success).toBe(true);
    expect(multiModelResult.complexity).toBe('MULTI_MODEL');
    expect(multiModelResult.steps.length).toBe(4);

    // Telemetry assertions
    expect(multiModelResult.totalLatencyMs).toBeGreaterThan(0);
    expect(multiModelResult.totalCostUSD).toBeGreaterThanOrEqual(0);

    const rolesExecuted = multiModelResult.steps.map(s => s.role);
    expect(rolesExecuted).toEqual(['PLANNER', 'REASONING', 'VERIFIER', 'SYNTHESIZER']);

    expect(multiModelResult.finalSynthesis).toBeDefined();
  });
});
