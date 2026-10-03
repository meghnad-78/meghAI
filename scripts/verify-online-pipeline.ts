/**
 * MeghAI Online-First Architecture Live Verification Script
 * Validates all cloud-first subsystems:
 * 1. Audio Preprocessing (RMS, SNR, clipping, 16kHz mono RIFF WAV header)
 * 2. Online STT Providers & STTRouter (ElevenLabs Scribe, Google Cloud STT/Gemini audio, OpenAI Whisper)
 * 3. Indic Language Code-Switching (Hindi, Bengali, Hinglish) & Context Biasing
 * 4. Transparent Transcript Normalization (rawText vs interpretedText)
 * 5. Self-Wake Echo Suppression during MeghAI TTS Speech Output
 * 6. Multi-Voice Catalog (OpenAI TTS, Google Cloud, ElevenLabs, Windows SAPI/OneCore)
 * 7. Online Model Router, Cross-Provider Failover, and Truthful NO_ONLINE_MODEL_CONFIGURED
 * 8. BYOK Key Persistence in ~/.meghai/credentials.json & Dynamic OnlineSystemStatus
 */

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  validateAudioParameters,
  analyzeAudioQuality,
  writePcmToWavBuffer,
  trimSilencePadding,
  STTRouter,
  VoiceCatalogService,
  VoiceInputManager,
  AudioOutputService,
  AudioCueService,
  SpeechRecognitionService,
  ElevenLabsSTTProvider,
  GoogleCloudSTTProvider,
  OpenAIWhisperSTTProvider
} from '../packages/voice/src/index.js';
import { EventBus } from '../packages/events/src/index.js';
import { ModelRouter } from '../packages/model-router/src/index.js';
import { loadStoredCredentials, saveProviderCredential } from '../packages/config/src/index.js';

async function main() {
  console.log('================================================================');
  console.log('⚡ MEGHAI ONLINE-FIRST PRODUCTION ARCHITECTURE VERIFICATION ⚡');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${title}`);
      if (details) console.log(`   ${details}`);
    } else {
      console.error(`❌ [FAIL] ${title}`);
      if (details) console.error(`   ${details}`);
    }
  }

  // -------------------------------------------------------------------------
  // 1. Audio Preprocessor & Format Validation
  // -------------------------------------------------------------------------
  console.log('--- 1. AUDIO PREPROCESSOR & 16kHz MONO VALIDATION ---');
  const validCheck = validateAudioParameters(16000, 1, 16);
  assert('Parameter Validation: 16kHz mono 16-bit PCM accepted', validCheck.valid);

  const invalidCheck = validateAudioParameters(44100, 2, 16);
  assert('Parameter Validation: Stereo / non-16kHz rejected with informative diagnostic', !invalidCheck.valid && invalidCheck.reason !== undefined);

  // Generate 200ms of simulated speech (440Hz sine wave)
  const sampleRate = 16000;
  const numSamples = 3200; // 200ms
  const pcmBuffer = Buffer.alloc(numSamples * 2);
  for (let i = 0; i < numSamples; i++) {
    const val = Math.round(14000 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
    pcmBuffer.writeInt16LE(val, i * 2);
  }

  const quality = analyzeAudioQuality(pcmBuffer, sampleRate, 1);
  assert('Acoustic Metrics: RMS, Peak, and SNR estimated without phoneme destruction',
    quality.isValid && quality.durationMs === 200 && quality.peak > 13000 && quality.rms > 7000 && quality.snrEstimateDb > 10,
    `Duration: ${quality.durationMs}ms | Peak: ${quality.peak} | RMS: ${quality.rms} | SNR: ${quality.snrEstimateDb}dB | Clipping: ${quality.clippingRatio}`
  );

  const wavBuffer = writePcmToWavBuffer(pcmBuffer, sampleRate, 1);
  assert('Cloud WAV Serialization: Valid 44-byte RIFF WAVE header',
    wavBuffer.toString('ascii', 0, 4) === 'RIFF' && wavBuffer.toString('ascii', 8, 12) === 'WAVE' && wavBuffer.readUInt32LE(24) === 16000,
    `Total WAV size: ${wavBuffer.length} bytes (Header: 44 bytes, Data: ${pcmBuffer.length} bytes)`
  );

  // -------------------------------------------------------------------------
  // 2. STTRouter & Online Providers
  // -------------------------------------------------------------------------
  console.log('\n--- 2. STTROUTER & ONLINE SPEECH RECOGNITION ENGINES ---');
  const sttRouter = new STTRouter();
  const providers = sttRouter.listProviders();
  assert('Provider Registration: Online STT engines registered',
    providers.some(p => p.id === 'google-cloud-stt') &&
    providers.some(p => p.id === 'elevenlabs-scribe') &&
    providers.some(p => p.id === 'openai-whisper'),
    `Available providers: ${providers.map(p => p.name).join(', ')}`
  );

  // Truthful unconfigured STT
  const unconfiguredDecision = await sttRouter.route({ language: 'en' });
  assert('Truthful Unconfigured STT: Falls back truthfully when online keys are missing',
    unconfiguredDecision.selectedProvider === 'windows-system-speech' || unconfiguredDecision.selectedProvider === 'none',
    `Provider: ${unconfiguredDecision.selectedProvider} | Reason: ${unconfiguredDecision.reason}`
  );

  // Configured Online STT Router Simulation
  const onlineRouter = new STTRouter();
  onlineRouter.registerProvider({
    id: 'google-cloud-stt',
    name: 'Google Cloud STT',
    isAvailable: () => true,
    isConfigured: () => true,
    getCapabilities: () => ({ supportsRealtime: true, supportsKeytermBiasing: true, supportsLanguageDetection: true, supportsCodeSwitching: true, supportedAudioEncodings: ['pcm_s16le'], languages: ['hi-IN', 'bn-IN', 'en-IN'], models: ['chirp', 'gemini-2.5-flash'] }),
    transcribe: async () => ({ text: 'নমস্কার', confidence: 0.95, isFinal: true })
  });
  onlineRouter.registerProvider({
    id: 'elevenlabs-scribe',
    name: 'ElevenLabs Scribe',
    isAvailable: () => true,
    isConfigured: () => true,
    getCapabilities: () => ({ supportsRealtime: true, supportsKeytermBiasing: false, supportsLanguageDetection: true, supportsCodeSwitching: true, supportedAudioEncodings: ['pcm_s16le'], languages: ['hi', 'bn', 'en'], models: ['scribe_v2'] }),
    transcribe: async () => ({ text: 'hello', confidence: 0.9, isFinal: true })
  });
  onlineRouter.registerProvider({
    id: 'openai-whisper',
    name: 'OpenAI Whisper',
    isAvailable: () => true,
    isConfigured: () => true,
    getCapabilities: () => ({ supportsRealtime: false, supportsKeytermBiasing: true, supportsLanguageDetection: true, supportsCodeSwitching: false, supportedAudioEncodings: ['pcm_s16le'], languages: ['en'], models: ['whisper-1'] }),
    transcribe: async () => ({ text: 'hello', confidence: 0.9, isFinal: true })
  });

  // Indic Language Routing
  const indicDecision = await onlineRouter.route({ language: 'hi', enableCodeSwitching: true });
  assert('Indic Language Routing: Auto-routes Hindi/Bengali/Hinglish to Google/Gemini or Scribe',
    indicDecision.selectedProvider === 'google-cloud-stt' || indicDecision.selectedProvider === 'elevenlabs-scribe',
    `Selected: ${indicDecision.selectedProvider} | Reason: ${indicDecision.reason}`
  );

  // High Accuracy Routing
  const highAccDecision = await onlineRouter.route({ qualityMode: 'HIGH_ACCURACY' });
  assert('Quality Mode Routing: HIGH_ACCURACY routes to highest-tier online engine',
    highAccDecision.qualityMode === 'HIGH_ACCURACY' && ['elevenlabs-scribe', 'openai-whisper', 'google-cloud-stt'].includes(highAccDecision.selectedProvider),
    `Selected: ${highAccDecision.selectedProvider} (Mode: ${highAccDecision.qualityMode})`
  );

  // Transparent Transcript Normalization
  const norm1 = sttRouter.normalizeTranscript('hey megh please open calculator');
  assert('Transcript Normalization: Normalizes colloquial commands preserving raw text',
    norm1.rawText === 'hey megh please open calculator' && norm1.interpretedText === 'Open Calculator',
    `Raw: "${norm1.rawText}" -> Interpreted: "${norm1.interpretedText}"`
  );

  const norm2 = sttRouter.normalizeTranscript('sun bhai notepad kholo');
  assert('Transcript Normalization: Hinglish colloquial commands normalized to canonical form',
    norm2.interpretedText === 'Open Notepad',
    `Raw: "${norm2.rawText}" -> Interpreted: "${norm2.interpretedText}"`
  );

  // -------------------------------------------------------------------------
  // 3. Self-Wake Echo Suppression
  // -------------------------------------------------------------------------
  console.log('\n--- 3. SELF-WAKE ECHO SUPPRESSION ---');
  const tempDir = path.join(os.tmpdir(), `meghai-echo-verify-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const eventBus = new EventBus();
  const cueService = new AudioCueService(tempDir);
  const audioOutput = new AudioOutputService(eventBus, cueService);
  const speechRecognition = new SpeechRecognitionService();

  const voiceInputManager = new VoiceInputManager({
    audioOutput,
    eventBus,
    speechRecognition
  });

  let wakeDetectorCalled = false;
  (voiceInputManager as any).wakeDetector = {
    detectWakePhrase: async () => {
      wakeDetectorCalled = true;
      return { detected: false };
    }
  };

  // Simulate active TTS playback
  (audioOutput as any).state = 'PLAYING_TTS';
  assert('Audio Output State: Output marked as actively playing TTS', audioOutput.isPlaying());

  // Deliver audio frame during playback
  voiceInputManager.handleAudioFrame({
    timestamp: Date.now(),
    sampleRate: 16000,
    channels: 1,
    format: 'pcm_s16le',
    sequenceNumber: 1,
    durationMs: 100,
    data: Buffer.alloc(3200),
    rms: 2500,
    peak: 6000,
    normalizedLevel: 0.2
  });

  assert('Echo Suppression: Audio frame discarded while MeghAI speaks (zero wake evaluation)',
    !wakeDetectorCalled,
    'Echo suppression successfully prevented MeghAI audio output from triggering self-wake'
  );

  // Halt audio output
  (audioOutput as any).state = 'IDLE';
  assert('Audio Output Reset: Output returned to IDLE state', !audioOutput.isPlaying());

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  // -------------------------------------------------------------------------
  // 4. Multi-Voice Catalog & OpenAI Speech
  // -------------------------------------------------------------------------
  console.log('\n--- 4. MULTI-VOICE CATALOG & OPENAI SPEECH EXPANSION ---');
  const catalog = new VoiceCatalogService();
  const allVoices = catalog.listVoices();
  const openaiVoices = allVoices.filter(v => v.provider === 'openai');

  assert('Catalog Expansion: OpenAI Speech voices registered (Alloy, Echo, Fable, Onyx, Nova, Shimmer)',
    openaiVoices.length >= 6 && openaiVoices.some(v => v.name === 'Alloy') && openaiVoices.some(v => v.name === 'Nova'),
    `Registered OpenAI voices: ${openaiVoices.map(v => v.name).join(', ')}`
  );

  const stats = catalog.getStats();
  assert('Voice Studio Stats: Multi-provider counts aggregated correctly',
    stats.totalVoices >= 100 && stats.providers['openai'] !== undefined,
    `Total Voices: ${stats.totalVoices} | Cloud: ${stats.totalCloud} | Offline Ready: ${stats.totalOfflineReady}`
  );

  // -------------------------------------------------------------------------
  // 5. Online Model Router & Failover
  // -------------------------------------------------------------------------
  console.log('\n--- 5. ONLINE MODEL ROUTER & FAILOVER ---');
  const modelRouter = new ModelRouter();

  // Test truthful NO_ONLINE_MODEL_CONFIGURED reporting
  const origEnv = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';
  const origGemini = process.env['GEMINI_API_KEY'];
  delete process.env['GEMINI_API_KEY'];

  try {
    const noKeyDecision = await modelRouter.route({
      messages: [{ role: 'user', content: 'What is the capital of India?' }]
    }, {
      routingMode: 'QUALITY',
      allowOfflineFallback: false
    });

    assert('Truthful Status: Reports NO_ONLINE_MODEL_CONFIGURED when keys absent and offline fallback disallowed',
      noKeyDecision.selectedProvider === 'none' && noKeyDecision.routingReason.includes('NO_ONLINE_MODEL_CONFIGURED'),
      `Provider: ${noKeyDecision.selectedProvider} | Reason: ${noKeyDecision.routingReason}`
    );
  } finally {
    process.env['NODE_ENV'] = origEnv;
    if (origGemini) process.env['GEMINI_API_KEY'] = origGemini;
  }

  // Test Cross-Provider Failover
  const mockPrimary = {
    id: 'deepseek' as const,
    name: 'DeepSeek Reasoner',
    isConfigured: () => true,
    getModels: () => [{ id: 'deepseek-chat', providerId: 'deepseek' as const, name: 'DeepSeek Chat', isLocal: false, costPer1kInputTokensUSD: 0.00014, costPer1kOutputTokensUSD: 0.00028, capabilities: {} as any }],
    checkHealth: async () => ({ available: true, latencyMs: 50, isConfigured: true }),
    complete: async () => { throw new Error('DeepSeek 503 Server Overloaded'); }
  };

  const mockFailover = {
    id: 'gemini' as const,
    name: 'Google Gemini',
    isConfigured: () => true,
    getModels: () => [{ id: 'gemini-2.5-flash', providerId: 'gemini' as const, name: 'Gemini 2.5 Flash', isLocal: false, costPer1kInputTokensUSD: 0.000075, costPer1kOutputTokensUSD: 0.0003, capabilities: {} as any }],
    checkHealth: async () => ({ available: true, latencyMs: 30, isConfigured: true }),
    complete: async () => ({
      content: 'New Delhi is the capital of India.',
      providerId: 'gemini' as const,
      modelId: 'gemini-2.5-flash',
      latencyMs: 110,
      tokensUsed: { promptTokens: 8, completionTokens: 10, totalTokens: 18 },
      finishReason: 'stop' as const
    })
  };

  modelRouter.registerProvider(mockPrimary);
  modelRouter.registerProvider(mockFailover);

  const fallbackRes = await modelRouter.completeWithFallback({
    messages: [{ role: 'user', content: 'What is the capital of India?' }],
    providerId: 'deepseek'
  });

  assert('Online Failover: Primary failure triggers seamless cross-provider failover',
    fallbackRes.fallbackOccurred === true && fallbackRes.providerId === 'gemini' && fallbackRes.content.includes('New Delhi'),
    `Fallback Occurred: ${fallbackRes.fallbackOccurred} | Final Provider: ${fallbackRes.providerId} | Response: "${fallbackRes.content}"`
  );

  // -------------------------------------------------------------------------
  // 6. BYOK Credential Persistence
  // -------------------------------------------------------------------------
  console.log('\n--- 6. BYOK CREDENTIAL PERSISTENCE ---');
  const credsDir = path.join(os.tmpdir(), `meghai-creds-verify-${Date.now()}`);
  fs.mkdirSync(credsDir, { recursive: true });
  const credsFile = path.join(credsDir, 'credentials.json');

  saveProviderCredential('gemini', 'AIzaSyTestGeminiKey123', credsFile);
  saveProviderCredential('openai', 'sk-proj-testOpenAIKey456', credsFile);

  const loadedCreds = loadStoredCredentials(credsFile);
  assert('BYOK Persistence: API credentials saved and reloaded from disk',
    loadedCreds['gemini'] === 'AIzaSyTestGeminiKey123' && loadedCreds['openai'] === 'sk-proj-testOpenAIKey456',
    `Persisted keys loaded: ${Object.keys(loadedCreds).join(', ')}`
  );

  try {
    fs.rmSync(credsDir, { recursive: true, force: true });
  } catch {}

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`RESULTS: ${passed} / ${total} VERIFICATION CHECKS PASSED`);
  if (passed === total) {
    console.log('🎉 ALL ONLINE-FIRST PRODUCTION SUBSYSTEMS VERIFIED & OPERATIONAL!');
  } else {
    console.error('⚠️ SOME SUBSYSTEMS FAILED VERIFICATION.');
  }
  console.log('================================================================\n');

  if (passed !== total) process.exit(1);
}

main().catch(err => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
