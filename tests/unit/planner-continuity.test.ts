import { describe, it, expect } from 'vitest';
import {
  TaskPlanner,
  TaskExecutionPlan,
  WorkspaceManager,
  TaskContinuityStore
} from '../../packages/planner/src/index';

describe('Planner, Task Continuity, and Workspaces', () => {
  it('creates a workspace and attaches task plans with activity logs', () => {
    const wm = new WorkspaceManager();
    const ws = wm.createWorkspace('Project Alpha', 'Build personal AI operating layer', { repo: 'meghAI' });

    expect(ws.id).toBeDefined();
    expect(ws.status).toBe('ACTIVE');

    const plan = TaskPlanner.createCompoundPlan('Analyze code and run tests', [
      { description: 'Scan repo', agent: 'CodingAgent', tools: ['code_search'] },
      { description: 'Run test suite', agent: 'CodingAgent', tools: ['run_tests'] },
    ], ws.id);

    wm.attachTask(ws.id, plan.id);
    wm.logActivity(ws.id, 'CodingAgent', 'Scanned 70 files');
    wm.addOutput(ws.id, 'Test Summary', 'All 52 tests passed.');

    const updated = wm.getWorkspace(ws.id);
    expect(updated?.tasks).toContain(plan.id);
    expect(updated?.agentActivity.length).toBe(1);
    expect(updated?.outputs.length).toBe(1);
  });

  it('persists and recovers unfinished tasks for task continuity', () => {
    const store = new TaskContinuityStore();
    const plan = TaskPlanner.createCompoundPlan('Refactor database subsystem', [
      { description: 'Draft schema', agent: 'CodingAgent', tools: ['file_write'] },
      { description: 'Verify migration', agent: 'VerifierAgent', tools: ['verify_database_record'] },
    ]);

    plan.markNodeRunning('step-1');
    store.savePlan(plan);

    // Later: User says "Continue my unfinished project task"
    const recovered = store.findUnfinishedTask('database');
    expect(recovered).toBeDefined();
    expect(recovered?.id).toBe(plan.id);
    expect(recovered?.status).toBe('RUNNING');

    const executable = recovered!.getExecutableNodes();
    expect(executable.length).toBe(0); // step-1 is already RUNNING, step-2 depends on step-1
  });

  it('supports cancellation and node retries', () => {
    const plan = TaskPlanner.createCompoundPlan('Deploy service', [
      { description: 'Build binaries', agent: 'CodingAgent', tools: ['run_tests'] },
    ]);

    // Node fails once -> gets requeued because retriesRemaining > 0
    const node = plan.getNode('step-1')!;
    expect(node.retriesRemaining).toBe(2);

    plan.markNodeFailed('step-1', 'Network timeout');
    expect(node.retriesRemaining).toBe(1);
    expect(node.status).toBe('QUEUED'); // Requeued

    // Emergency kill switch: cancel plan
    plan.cancel();
    expect(plan.status).toBe('CANCELLED');
    expect(plan.getExecutableNodes().length).toBe(0);
  });
});
