import http from 'node:http';

const BASE_URL = 'http://localhost:4820';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return { status: res.status, ok: res.ok, data: JSON.parse(text) };
  } catch {
    return { status: res.status, ok: res.ok, raw: text };
  }
}

class SSEListener {
  constructor() {
    this.events = [];
    this.req = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.req = http.get(`${BASE_URL}/api/v1/events/stream`, (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n\n');
          buffer = lines.pop(); // keep remainder
          for (const block of lines) {
            const dataLine = block.split('\n').find(l => l.startsWith('data: '));
            if (dataLine) {
              try {
                const parsed = JSON.parse(dataLine.slice(6));
                this.events.push(parsed);
                // console.log(`[SSE] ${parsed.type}:`, parsed.payload);
              } catch {}
            }
          }
        });
        resolve();
      });
      this.req.on('error', reject);
    });
  }

  stop() {
    if (this.req) {
      this.req.destroy();
      this.req = null;
    }
  }

  clear() {
    this.events = [];
  }

  find(type) {
    return this.events.filter(e => e.type === type);
  }
}

async function run() {
  console.log('=== MEGHAI LIVE ACCEPTANCE TEST SUITE ===\n');

  const sse = new SSEListener();
  await sse.start();
  console.log('✓ Connected to live SSE event stream at http://localhost:4820/api/v1/events/stream');

  // Verify server health
  const health = await request('/api/v1/health');
  console.log('✓ Live server status:', health.data);

  // -------------------------------------------------------------
  // TEST 1: DIRECT VOICE INPUT
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: DIRECT VOICE INPUT ---');
  sse.clear();

  // 1. Start listening via normal UI microphone control (mode: 'command')
  console.log('Step 1: UI starts listening in COMMAND mode...');
  const startMic = await request('/api/v1/voice/mic/start', 'POST', {
    mode: 'command',
    reason: 'User toggled microphone button'
  });
  console.log('Mic start response:', startMic.data);

  await wait(500);

  // 2. Query mic and voice state
  const micStatus = await request('/api/v1/voice/mic/status');
  console.log('Mic status:', micStatus.data);

  // 3. User speaks direct command WITHOUT "Hey Megh"
  const commandText = 'What is 25 times 4?';
  console.log(`Step 2: Processing spoken command: "${commandText}"`);

  // Direct input processing with source: 'VOICE' as emitted by VoiceInputManager
  const processRes = await request('/api/v1/input/process', 'POST', {
    text: commandText,
    source: 'VOICE'
  });
  console.log('Model response:', processRes.data);

  // 4. Stop mic
  await request('/api/v1/voice/mic/stop', 'POST');
  await wait(1000);

  // 5. Check last turn diagnostics
  const lastDiag = await request('/api/v1/voice/diagnostics/last');
  console.log('\nLast Turn Diagnostics for Test 1:');
  console.log(JSON.stringify(lastDiag.data, null, 2));

  // Check event sequence in SSE
  console.log('\nRecorded Event Sequence for Test 1:');
  for (const ev of sse.events) {
    console.log(`  -> ${ev.type}`, ev.payload ? `(${JSON.stringify(ev.payload).slice(0, 80)}...)` : '');
  }

  // -------------------------------------------------------------
  // TEST 2: ELEVENLABS VOICE
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: ELEVENLABS VOICE ---');
  sse.clear();

  // 1. List catalog and pick ElevenLabs voice
  const catalog = await request('/api/v1/voice/catalog');
  const elevenVoices = catalog.data.filter(v => v.provider === 'elevenlabs');
  const selectedVoiceA = elevenVoices[0] || { id: 'eleven-roger---laid-back--casual--resonant', name: 'ElevenLabs Roger', provider: 'elevenlabs' };
  console.log(`Selected ElevenLabs voice A: ID=${selectedVoiceA.id}, Name="${selectedVoiceA.name}", Provider=${selectedVoiceA.provider}`);

  // 2. Select voice via settings endpoint
  console.log('Selecting voice in settings...');
  const setVoiceA = await request('/api/v1/voice/settings', 'POST', {
    selectedVoiceId: selectedVoiceA.id,
    selectedProvider: 'elevenlabs'
  });
  console.log('Voice settings updated:', setVoiceA.data);

  // 3. Test Preview (strict allowFallback: false)
  console.log('\nTesting Voice Preview (allowFallback = false)...');
  const previewRes = await request('/api/v1/voice/preview', 'POST', {
    voiceId: selectedVoiceA.id,
    text: 'Hello Megh, say a short sentence.',
    play: false
  });
  console.log('Preview Result (status ' + previewRes.status + '):', previewRes.data || previewRes.raw);

  // 4. Test Conversational Speech Turn (allowFallback = true)
  console.log('\nTesting Conversational Speech Turn (with live fallback reporting)...');
  const speakRes = await request('/api/v1/voice/speak', 'POST', {
    voiceId: selectedVoiceA.id,
    text: 'Hello Megh, say a short sentence.'
  });
  console.log('Speak Result:', speakRes.data);

  await wait(1000);

  // 5. Check last turn diagnostics
  const diagT2 = await request('/api/v1/voice/diagnostics/last');
  console.log('\nDiagnostics for Test 2:');
  console.log(JSON.stringify(diagT2.data, null, 2));

  console.log('\nRecorded Events for Test 2:');
  for (const ev of sse.events) {
    console.log(`  -> ${ev.type}`, ev.payload ? `(${JSON.stringify(ev.payload).slice(0, 100)}...)` : '');
  }

  // -------------------------------------------------------------
  // TEST 3: VOICE PERSISTENCE
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: VOICE PERSISTENCE ---');
  // Read voice settings fresh
  const settingsCheck = await request('/api/v1/voice/settings');
  console.log('Persisted voice settings on disk/memory:', settingsCheck.data);

  // -------------------------------------------------------------
  // TEST 4: SECOND VOICE (VOICE B)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: SECOND VOICE SWITCHING ---');
  sse.clear();
  const selectedVoiceB = elevenVoices[1] || { id: 'eleven-sarah---mature--reassuring--confident', name: 'ElevenLabs Sarah', provider: 'elevenlabs' };
  console.log(`Switching to Voice B: ID=${selectedVoiceB.id}, Name="${selectedVoiceB.name}"`);

  await request('/api/v1/voice/settings', 'POST', {
    selectedVoiceId: selectedVoiceB.id,
    selectedProvider: 'elevenlabs'
  });

  const settingsB = await request('/api/v1/voice/settings');
  console.log('Active settings after switch to B:', settingsB.data);

  const speakB = await request('/api/v1/voice/speak', 'POST', {
    voiceId: selectedVoiceB.id,
    text: 'Testing second ElevenLabs voice configuration.'
  });
  console.log('Speak result for Voice B:', speakB.data);

  await wait(1000);

  const diagT4 = await request('/api/v1/voice/diagnostics/last');
  console.log('Diagnostics for Test 4:');
  console.log(JSON.stringify(diagT4.data, null, 2));

  // -------------------------------------------------------------
  // TEST 5: FAILURE BEHAVIOR & EXPLICIT FALLBACK
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: FAILURE BEHAVIOR ---');
  sse.clear();
  console.log('Testing ElevenLabs failure with invalid / exhausted credentials...');

  const speakFail = await request('/api/v1/voice/speak', 'POST', {
    voiceId: 'eleven-nonexistent-voice-id',
    text: 'Testing explicit fallback mechanics.'
  });
  console.log('Speak result with invalid voice/credentials:', speakFail.data);

  await wait(1000);

  const diagT5 = await request('/api/v1/voice/diagnostics/last');
  console.log('Diagnostics for Test 5:');
  console.log(JSON.stringify(diagT5.data, null, 2));

  console.log('\nRecorded Events for Test 5:');
  for (const ev of sse.events) {
    if (ev.type.includes('FALLBACK') || ev.type.includes('TTS') || ev.type.includes('VOICE')) {
      console.log(`  -> ${ev.type}:`, JSON.stringify(ev.payload, null, 2));
    }
  }

  sse.stop();
  console.log('\n=== SUITE COMPLETED ===');
}

run().catch(console.error);
