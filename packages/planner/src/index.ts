import crypto from 'node:crypto';
import type { TaskState, RiskLevel } from '@meghai/shared-types';

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
}

/**
 * Directed Acyclic Graph Execution Plan (Section 39)
 */
export class TaskExecutionPlan {
  public id: string;
  public goal: string;
  public nodes: Map<string, TaskPlanNode> = new Map();
  public status: TaskState = 'QUEUED';
  public createdAt: string = new Date().toISOString();

  constructor(goal: string, nodes: TaskPlanNode[] = []) {
    this.id = `plan-${crypto.randomUUID()}`;
    this.goal = goal;
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
  }

  public addNode(node: TaskPlanNode): void {
    this.nodes.set(node.id, node);
  }

  public getNode(id: string): TaskPlanNode | undefined {
    return this.nodes.get(id);
  }

  public getExecutableNodes(): TaskPlanNode[] {
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
    if (node) node.status = 'RUNNING';
    if (this.status === 'QUEUED') this.status = 'RUNNING';
  }

  public markNodeCompleted(nodeId: string, output: unknown): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = 'COMPLETED';
      node.output = output;
    }
    this.updatePlanStatus();
  }

  public markNodeFailed(nodeId: string, error: string): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.status = 'FAILED';
      node.error = error;
    }
    this.updatePlanStatus();
  }

  public updatePlanStatus(): void {
    const all = Array.from(this.nodes.values());
    if (all.some(n => n.status === 'FAILED')) {
      this.status = 'FAILED';
    } else if (all.every(n => n.status === 'COMPLETED')) {
      this.status = 'COMPLETED';
    } else if (all.some(n => n.status === 'RUNNING')) {
      this.status = 'RUNNING';
    }
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      goal: this.goal,
      status: this.status,
      createdAt: this.createdAt,
      nodes: Array.from(this.nodes.values())
    };
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
    }>
  ): TaskExecutionPlan {
    const plan = new TaskExecutionPlan(goal);
    const stepIdMap: string[] = [];

    steps.forEach((step, index) => {
      const nodeId = `step-${index + 1}`;
      stepIdMap.push(nodeId);

      // Default dependencies: previous step if not specified
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
        retriesRemaining: 2
      });
    });

    return plan;
  }
}
