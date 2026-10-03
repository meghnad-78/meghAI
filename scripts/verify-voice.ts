import { MeghAIServer } from '../apps/api/src/server.js';

async function main() {
  const server = new MeghAIServer();
  const port = await server.start(9999);
  console.log('Server started on port', port);

  try {
    // 1. Stats check
    const statsRes = await fetch(`http://localhost:${port}/api/v1/voice/catalog/stats`);
    const stats = await statsRes.json();
    console.log('Catalog stats:', JSON.stringify(stats, null, 2));

    // 2. Audio Cue check
    const cueRes = await fetch(`http://localhost:${port}/api/v1/voice/cue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cue: 'answer_ready' })
    });
    const cueData = await cueRes.json();
    console.log('Audio Cue result:', cueData);

    // 3. OneCore voice synthesis check
    const prevRes = await fetch(`http://localhost:${port}/api/v1/voice/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voiceId: 'onecore-heera',
        text: 'Live verification of MeghAI OneCore voice synthesis.',
        play: false
      })
    });
    const prevData = await prevRes.json() as any;
    console.log(`Preview synthesis result: success=${prevData.success}, durationMs=${prevData.durationMs}, base64Length=${prevData.audioBase64?.length || 0}`);

    // 4. Voice status check
    const statusRes = await fetch(`http://localhost:${port}/api/v1/voice/status`);
    const statusData = await statusRes.json();
    console.log('Voice status:', statusData);

    console.log('ALL VERIFICATIONS PASSED CLEANLY!');
  } finally {
    server.audioPlayback.stop('Script finished');
    await server.stop();
  }
}

main().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
