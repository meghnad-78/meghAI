import { describe, it, expect } from 'vitest';
import { MultiAgentOrchestrator, ResearchAgent, VerifierAgent } from '../../packages/agents/src/index';
import { TaskExecutionPlan } from '../../packages/planner/src/index';
import { ToolRuntime } from '../../packages/tool-runtime/src/index';
import { ToolRegistry } from '../../packages/tool-registry/src/index';
import { PermissionBroker } from '../../packages/permissions/src/index';

describe('MultiAgentOrchestrator Integration', () => {
  it('executes a multi-agent DAG with dependent research and verification steps', async () => {
    const orchestrator = new MultiAgentOrchestrator();
    const registry = new ToolRegistry();
    const permissions = new PermissionBroker();
    const runtime = new ToolRuntime(registry, permissions);

    const plan = new TaskExecutionPlan('Research and verify topic', [
      {
        id: 'node-1',
        description: 'Research quantum computing basics',
        type: 'RESEARCH',
        dependencies: [],
        agent: 'ResearchAgent',
        requiredTools: [],
        riskLevel: 'LOW',
        inputs: { query: 'quantum computing' },
        status: 'QUEUED',
        retriesRemaining: 1,
      },
      {
        id: 'node-2',
        description: 'Verify research summary accuracy',
        type: 'VERIFY',
        dependencies: ['node-1'],
        agent: 'VerifierAgent',
        requiredTools: [],
        riskLevel: 'LOW',
        inputs: { target: 'quantum research report' },
        status: 'QUEUED',
        retriesRemaining: 1,
      },
    ]);

    const completedPlan = await orchestrator.executePlan(plan, {
      runtime,
      userConfirmed: true,
    });

    expect(completedPlan.status).toBe('COMPLETED');

    const node1 = completedPlan.getNode('node-1');
    expect(node1?.status).toBe('COMPLETED');
    expect((node1?.output as any).topic).toBe('quantum computing');

    const node2 = completedPlan.getNode('node-2');
    expect(node2?.status).toBe('COMPLETED');
    expect((node2?.output as any).verified).toBe(true);
  });
});
