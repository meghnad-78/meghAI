import { loadConfig } from '../packages/config/src/index.js';
import { SpeechRecognitionService } from '../packages/voice/src/stt.js';
import { WindowsOneCoreTTSProvider } from '../packages/voice/src/providers/onecore-provider.js';

async function main() {
  console.log('=== TEST ONLINE STT PROVIDERS WITH REAL SPEECH AUDIO ===\n');

  // 1. Hydrate environment from credentials.json
  loadConfig();

  // 2. Synthesize real acoustic speech: "Hey Megh, what is twenty five times four?"
  console.log('Step 1: Generating real acoustic speech waveform...');
  const tts = new WindowsOneCoreTTSProvider();
  const ttsRes = await tts.synthesize('Hey Megh, what is twenty five times four?');
  console.log(`Generated audio: ${ttsRes.audioBuffer?.length} bytes, duration: ${ttsRes.durationMs}ms`);

  // 3. Initialize SpeechRecognitionService
  console.log('\nStep 2: Initializing SpeechRecognitionService...');
  const stt = new SpeechRecognitionService();
  const router = stt.getRouter();

  console.log('STT Providers in router:');
  for (const p of router.listProviders()) {
    console.log(`  - [${p.id}] "${p.name}": isConfigured=${p.isConfigured?.()}`);
  }

  // 4. Test route decision
  console.log('\nStep 3: Evaluating STTRouter.route()...');
  const decision = await router.route({});
  console.log('Routing decision:', decision);

  // 5. Transcribe with SpeechRecognitionService
  console.log('\nStep 4: Transcribing real audio waveform via SpeechRecognitionService...');
  const start = Date.now();
  try {
    const result = await stt.transcribe(ttsRes.audioBuffer!);
    console.log(`\n✓ STT SUCCESS in ${Date.now() - start}ms!`);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error(`\n✗ STT ERROR in ${Date.now() - start}ms:`, err.message);
  }
}

main().catch(console.error);
