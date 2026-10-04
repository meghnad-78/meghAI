import { STTRouter } from '../packages/voice/src/stt-router.js';
import { SpeechRecognitionService } from '../packages/voice/src/stt.js';

console.log('=== STT ROUTE AUDIT ===');

const router = new STTRouter();
const providers = router.listProviders();

console.log('\nRegistered STT Providers:');
for (const p of providers) {
  const isAvail = typeof p.isAvailable === 'function' ? p.isAvailable() : true;
  const isConfig = typeof p.isConfigured === 'function' ? p.isConfigured() : true;
  console.log(`  - [${p.id}] "${p.name}": isAvailable=${isAvail}, isConfigured=${isConfig}`);
}

console.log('\nEvaluating STTRouter.route() decisions:');

// Test default route
const defaultDecision = await router.route({});
console.log('Default routing decision:', defaultDecision);

// Test Hindi / Indic route
const indicDecision = await router.route({ language: 'hi-IN' });
console.log('Indic (hi-IN) routing decision:', indicDecision);

// Test Realtime route
const realtimeDecision = await router.route({ qualityMode: 'REALTIME' });
console.log('Realtime routing decision:', realtimeDecision);

// Test High Accuracy route
const highAccDecision = await router.route({ qualityMode: 'HIGH_ACCURACY' });
console.log('High Accuracy routing decision:', highAccDecision);

// Check SpeechRecognitionService listProviders
const service = new SpeechRecognitionService();
console.log('\nSpeechRecognitionService.listProviders():', service.listProviders());
