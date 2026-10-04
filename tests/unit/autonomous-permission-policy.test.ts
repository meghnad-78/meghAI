import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { EventBus } from '@meghai/events';
import { MeghAIDatabase } from '@meghai/database';
import { PermissionBroker } from '@meghai/permissions';
import { PathValidator, KillSwitch } from '@meghai/security';
import { ToolRegistry } from '@meghai/tool-registry';
import { ToolRuntime } from '@meghai/tool-runtime';
import { ActionOrchestrator } from '@meghai/planner';

describe('MEGHAI v0.4.1 — Autonomous Permission Policy Suite (18 Critical Invariants)', () => {
  let db: MeghAIDatabase;
  let eventBus: EventBus;
  let toolRegistry: ToolRegistry;
  let permissionBroker: PermissionBroker;
  let toolRuntime: ToolRuntime;
  let orchestrator: ActionOrchestrator;
  let tempDir: string;
  let persistenceFile: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `meghai_autonomy_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tempDir, { recursive: true });
    persistenceFile = path.join(tempDir, 'persistent-permissions.json');

    db = new MeghAIDatabase(path.join(tempDir, 'test.db'));
    eventBus = new EventBus();
    toolRegistry = new ToolRegistry();
    permissionBroker = new PermissionBroker(undefined, persistenceFile);
    toolRuntime = new ToolRuntime(toolRegistry, permissionBroker, db);
    orchestrator = new ActionOrchestrator(toolRegistry, toolRuntime, permissionBroker, eventBus, db);

    KillSwitch.reset();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // Test 1: Open Calculator requires no prompt
  it('1. Open Calculator requires no prompt (auto-allows windows.open_app)', async () => {
    const decision = await permissionBroker.evaluateAction('windows.open_app', 'Calculator');
    expect(decision.decision).toBe('ALLOW');
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.reason).toContain('DEFAULT_AUTO_ALLOW');
  });

  // Test 2: Open Chrome requires no prompt
  it('2. Open Chrome requires no prompt (auto-allows windows.open_app)', async () => {
    const decision = await permissionBroker.evaluateAction('windows.open_app', 'chrome');
    expect(decision.decision).toBe('ALLOW');
    expect(decision.requiresConfirmation).toBe(false);
  });

  // Test 3: Search web requires no prompt
  it('3. Search web requires no prompt (auto-allows browser.search and browser.open_url)', async () => {
    const decision = await permissionBroker.evaluateAction('browser.search', 'https://www.google.com/search?q=test');
    expect(decision.decision).toBe('ALLOW');
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.reason).toContain('DEFAULT_AUTO_ALLOW');
  });

  // Test 4: Read Documents file requires no prompt
  it('4. Read Documents file requires no prompt (read-only safe tool in approved root)', async () => {
    const docFile = path.join(os.homedir(), 'Documents', 'report.txt');
    const decision = await permissionBroker.evaluateAction('windows.read_file', docFile);
    expect(decision.decision).toBe('ALLOW');
    expect(decision.requiresConfirmation).toBe(false);
  });

  // Test 5: Create Documents file requires no prompt
  it('5. Create Documents file requires no prompt (trusted scope reversible filesystem operation)', async () => {
    const docFile = path.join(os.homedir(), 'Documents', 'notes.txt');
    const decision = await permissionBroker.evaluateAction('windows.create_file', docFile);
    expect(decision.decision).toBe('ALLOW');
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.reason).toContain('TRUSTED_SCOPE');
  });

  // Test 6: Move Documents file requires no prompt
  it('6. Move Documents file requires no prompt (trusted scope operation inside user root)', async () => {
    const source = path.join(os.homedir(), 'Documents', 'old.txt');
    const target = path.join(os.homedir(), 'Documents', 'new.txt');
    const decision = await permissionBroker.evaluateAction('windows.move_file', `${source} -> ${target}`);
    expect(decision.decision).toBe('ALLOW');
    expect(decision.requiresConfirmation).toBe(false);
  });

  // Test 7: Delete file requires confirmation
  it('7. Delete file requires confirmation (destructive operation)', async () => {
    const target = path.join(os.homedir(), 'Documents', 'important.txt');
    const decision = await permissionBroker.evaluateAction('windows.delete_file', target);
    expect(decision.decision).toBe('REQUIRE_CONFIRMATION');
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.reason).toContain('HIGH_RISK');
  });

  // Test 8: Send email requires confirmation
  it('8. Send email requires confirmation (external communication)', async () => {
    const decision = await permissionBroker.evaluateAction('email.send_email', 'colleague@example.com');
    expect(decision.decision).toBe('REQUIRE_CONFIRMATION');
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.reason).toContain('HIGH_RISK');
  });

  // Test 9: Submit form requires confirmation
  it('9. Submit form requires confirmation (external side effect)', async () => {
    const decision = await permissionBroker.evaluateAction('browser.submit_form', 'https://example.com/checkout');
    expect(decision.decision).toBe('REQUIRE_CONFIRMATION');
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.reason).toContain('HIGH_RISK');
  });

  // Test 10: Arbitrary shell command is blocked
  it('10. Arbitrary shell command is blocked (critical pattern violation)', async () => {
    const formatCmd = await permissionBroker.evaluateAction('shell.safe_execute', 'format C: /y');
    expect(formatCmd.decision).toBe('BLOCK');
    expect(formatCmd.ruleMatched).toBe('HARD_SECURITY_BLOCK');

    const rmCmd = await permissionBroker.evaluateAction('shell.safe_execute', 'powershell -c rm -rf /');
    expect(rmCmd.decision).toBe('BLOCK');
    expect(rmCmd.ruleMatched).toBe('HARD_SECURITY_BLOCK');
  });

  // Test 11: Path outside trusted roots is blocked or confirmed
  it('11. Path outside trusted roots is blocked or confirmed', async () => {
    // Protected Windows system directory is hard-blocked
    const sysPath = 'C:\\Windows\\System32\\calc.exe';
    const sysDecision = await permissionBroker.evaluateAction('windows.write_file', sysPath);
    expect(sysDecision.decision).toBe('BLOCK');
    expect(sysDecision.ruleMatched).toBe('HARD_SECURITY_BLOCK');

    // Arbitrary external path outside trusted roots requires user confirmation
    const extPath = 'D:\\external_data\\file.txt';
    const extDecision = await permissionBroker.evaluateAction('windows.write_file', extPath);
    expect(extDecision.decision).toBe('REQUIRE_CONFIRMATION');
    expect(extDecision.requiresConfirmation).toBe(true);
  });

  // Test 12: Persistent permission survives restart
  it('12. Persistent permission survives restart via disk persistence', async () => {
    // Instance 1 adds a persistent grant
    const grant = permissionBroker.addPersistentGrant('windows.delete_file', 'temp_*.txt', 'test-user');
    expect(grant.id).toBeDefined();

    // Verify written to file
    const fileExists = await fs.stat(persistenceFile).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    // Instance 2 initialized with same persistent file
    const restartedBroker = new PermissionBroker(undefined, persistenceFile);
    const grants = restartedBroker.listPersistentGrants();
    expect(grants.some(g => g.toolId === 'windows.delete_file' && g.targetPattern === 'temp_*.txt')).toBe(true);

    // Matches target
    const decision = await restartedBroker.evaluateAction('windows.delete_file', 'temp_123.txt');
    expect(decision.decision).toBe('ALLOW');
    expect(decision.ruleMatched).toBe('PERSISTENT_GRANT');
  });

  // Test 13: Session permission expires correctly
  it('13. Session permission expires correctly after durationMs', async () => {
    permissionBroker.createSessionGrant('windows.delete_file', 'scratch.txt', 50); // 50ms TTL

    // Immediately valid
    const activeDecision = await permissionBroker.evaluateAction('windows.delete_file', 'scratch.txt');
    expect(activeDecision.decision).toBe('ALLOW');
    expect(activeDecision.ruleMatched).toBe('SESSION_GRANT');

    // Wait 70ms for expiration
    await new Promise(r => setTimeout(r, 70));

    const expiredDecision = await permissionBroker.evaluateAction('windows.delete_file', 'scratch.txt');
    expect(expiredDecision.decision).toBe('REQUIRE_CONFIRMATION');
  });

  // Test 14: Deny overrides allow
  it('14. User override Deny overrides default allow rule', async () => {
    // windows.open_app is normally default allow
    permissionBroker.setUserOverride('windows.open_app', 'ALWAYS_DENY');

    const decision = await permissionBroker.evaluateAction('windows.open_app', 'Notepad');
    expect(decision.decision).toBe('BLOCK');
    expect(decision.reason).toContain('USER_OVERRIDE_DENY');
  });

  // Test 15: KillSwitch overrides autonomous execution
  it('15. KillSwitch overrides autonomous execution and halts plans immediately', async () => {
    const plan = await orchestrator.generatePlan('Open Chrome and search for Java');
    expect(plan.requiresConfirmation).toBe(false);

    // Trigger KillSwitch before execution
    KillSwitch.trigger('Testing emergency stop');

    const result = await orchestrator.executePlan(plan.planId);
    expect(['FAILED', 'CANCELLED']).toContain(result.status);
    expect(result.error).toContain('KillSwitch activated');
  });

  // Test 16: Multi-step safe plan does not pause at every step
  it('16. Multi-step safe plan executes autonomously without pausing at every step', async () => {
    const plan = await orchestrator.generatePlan('Open Chrome and search for Java DSA roadmap');
    expect(plan.steps.length).toBe(2);
    expect(plan.requiresConfirmation).toBe(false);

    let confirmationPromptCount = 0;
    eventBus.subscribe('CONFIRMATION_REQUIRED', () => {
      confirmationPromptCount++;
    });

    const result = await orchestrator.executePlan(plan.planId);
    expect(['SUCCEEDED', 'COMPLETED']).toContain(result.status);
    expect(result.completedSteps).toBe(2);
    expect(confirmationPromptCount).toBe(0);
  });

  // Test 17: High-risk step correctly pauses inside an otherwise autonomous plan
  it('17. High-risk step correctly pauses inside plan and generates confirmation request', async () => {
    const plan = await orchestrator.generatePlan('Delete test.txt');
    expect(plan.requiresConfirmation).toBe(true);

    let confirmationEventFired = false;
    eventBus.subscribe('CONFIRMATION_REQUIRED', () => {
      confirmationEventFired = true;
    });

    const result = await orchestrator.executePlan(plan.planId);
    expect(result.status).toBe('WAITING_FOR_USER');
    expect(confirmationEventFired).toBe(true);

    // Create target file before resuming so delete execution succeeds cleanly
    const targetFile = plan.steps[0].arguments['filePath'] as string;
    await fs.mkdir(path.dirname(targetFile), { recursive: true });
    await fs.writeFile(targetFile, 'temporary test content', 'utf-8');

    // Resuming after user confirmation succeeds without re-asking
    const confirmResult = await orchestrator.confirmAndExecute(plan.planId, true);
    expect(['SUCCEEDED', 'COMPLETED']).toContain(confirmResult.status);
    expect(confirmResult.completedSteps).toBe(1);
  });

  // Test 18: All authorization decisions appear in ActionTimeline
  it('18. All authorization decisions emit timeline events (PERMISSION_AUTO_GRANTED)', async () => {
    const grantedEvents: any[] = [];
    eventBus.subscribe('PERMISSION_AUTO_GRANTED', (evt) => {
      grantedEvents.push(evt.payload || evt);
    });

    const plan = await orchestrator.generatePlan('Open Chrome and search for algorithms');
    await orchestrator.executePlan(plan.planId);

    expect(grantedEvents.length).toBeGreaterThanOrEqual(2);
    expect(grantedEvents[0].toolId).toBe('windows.open_app');
    expect(grantedEvents[0].policyDecision).toBe('ALLOW');
    expect(grantedEvents[1].toolId).toBe('browser.search');
  });
});
