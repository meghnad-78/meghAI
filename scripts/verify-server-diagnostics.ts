import { MeghAIServer } from '../apps/api/src/server';

async function testServerDiagnostics() {
  console.log('--- Testing MeghAIServer Diagnostics & System Status ---');
  const server = new MeghAIServer();
  const port = 4921;
  await server.start(port);

  try {
    const diagRes = await fetch(`http://localhost:${port}/api/v1/providers/diagnostics`);
    const diag = await diagRes.json() as any;
    console.log('Diagnostics Model Providers:');
    for (const mp of diag.modelProviders) {
      console.log(`  - [${mp.id}] ${mp.name}: isConfigured=${mp.isConfigured}, available=${mp.health?.available}, status=${mp.health?.status}`);
    }

    const geminiDiag = diag.modelProviders.find((p: any) => p.id === 'gemini');
    const openaiDiag = diag.modelProviders.find((p: any) => p.id === 'openai');

    if (!geminiDiag?.health?.available) {
      throw new Error('Expected gemini to be available/healthy in diagnostics!');
    }
    if (openaiDiag?.isConfigured) {
      throw new Error('Expected openai to be unconfigured in diagnostics!');
    }

    const statusRes = await fetch(`http://localhost:${port}/api/v1/system/status`);
    const sysStatus = await statusRes.json() as any;
    console.log('Online System Status:', sysStatus.onlineStatus);
    if (sysStatus.onlineStatus !== 'ONLINE') {
      throw new Error(`Expected system onlineStatus 'ONLINE', got ${sysStatus.onlineStatus}`);
    }

    console.log('✓ Diagnostics and system status truthful and verified!');
  } finally {
    await server.stop();
  }
}

testServerDiagnostics().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
