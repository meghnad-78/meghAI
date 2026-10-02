import crypto from 'node:crypto';
import type { TaskState, RiskLevel } from '@meghai/shared-types';

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  retryOnErrors?: string[];
}

export interface VerificationPolicy {
  requireProof: boolean;
  strategy: 'FILE_HASH' | 'DB_RECORD' | 'API_RECEIPT' | 'WINDOW_STATE' | 'NONE';
  targetResource?: string;
}

export interface TaskPlanNode {
  id: string;
  description: string;
  type: string;
  dependencies: string[]; // List of parent node IDs
  agent: string;
  requiredTools: string[];
  riskLevel: RiskLevel;
  inputs: Record<string, unknown>;
  output?: unknown;
  error?: string;
  status: TaskState;
  retriesRemaining: number;
  retryPolicy?: RetryPolicy;
  verificationPolicy?: VerificationPolicy;
  timeoutMs?: number;
}

export interface AgentWorkspace {
  id: string;
  name: string;
  objective: string;
  context: Record<string, unknown>;
  files: string[];
  tasks: string[]; // TaskPlan IDs
  memories: string[];
  research: Array<{ topic: string; findings: string; sourceUrls: string[] }>;
  agentActivity: Array<{ timestamp: string; agent: string; action: string; details?: unknown }>;
  outputs: Array<{ id: string; title: string; content: string; createdAt: string }>;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
}

/**
 * Directed Acyclic Graph Execution Plan (Section 39 & Phase 1.4)
 */
export class TaskExecutionPlan {
  public id: string;
  public goal: string;
  public workspaceId?: string;
  public nodes: Map<string, TaskPlanNode> = new Map();
  public status: TaskState = 'QUEUED';
  public createdAt: string = new Date().toISOString();
  public updatedAt: string = new Date().toISOString();

  constructor(goal: string, nodes: TaskPlanNode[] = [], workspaceId?: string) {
    this.id = `plan-${crypto.randomUUID()}`;
    this.goal = goal;
    this.workspaceId = workspaceId;
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
  }

  public addNode(node: TaskPlanNode): void {
    this.nodes.set(node.id, node);
    this.updatedAt = new Date().toISOString();
  }

  public getNode(id: string): TaskPlanNode | undefined {
    return this.nodes.get(id);
  }

  public getExecutableNodes(): TaskPlanNode[] {
    if (this.status === 'CANCELLED' || this.status === 'FAILED') return [];

    const executable: TaskPlanNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.status !== 'QUEUED') continue;

      // Check if all dependencies are satisfied
      const allDepsComplete = node.dependencies.every(depId => {
        const dep = this.nodes.get(depId);
        return dep && dep.status === 'COMPLETED';
      });

      if (allDepsComplete) {
        executable.push(node);
      }
    }
    return executable;
  }

  public markNodeRunning(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = 'RUNNING';
      this.updatedAt = new Date().toISOString();
    }
    if (this.status === 'QUEUED') this.status = 'RUNNING';
  }

  public markNodeCompleted(nodeId: string, output: unknown): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = 'COMPLETED';
      node.output = output;
      this.updatedAt = new Date().toISOString();
    }
    this.updatePlanStatus();
  }

  public markNodeFailed(nodeId: string, error: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      if (node.retriesRemaining > 0) {
        node.retriesRemaining--;
        node.status = 'QUEUED'; // Requeue for retry
      } else {
        node.status = 'FAILED';
        node.error = error;
      }
      this.updatedAt = new Date().toISOString();
    }
    this.updatePlanStatus();
  }

  public cancel(): void {
    this.status = 'CANCELLED';
    for (const node of this.nodes.values()) {
      if (node.status === 'QUEUED' || node.status === 'RUNNING') {
        node.status = 'CANCELLED';
      }
    }
    this.updatedAt = new Date().toISOString();
  }

  public updatePlanStatus(): void {
    const all = Array.from(this.nodes.values());
    if (this.status === 'CANCELLED') return;

    if (all.some(n => n.status === 'FAILED')) {
      this.status = 'FAILED';
    } else if (all.every(n => n.status === 'COMPLETED')) {
      this.status = 'COMPLETED';
    } else if (all.some(n => n.status === 'RUNNING' || n.status === 'QUEUED')) {
      this.status = 'RUNNING';
    }
    this.updatedAt = new Date().toISOString();
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      goal: this.goal,
      workspaceId: this.workspaceId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      nodes: Array.from(this.nodes.values())
    };
  }

  public static fromJSON(data: any): TaskExecutionPlan {
    const plan = new TaskExecutionPlan(data.goal, [], data.workspaceId);
    plan.id = data.id;
    plan.status = data.status;
    plan.createdAt = data.createdAt;
    plan.updatedAt = data.updatedAt;

    if (Array.isArray(data.nodes)) {
      for (const node of data.nodes) {
        plan.addNode(node);
      }
    }
    return plan;
  }
}

/**
 * Task Planner Engine (Section 39)
 */
export class TaskPlanner {
  public static createCompoundPlan(
    goal: string,
    steps: Array<{
      description: string;
      agent: string;
      tools: string[];
      riskLevel?: RiskLevel;
      dependencies?: string[];
      inputs?: Record<string, unknown>;
      verificationPolicy?: VerificationPolicy;
    }>,
    workspaceId?: string
  ): TaskExecutionPlan {
    const plan = new TaskExecutionPlan(goal, [], workspaceId);
    const stepIdMap: string[] = [];

    steps.forEach((step, index) => {
      const nodeId = `step-${index + 1}`;
      stepIdMap.push(nodeId);

      const deps = step.dependencies || (index > 0 ? [stepIdMap[index - 1]!] : []);

      plan.addNode({
        id: nodeId,
        description: step.description,
        type: 'ACTION',
        dependencies: deps,
        agent: step.agent,
        requiredTools: step.tools,
        riskLevel: step.riskLevel || 'LOW',
        inputs: step.inputs || {},
        status: 'QUEUED',
        retriesRemaining: 2,
        verificationPolicy: step.verificationPolicy || { requireProof: true, strategy: 'FILE_HASH' }
      });
    });

    return plan;
  }
}

/**
 * Agent Workspace Manager (Section 40 & Phase 1.15)
 */
export class WorkspaceManager {
  private workspaces = new Map<string, AgentWorkspace>();
  private activeWorkspaceId?: string;

  public createWorkspace(name: string, objective: string, context: Record<string, unknown> = {}): AgentWorkspace {
    const id = `ws-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const ws: AgentWorkspace = {
      id,
      name,
      objective,
      context,
      files: [],
      tasks: [],
      memories: [],
      research: [],
      agentActivity: [],
      outputs: [],
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    this.workspaces.set(id, ws);
    this.activeWorkspaceId = id;
    return ws;
  }

  public getWorkspace(id: string): AgentWorkspace | undefined {
    return this.workspaces.get(id);
  }

  public getActiveWorkspace(): AgentWorkspace | undefined {
    if (!this.activeWorkspaceId) {
      const all = Array.from(this.workspaces.values());
      return all[0];
    }
    return this.workspaces.get(this.activeWorkspaceId);
  }

  public listWorkspaces(): AgentWorkspace[] {
    return Array.from(this.workspaces.values());
  }

  public attachTask(workspaceId: string, taskPlanId: string): void {
    const ws = this.workspaces.get(workspaceId);
    if (ws && !ws.tasks.includes(taskPlanId)) {
      ws.tasks.push(taskPlanId);
      ws.updatedAt = new Date().toISOString();
    }
  }

  public logActivity(workspaceId: string, agent: string, action: string, details?: unknown): void {
    const ws = this.workspaces.get(workspaceId);
    if (ws) {
      ws.agentActivity.push({
        timestamp: new Date().toISOString(),
        agent,
        action,
        details
      });
      ws.updatedAt = new Date().toISOString();
    }
  }

  public addOutput(workspaceId: string, title: string, content: string): void {
    const ws = this.workspaces.get(workspaceId);
    if (ws) {
      ws.outputs.push({
        id: `out-${crypto.randomUUID()}`,
        title,
        content,
        createdAt: new Date().toISOString()
      });
      ws.updatedAt = new Date().toISOString();
    }
  }
}

/**
 * Task Continuity Store (Phase 1.14)
 * Allows resuming unfinished project tasks after system/UI restart
 */
export class TaskContinuityStore {
  private plans = new Map<string, TaskExecutionPlan>();

  public savePlan(plan: TaskExecutionPlan): void {
    this.plans.set(plan.id, plan);
  }

  public getPlan(planId: string): TaskExecutionPlan | undefined {
    return this.plans.get(planId);
  }

  public findUnfinishedTask(searchQuery?: string): TaskExecutionPlan | undefined {
    const all = Array.from(this.plans.values()).reverse();
    return all.find(p => {
      const isUnfinished = p.status === 'RUNNING' || p.status === 'QUEUED';
      if (!isUnfinished) return false;
      if (!searchQuery) return true;
      return p.goal.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }

  public listUnfinishedTasks(): TaskExecutionPlan[] {
    return Array.from(this.plans.values()).filter(p => p.status === 'RUNNING' || p.status === 'QUEUED');
  }
}
