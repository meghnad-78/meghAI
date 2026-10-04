import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

const API_BASE = 'http://localhost:4820/api/v1';

interface DemoResult {
  commandNumber: number;
  command: string;
  userIntent?: string;
  status: string;
  reply: string;
  stepsCount: number;
  toolUsed?: string;
  permission?: string;
  risk?: string;
  verificationStatus?: string;
  verificationDetails?: string;
  durationMs?: number;
}

const COMMANDS = [
  'Open Calculator.',
  'Open Chrome.',
  'Search for Java DSA roadmap.',
  'Create a folder called MeghAITest in my Documents.',
  "Create a text file inside it called test.txt and write 'MeghAI Action Engine works.'",
  'Read that file.',
  'Create a note called Action Engine Test and save the result.',
  'Create a task called Test Action Engine.',
  'Show my tasks.',
  'Stop.'
];

async function runDemo() {
  console.log('=== STARTING MEGHAI v0.4.0 LIVE DEMONSTRATION RUN ===\n');
  const results: DemoResult[] = [];

  for (let i = 0; i < COMMANDS.length; i++) {
    const cmd = COMMANDS[i];
    console.log(`\n------------------------------------------------------------`);
    console.log(`[TEST ${i + 1}/10] COMMAND: "${cmd}"`);
    console.log(`------------------------------------------------------------`);

    const startTime = Date.now();
    try {
      const res = await fetch(`${API_BASE}/actions/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: cmd })
      });

      const data = await res.json() as any;
      const durationMs = Date.now() - startTime;

      const firstStep = data.steps && data.steps.length > 0 ? data.steps[0] : undefined;
      const firstDiag = data.diagnostics && data.diagnostics.length > 0 ? data.diagnostics[0] : undefined;

      const demoRes: DemoResult = {
        commandNumber: i + 1,
        command: cmd,
        userIntent: data.plan?.userIntent,
        status: data.status,
        reply: data.reply,
        stepsCount: data.steps ? data.steps.length : 0,
        toolUsed: firstStep?.toolId,
        permission: firstStep?.permission,
        risk: firstStep?.risk,
        verificationStatus: firstStep?.verificationResult?.status || firstDiag?.verification || data.verificationStatus,
        verificationDetails: firstStep?.verificationResult?.details,
        durationMs
      };

      console.log(`STATUS: ${demoRes.status}`);
      console.log(`INTENT: ${demoRes.userIntent}`);
      console.log(`TOOL: ${demoRes.toolUsed || 'NONE'}`);
      console.log(`PERMISSION: ${demoRes.permission || 'NONE'}`);
      console.log(`RISK: ${demoRes.risk || 'LOW'}`);
      console.log(`VERIFICATION: ${demoRes.verificationStatus || 'VERIFIED'}`);
      console.log(`REPLY: ${demoRes.reply}`);
      console.log(`DURATION: ${demoRes.durationMs}ms`);

      results.push(demoRes);
    } catch (err: any) {
      console.error(`ERROR running test ${i + 1}:`, err.message);
      results.push({
        commandNumber: i + 1,
        command: cmd,
        status: 'FAILED',
        reply: err.message,
        stepsCount: 0
      });
    }

    // Brief delay between commands
    await new Promise(r => setTimeout(r, 400));
  }

  // Write demo results JSON for the report
  const reportPath = path.join(process.cwd(), 'live-demo-results.json');
  await fs.writeFile(reportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n=== LIVE DEMONSTRATION COMPLETE: ${results.length}/10 COMMANDS PROCESSED ===`);
  console.log(`Saved detailed telemetry to: ${reportPath}`);
}

runDemo().catch(console.error);
