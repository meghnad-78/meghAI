import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { EventBus } from '@meghai/events';
import { MeghAIDatabase } from '@meghai/database';
import { PermissionBroker } from '@meghai/permissions';
import { KillSwitch } from '@meghai/security';
import { ToolRegistry } from '@meghai/tool-registry';
import { ToolRuntime } from '@meghai/tool-runtime';
import { ActionOrchestrator } from '@meghai/planner';
import { MeghAIServer } from '../../apps/api/src/server.js';

describe('MeghAI KillSwitch Complete Lifecycle & Safe Reset Suite (Section 8)', () => {
  let db: MeghAIDatabase;
  let eventBus: EventBus;
  let toolRegistry: ToolRegistry;
  let permissionBroker: PermissionBroker;
  let toolRuntime: ToolRuntime;
  let orchestrator: ActionOrchestrator;
  let tempDir: string;
  let server: MeghAIServer;
  let serverPort: number;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `meghai_ks_lifecycle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tempDir, { recursive: true });

    db = new MeghAIDatabase(path.join(tempDir, 'test.db'));
    eventBus = new EventBus();
    toolRegistry = new ToolRegistry();
    permissionBroker = new PermissionBroker();
    toolRuntime = new ToolRuntime(toolRegistry, permissionBroker, db);
    orchestrator = new ActionOrchestrator(toolRegistry, toolRuntime, permissionBroker, eventBus, db);

    KillSwitch.reset();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    KillSwitch.reset();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // Test 1: STOP activates KillSwitch
  it('1. STOP activates KillSwitch immediately', () => {
    expect(KillSwitch.isActive()).toBe(false);
    const result = KillSwitch.stopMegh('Emergency Test Stop');
    expect(KillSwitch.isActive()).toBe(true);
    expect(result).toBeDefined();
  });

  // Test 2: Tool execution is blocked while active
  it('2. Tool execution is blocked while active', async () => {
    KillSwitch.stopMegh('Halt for test');
    expect(KillSwitch.isActive()).toBe(true);

    const res = await toolRuntime.execute({
      id: 'test-call-1',
      toolName: 'notes.create',
      arguments: { title: 'Test', content: 'Blocked note' }
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Emergency Kill Switch (STOP MEGH) is currently active');
  });

  // Test 3: Restart initializes KillSwitch inactive
  it('3. Restart initializes KillSwitch inactive', async () => {
    // Simulate active kill switch before restart
    KillSwitch.stopMegh('Previous session stop');
    expect(KillSwitch.isActive()).toBe(true);

    // Boot a fresh server instance
    const bootDir = path.join(tempDir, 'boot_test');
    await fs.mkdir(bootDir, { recursive: true });
    const freshServer = new MeghAIServer(bootDir);
    expect(freshServer.getAIState()).toBe('READY');
    expect(KillSwitch.isActive()).toBe(false);
  });

  // Test 4: Reset clears active state
  it('4. Reset clears active state', () => {
    KillSwitch.stopMegh('Trigger stop');
    expect(KillSwitch.isActive()).toBe(true);

    const resetResult = KillSwitch.reset('User requested resume');
    expect(KillSwitch.isActive()).toBe(false);
    expect(resetResult.status).toBe('RESET');
    expect(resetResult.active).toBe(false);
    expect(resetResult.success).toBe(true);
  });

  // Test 5: Reset does not resume cancelled actions
  it('5. Reset does not resume cancelled actions', async () => {
    const plan = await orchestrator.generatePlan('open Calculator', 'req-test-5', 'USER');
    expect(plan.steps.length).toBeGreaterThan(0);

    // Trigger kill switch
    KillSwitch.stopMegh('Halt action');
    const execution = await orchestrator.executePlan(plan);
    expect(execution.status).toBe('FAILED');
    expect(execution.state).toBe('CANCELLED');

    // Reset kill switch
    KillSwitch.reset();
    expect(KillSwitch.isActive()).toBe(false);

    // Cancelled plan must remain cancelled in history, NOT automatically run
    expect(plan.status).toBe('CANCELLED');
    const catalogPlan = orchestrator.getPlan(plan.planId);
    expect(catalogPlan?.status).toBe('CANCELLED');
  });

  // Test 6: New action works after reset
  it('6. New action works after reset', async () => {
    // 1. Trigger kill switch
    KillSwitch.stopMegh('Emergency test');
    expect(KillSwitch.isActive()).toBe(true);

    // 2. Clear kill switch
    KillSwitch.reset();
    expect(KillSwitch.isActive()).toBe(false);

    // 3. Issue a fresh action command
    const result = await orchestrator.process('create a note titled PostReset with content It works');
    expect(result.status).toBe('SUCCEEDED');
    expect(result.reply).toContain('PostReset');
  });

  // Test 7: Frontend state becomes READY after reset
  it('7. Frontend state becomes READY after reset', async () => {
    const srvDir = path.join(tempDir, 'srv_test_7');
    await fs.mkdir(srvDir, { recursive: true });
    server = new MeghAIServer(srvDir);
    await server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });

    // Activate kill
    KillSwitch.stopMegh('Stopping');
    expect(server.getAIState()).toBe('STOPPED');

    // Reset kill switch
    KillSwitch.reset('Resuming');
    expect(server.getAIState()).toBe('READY');
  });

  // Test 8: SPEAKING cannot remain active after KillSwitch
  it('8. SPEAKING cannot remain active after KillSwitch', async () => {
    const srvDir = path.join(tempDir, 'srv_test_8');
    await fs.mkdir(srvDir, { recursive: true });
    server = new MeghAIServer(srvDir);
    await server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });

    // Manually transition to SPEAKING
    server.setAIState('SPEAKING');
    expect(server.getAIState()).toBe('SPEAKING');

    // Trigger kill switch
    KillSwitch.stopMegh('Emergency interrupt');
    expect(server.getAIState()).toBe('STOPPED');

    // Attempting to speak while active is blocked
    await server.speakResponse('This should never speak');
    expect(server.getAIState()).not.toBe('SPEAKING');
    expect(server.getAIState()).toBe('STOPPED');
  });

  // Test 9: Existing active actions are cancelled on STOP
  it('9. Existing active actions are cancelled on STOP', () => {
    let controllerAborted = false;
    let processKilled = false;

    const controller = new AbortController();
    controller.signal.addEventListener('abort', () => {
      controllerAborted = true;
    });
    KillSwitch.registerAbortController(controller);

    KillSwitch.registerProcess({
      pid: 9999,
      kill: () => {
        processKilled = true;
      }
    });

    const stopResult = KillSwitch.stopMegh('Cancelling all active actions');
    expect(controllerAborted).toBe(true);
    expect(processKilled).toBe(true);
    expect(stopResult.cancelledControllers).toBe(1);
    expect(stopResult.killedProcesses).toBe(1);
  });

  // Test 10: KillSwitch still overrides autonomous permissions
  it('10. KillSwitch still overrides autonomous permissions', async () => {
    permissionBroker.setAutonomyLevel('FULL_SAFE_AUTOMATION');

    // Pre-check tool evaluation
    const evalResult = permissionBroker.evaluateAction('windows.open_app', 'notepad');
    expect(evalResult.decision).toBe('ALLOW');

    // Activate kill switch
    KillSwitch.stopMegh('Safety lock');

    // Execute tool
    const execResult = await toolRuntime.execute({
      id: 'call-auto-1',
      toolName: 'windows.open_app',
      arguments: { appName: 'notepad' }
    });

    expect(execResult.success).toBe(false);
    expect(execResult.error).toContain('Emergency Kill Switch (STOP MEGH) is currently active');
  });

  // Test 11: KillSwitch still overrides high/low-risk actions
  it('11. KillSwitch still overrides high/low-risk actions', async () => {
    KillSwitch.stopMegh('Emergency test');

    // Low risk action (read note)
    const lowRiskRes = await toolRuntime.execute({
      id: 'call-low-1',
      toolName: 'notes.read',
      arguments: { id: 'any' }
    });
    expect(lowRiskRes.success).toBe(false);
    expect(lowRiskRes.error).toContain('Emergency Kill Switch');

    // High risk action (delete note)
    const highRiskRes = await toolRuntime.execute({
      id: 'call-high-1',
      toolName: 'notes.delete',
      arguments: { id: 'any' },
      userConfirmed: true
    });
    expect(highRiskRes.success).toBe(false);
    expect(highRiskRes.error).toContain('Emergency Kill Switch');
  });

  // Test 12: "Resume Megh" resets KillSwitch
  it('12. "Resume Megh" resets KillSwitch', async () => {
    const srvDir = path.join(tempDir, 'srv_test_12');
    await fs.mkdir(srvDir, { recursive: true });
    server = new MeghAIServer(srvDir);
    await server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });

    // Put into emergency stop
    KillSwitch.stopMegh('User triggered stop');
    expect(KillSwitch.isActive()).toBe(true);
    expect(server.getAIState()).toBe('STOPPED');

    // Voice / natural language reset command
    const res = await server.processUserRequest('Resume Megh');
    expect(KillSwitch.isActive()).toBe(false);
    expect(server.getAIState()).toBe('READY');
    expect(res.reply).toContain('Emergency stop cleared');
  });

  // Test 13: Ordinary commands cannot reset KillSwitch
  it('13. Ordinary commands cannot reset KillSwitch', async () => {
    const srvDir = path.join(tempDir, 'srv_test_13');
    await fs.mkdir(srvDir, { recursive: true });
    server = new MeghAIServer(srvDir);
    await server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });

    KillSwitch.stopMegh('User triggered stop');
    expect(KillSwitch.isActive()).toBe(true);

    // Ordinary command
    const res = await server.processUserRequest('Open Chrome');
    expect(KillSwitch.isActive()).toBe(true);
    expect(server.getAIState()).toBe('STOPPED');
    expect(res.status).toBe('FAILED');
    expect(res.error).toContain('Emergency Kill Switch (STOP MEGH) is currently active');
  });

  // Test 14: Reset endpoint returns correct state
  it('14. Reset endpoint returns correct state', async () => {
    const srvDir = path.join(tempDir, 'srv_test_14');
    await fs.mkdir(srvDir, { recursive: true });
    server = new MeghAIServer(srvDir);
    await server.voiceSettings.updateSettings({ autoSpeak: 'OFF' });
    serverPort = await server.start(4925);

    // Stop via API
    const killRes = await fetch(`http://localhost:${serverPort}/api/v1/system/kill`, { method: 'POST' });
    const killData = await killRes.json() as any;
    expect(killData.success).toBe(true);
    expect(killData.active).toBe(true);
    expect(KillSwitch.isActive()).toBe(true);

    // Reset via POST /api/v1/system/kill/reset
    const resetRes = await fetch(`http://localhost:${serverPort}/api/v1/system/kill/reset`, { method: 'POST' });
    const resetData = await resetRes.json() as any;
    expect(resetData).toEqual({
      success: true,
      active: false,
      status: 'RESET',
      aiState: 'READY'
    });
    expect(KillSwitch.isActive()).toBe(false);
  });

  // Test 15: Duplicate reset calls are idempotent
  it('15. Duplicate reset calls are idempotent', () => {
    // First reset
    const r1 = KillSwitch.reset('Reset 1');
    expect(r1.success).toBe(true);
    expect(r1.active).toBe(false);
    expect(r1.status).toBe('RESET');
    expect(KillSwitch.isActive()).toBe(false);

    // Duplicate reset while already inactive
    const r2 = KillSwitch.reset('Reset 2');
    expect(r2.success).toBe(true);
    expect(r2.active).toBe(false);
    expect(r2.status).toBe('RESET');
    expect(KillSwitch.isActive()).toBe(false);
  });
});
