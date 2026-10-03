import { MeghAIServer } from '../apps/api/src/server.js';

async function runLiveVerification() {
  console.log('=== MeghAI Live Ollama Verification ===\n');

  const server = new MeghAIServer();
  const port = await server.start(4820);
  console.log(`MeghAI API server running on port ${port}`);

  const queries = [
    'Hello',
    'How are you?',
    'Explain machine learning in simple terms.',
    'What is 25 multiplied by 8?',
    'What model are you using?'
  ];

  let allPassed = true;

  for (const query of queries) {
    console.log(`\n--------------------------------------------------`);
    console.log(`>>> USER QUERY: "${query}"`);
    const startTime = Date.now();

    try {
      const res = await fetch(`http://localhost:${port}/api/v1/input/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: query })
      });

      const elapsed = Date.now() - startTime;
      const data = await res.json() as any;

      console.log(`<<< STATUS: ${data.status} (${elapsed}ms)`);
      console.log(`<<< PROVIDER: ${data.provider} | MODEL: ${data.modelId}`);
      console.log(`<<< TOKENS: prompt=${data.tokensUsed?.promptTokens}, completion=${data.tokensUsed?.completionTokens}, total=${data.tokensUsed?.totalTokens}`);
      console.log(`<<< GENUINE MODEL REPLY:\n${data.reply}`);

      // Assertions
      if (data.status !== 'COMPLETED') {
        console.error(`FAILED: Expected status COMPLETED, got ${data.status}`);
        allPassed = false;
      }
      if (data.provider !== 'local-ollama') {
        console.error(`FAILED: Expected provider local-ollama, got ${data.provider}`);
        allPassed = false;
      }
      if (data.modelId !== 'llama3.2:latest') {
        console.error(`FAILED: Expected model llama3.2:latest, got ${data.modelId}`);
        allPassed = false;
      }
      if (!data.reply || data.reply.includes('[MeghAI Local Offline Intelligence]')) {
        console.error(`FAILED: Received canned placeholder or empty reply!`);
        allPassed = false;
      }
      if (!data.tokensUsed || data.tokensUsed.totalTokens <= 0) {
        console.error(`FAILED: Expected non-zero tokens used.`);
        allPassed = false;
      }
    } catch (err: any) {
      console.error(`ERROR processing query "${query}":`, err.message);
      allPassed = false;
    }
  }

  // Check Timeline Events
  console.log(`\n--------------------------------------------------`);
  console.log(`>>> Verifying Action Timeline Events...`);
  const timelineRes = await fetch(`http://localhost:${port}/api/v1/timeline?limit=50`);
  const timeline = await timelineRes.json() as any[];
  const eventTypes = timeline.map(e => e.type);

  console.log(`Recent Event Types in Timeline (${timeline.length}):`);
  console.log(Array.from(new Set(eventTypes)).join(' -> '));

  const requiredEvents = [
    'USER_INPUT_RECEIVED',
    'LANGUAGE_DETECTED',
    'INTENT_CLASSIFIED',
    'MODEL_SELECTED',
    'MODEL_STARTED',
    'MODEL_COMPLETED',
    'TASK_COMPLETED'
  ];

  for (const reqEvt of requiredEvents) {
    if (eventTypes.includes(reqEvt)) {
      console.log(`  ✓ Event present: ${reqEvt}`);
    } else {
      console.error(`  ✗ Missing required event: ${reqEvt}`);
      allPassed = false;
    }
  }

  await server.stop();
  console.log(`\nMeghAI server stopped.`);

  if (allPassed) {
    console.log(`\n🎉 SUCCESS: All 5 live queries verified with genuine Ollama llama3.2 responses! Zero placeholder strings.`);
    process.exit(0);
  } else {
    console.error(`\n❌ VERIFICATION FAILED: One or more assertions failed.`);
    process.exit(1);
  }
}

runLiveVerification().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
