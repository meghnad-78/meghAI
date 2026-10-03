import { MeghAIServer } from '../apps/api/src/server';

async function testServerChat() {
  console.log('--- Testing MeghAIServer /api/v1/input/process with Gemini ---');
  const server = new MeghAIServer();
  const port = 4920;
  await server.start(port);

  try {
    const res = await server.processUserRequest('Say "MeghAI online" in two words');
    console.log('Result Status:', res.status);
    console.log('Result Reply:', res.reply);
    console.log('Result Provider:', (res as any).provider);
    console.log('Result FallbackOccurred:', (res as any).fallbackOccurred);

    if (res.status !== 'COMPLETED') {
      throw new Error(`Expected COMPLETED, got ${res.status}`);
    }
    if ((res as any).provider !== 'gemini') {
      throw new Error(`Expected provider 'gemini', got ${(res as any).provider}`);
    }
    console.log('✓ Server chat verified with Gemini!');
  } finally {
    await server.stop();
  }
}

testServerChat().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
