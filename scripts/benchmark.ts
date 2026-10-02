/**
 * MeghAI Evaluation & Benchmark CLI Runner
 */
import { MeghAIEvaluationSuite } from '../packages/evaluation/src/index';

async function runBenchmarks() {
  console.log('======================================================');
  console.log(' MeghAI System Evaluation & Benchmark Suite');
  console.log('======================================================');

  const suite = new MeghAIEvaluationSuite();
  const startTime = Date.now();
  const report = await suite.runFullEvaluation();
  const durationMs = Date.now() - startTime;

  console.log('\n--- CATEGORY BREAKDOWN ---');
  for (const cat of report.categories) {
    const statusIcon = cat.accuracyPercent === 100 ? '✓' : (cat.accuracyPercent >= 80 ? '⚡' : '✗');
    console.log(`[${statusIcon}] ${cat.category.padEnd(38)}: ${cat.passedCases}/${cat.totalCases} (${cat.accuracyPercent}%)`);
    if (cat.failures.length > 0) {
      for (const fail of cat.failures) {
        console.log(`    Fail: "${fail.input}" (Expected: ${fail.expected}, Got: ${fail.actual})`);
      }
    }
  }

  console.log('\n======================================================');
  console.log(` Overall Score: ${report.overallScore}%`);
  console.log(` All Safety Gates Passed: ${report.passedAllGates ? 'YES (PASSED)' : 'NO (FAILED)'}`);
  console.log(` Completed in: ${durationMs}ms`);
  console.log('======================================================');

  if (!report.passedAllGates) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runBenchmarks();
