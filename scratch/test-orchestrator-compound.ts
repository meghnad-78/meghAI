import { ToolRegistry } from '../packages/tool-registry/src/index.js';
import { ToolRuntime } from '../packages/tool-runtime/src/index.js';
import { PermissionBroker } from '../packages/permissions/src/index.js';
import { EventBus } from '../packages/events/src/index.js';
import { ActionOrchestrator } from '../packages/planner/src/action-orchestrator.js';

async function main() {
  const toolRegistry = new ToolRegistry();
  const permissionBroker = new PermissionBroker();
  const toolRuntime = new ToolRuntime(toolRegistry, permissionBroker);
  const eventBus = new EventBus();
  const orchestrator = new ActionOrchestrator(toolRegistry, toolRuntime, permissionBroker, eventBus);

  console.log('Testing ActionOrchestrator directly on compound command...');
  const plan = await orchestrator.generatePlan("Open Chrome and search for Java DSA roadmap.");
  console.log('Generated Plan:', JSON.stringify(plan, null, 2));

  console.log('\nExecuting Plan...');
  const res = await orchestrator.executePlan(plan);
  console.log('Execution Result Status:', res.status);
  console.log('Completed Steps:', res.completedSteps);
  console.log('Steps:', res.steps.map(s => ({ stepId: s.stepId, toolId: s.toolId, status: s.status, result: s.result })));
  console.log('Reply:', res.reply);
}

main().catch(console.error);
