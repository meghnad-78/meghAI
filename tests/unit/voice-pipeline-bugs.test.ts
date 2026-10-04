import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  VoiceInputManager,
  AudioCaptureService,
  AudioOutputService,
  SpeechRecognitionService,
  VoiceCatalogService,
  VoiceSettingsManager,
  ElevenLabsTTSProvider,
  globalVoiceDiagnostics,
  VoiceDiagnosticsService
} from '../../packages/voice/src/index';
import { PersonalityManager } from '../../packages/ai-core/src/index';
import { KillSwitch } from '../../packages/security/src/index';
import type { AudioFrame } from '../../packages/shared-types/src/index';

function createSyntheticAudioFrame(options: {
  rms: number;
  durationMs?: number;
  sequenceNumber?: number;
}): AudioFrame {
  const durationMs = options.durationMs ?? 100;
  const numSamples = Math.floor(16000 * (durationMs / 1000));
  const data = Buffer.alloc(numSamples * 2);

  const amplitude = Math.round(options.rms * Math.SQRT2);
  for (let i = 0; i < numSamples; i++) {
    const val = Math.min(32767, Math.max(-32768, Math.round(amplitude * Math.sin((2 * Math.PI * 440 * i) / 16000))));
    data.writeInt16LE(val, i * 2);
  }

  return {
    timestamp: Date.now(),
    sampleRate: 16000,
    channels: 1,
    format: 'pcm_s16le',
    sequenceNumber: options.sequenceNumber ?? 1,
    durationMs,
    data,
    rms: options.rms,
    peak: Math.abs(amplitude),
    normalizedLevel: Math.min(1.0, options.rms / 10000)
  };
}

describe('MeghAI Voice Pipeline Bug Fixes — 16 Verification Scenarios', () => {
  let tempDir: string;
  let capturedEvents: Array<{ type: string; payload: any }>;
  let mockEventBus: { publish: (type: string, payload: any) => void };

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `meghai-voice-bugs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempDir, { recursive: true });
    KillSwitch.reset();
    globalVoiceDiagnostics.reset();

    capturedEvents = [];
    mockEventBus = {
      publish: (type: string, payload: any) => {
        capturedEvents.push({ type, payload });
      }
    };
  });

  afterEach(() => {
    KillSwitch.reset();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  // TEST 1: Mic frame delivery during command capture
  it('1. Mic frame delivery during command capture accumulates PCM bytes and updates RMS', async () => {
    const mockCapture = new AudioCaptureService({ mockCapture: true, eventBus: mockEventBus });
    const mockOutput = new AudioOutputService({ eventBus: mockEventBus });
    const mockSTT = new SpeechRecognitionService();

    const voiceInput = new VoiceInputManager({
      audioCapture: mockCapture,
      audioOutput: mockOutput,
      speechRecognition: mockSTT,
      eventBus: mockEventBus
    });

    await voiceInput.startCommandCapture('test-direct-listen');
    expect(voiceInput.getState()).toBe('COMMAND_CAPTURE');

    // Deliver 5 synthetic speech frames
    for (let i = 1; i <= 5; i++) {
      const frame = createSyntheticAudioFrame({ rms: 350, sequenceNumber: i });
      voiceInput.handleAudioFrame(frame);
    }

    const lastTurn = globalVoiceDiagnostics.getLastTurn();
    expect(lastTurn).not.toBeNull();
    expect(lastTurn!.audioFramesReceived).toBeGreaterThanOrEqual(5);
    expect(lastTurn!.audioBytesReceived).toBeGreaterThan(0);
    expect(lastTurn!.maxRms).toBeGreaterThanOrEqual(300);

    await voiceInput.stop();
  });

  // TEST 2: VAD transition from SPEECH to SILENCE triggers finalization (with debounce)
  it('2. VAD transition from SPEECH to SILENCE triggers finalization with transient debouncing', async () => {
    const mockCapture = new AudioCaptureService({ mockCapture: true, eventBus: mockEventBus });
    const mockOutput = new AudioOutputService({ eventBus: mockEventBus });
    const mockSTT = new SpeechRecognitionService();
    vi.spyOn(mockSTT, 'transcribe').mockResolvedValue({ text: 'open notepad', confidence: 0.95, isFinal: true });

    let commandCalled = false;
    const voiceInput = new VoiceInputManager({
      audioCapture: mockCapture,
      audioOutput: mockOutput,
      speechRecognition: mockSTT,
      eventBus: mockEventBus,
      silenceThresholdMs: 300,
      onCommand: async () => { commandCalled = true; }
    });

    await voiceInput.startCommandCapture('test-speech-to-silence');

    // Deliver SPEECH frames (RMS 400)
    for (let i = 0; i < 4; i++) {
      voiceInput.handleAudioFrame(createSyntheticAudioFrame({ rms: 400 }));
    }

    // Deliver a transient noise click frame (RMS 200, 100ms)
    voiceInput.handleAudioFrame(createSyntheticAudioFrame({ rms: 200 }));

    // Deliver consecutive SILENCE frames (RMS 30) for > silenceThresholdMs
    for (let i = 0; i < 6; i++) {
      voiceInput.handleAudioFrame(createSyntheticAudioFrame({ rms: 30 }));
    }

    await new Promise(r => setTimeout(r, 60));
    expect(commandCalled).toBe(true);
    await voiceInput.stop();
  });

  // TEST 3: Maximum command timeout triggers finalization (no infinite hang)
  it('3. Maximum command timeout triggers finalization without hanging indefinitely', async () => {
    const mockCapture = new AudioCaptureService({ mockCapture: true, eventBus: mockEventBus });
    const mockOutput = new AudioOutputService({ eventBus: mockEventBus });
    const mockSTT = new SpeechRecognitionService();
    vi.spyOn(mockSTT, 'transcribe').mockResolvedValue({ text: 'long command text', confidence: 0.9, isFinal: true });

    const voiceInput = new VoiceInputManager({
      audioCapture: mockCapture,
      audioOutput: mockOutput,
      speechRecognition: mockSTT,
      eventBus: mockEventBus,
      maxCommandDurationMs: 200
    });

    await voiceInput.startCommandCapture('test-max-duration');

    // Deliver speech frames
    voiceInput.handleAudioFrame(createSyntheticAudioFrame({ rms: 300 }));

    // Advance past maxCommandDurationMs
    await new Promise(r => setTimeout(r, 250));

    // Deliver next frame which triggers duration watchdog
    voiceInput.handleAudioFrame(createSyntheticAudioFrame({ rms: 300 }));
    await new Promise(r => setTimeout(r, 60));

    expect(voiceInput.getState()).not.toBe('COMMAND_CAPTURE');
    await voiceInput.stop();
  });

  // TEST 4: STT provider failure transitions out of LISTENING with error event (no hang)
  it('4. STT provider failure transitions out of LISTENING with error event without hanging', async () => {
    const controlledCapture = {
      isCapturing: () => true,
      start: async () => {},
      stop: async () => true,
      onFrame: () => () => {},
      getState: () => 'MIC_LISTENING',
      getDiagnostics: () => ({})
    } as any;
    const mockOutput = {
      isSpeakingTTS: () => false,
      isPlaying: () => false,
      playCue: async () => {},
      stop: () => true,
      onStateChange: () => () => {},
      playTTS: async () => ({ success: true, durationMs: 100 })
    } as any;
    const mockSTT = new SpeechRecognitionService();
    vi.spyOn(mockSTT, 'transcribe').mockRejectedValue(new Error('Network timeout contacting STT endpoint'));

    const voiceInput = new VoiceInputManager({
      audioCapture: controlledCapture,
      audioOutput: mockOutput,
      speechRecognition: mockSTT,
      eventBus: mockEventBus
    });

    await voiceInput.startCommandCapture('test-stt-error');

    // Deliver at least 3 speech frames so audio length is sufficient (>= 300ms)
    for (let i = 0; i < 4; i++) {
      voiceInput.handleAudioFrame(createSyntheticAudioFrame({ rms: 350 }));
    }

    // Finish command capture
    await (voiceInput as any).finishCommandCapture('Silence detected');

    // Must NOT hang in COMMAND_CAPTURE or TRANSCRIBING
    expect(voiceInput.getState()).toBe('PASSIVE_WAKE_LISTENING');

    // Must emit VOICE_ERROR event
    const errEvent = capturedEvents.find(e => e.type === 'VOICE_ERROR');
    expect(errEvent).toBeDefined();
    expect(errEvent!.payload.error).toContain('Network timeout');

    await voiceInput.stop();
  });

  // TEST 5: STT final transcript is forwarded to model command handler
  it('5. STT final transcript is forwarded to model command handler', async () => {
    const controlledCapture = {
      isCapturing: () => true,
      start: async () => {},
      stop: async () => true,
      onFrame: () => () => {},
      getState: () => 'MIC_LISTENING',
      getDiagnostics: () => ({})
    } as any;
    const mockOutput = {
      isSpeakingTTS: () => false,
      isPlaying: () => false,
      playCue: async () => {},
      stop: () => true,
      onStateChange: () => () => {},
      playTTS: async () => ({ success: true, durationMs: 100 })
    } as any;
    const mockSTT = new SpeechRecognitionService();
    vi.spyOn(mockSTT, 'transcribe').mockResolvedValue({
      text: 'what is the capital of France',
      confidence: 0.98,
      isFinal: true
    });

    let receivedTranscript = '';
    let receivedMeta: any = null;

    const voiceInput = new VoiceInputManager({
      audioCapture: controlledCapture,
      audioOutput: mockOutput,
      speechRecognition: mockSTT,
      eventBus: mockEventBus,
      onCommand: async (transcript, meta) => {
        receivedTranscript = transcript;
        receivedMeta = meta;
      }
    });

    await voiceInput.startCommandCapture('test-forward');
    // Deliver at least 3 speech frames (>= 300ms)
    for (let i = 0; i < 4; i++) {
      voiceInput.handleAudioFrame(createSyntheticAudioFrame({ rms: 400 }));
    }
    await (voiceInput as any).finishCommandCapture('User finished speaking');

    expect(receivedTranscript).toBe('what is the capital of France');
    expect(receivedMeta).toBeDefined();
    expect(receivedMeta.voiceSessionId).toBeDefined();
    expect(receivedMeta.commandId).toBeDefined();

    await voiceInput.stop();
  });

  // TEST 6: Pre-roll audio preserved (no clipped initial words)
  it('6. Pre-roll audio is preserved so initial syllables are not clipped', async () => {
    const mockCapture = new AudioCaptureService({ mockCapture: true, eventBus: mockEventBus });
    const mockOutput = new AudioOutputService({ eventBus: mockEventBus });
    const mockSTT = new SpeechRecognitionService();

    const voiceInput = new VoiceInputManager({
      audioCapture: mockCapture,
      audioOutput: mockOutput,
      speechRecognition: mockSTT,
      eventBus: mockEventBus
    });

    await voiceInput.startPassiveListening();

    // Deliver frames into rolling wake buffer
    const frame1 = createSyntheticAudioFrame({ rms: 200, sequenceNumber: 1 });
    const frame2 = createSyntheticAudioFrame({ rms: 220, sequenceNumber: 2 });
    const frame3 = createSyntheticAudioFrame({ rms: 240, sequenceNumber: 3 });
    voiceInput.handleAudioFrame(frame1);
    voiceInput.handleAudioFrame(frame2);
    voiceInput.handleAudioFrame(frame3);

    // Confirm wake word
    await (voiceInput as any).handleWakeConfirmed({
      detected: true,
      phrase: 'Hey Megh',
      confidence: 0.95
    });

    // Directly transitions into COMMAND_CAPTURE with preserved pre-roll frames
    expect(voiceInput.getState()).toBe('COMMAND_CAPTURE');
    const commandFrames: AudioFrame[] = (voiceInput as any).commandFrames;
    expect(commandFrames.length).toBeGreaterThanOrEqual(3);
    expect(commandFrames[0].sequenceNumber).toBe(1);

    await voiceInput.stop();
  });

  // TEST 7: Selecting an ElevenLabs voice updates selectedVoiceId and selectedProvider
  it('7. Selecting an ElevenLabs voice automatically updates selectedVoiceId and selectedProvider', () => {
    const settingsPath = path.join(tempDir, 'voice-settings.json');
    const settingsMgr = new VoiceSettingsManager(settingsPath);

    expect(settingsMgr.getSettings().selectedProvider).toBe('windows-onecore');

    const updated = settingsMgr.updateSettings({ selectedVoiceId: 'eleven-rachel' });
    expect(updated.selectedVoiceId).toBe('eleven-rachel');
    expect(updated.selectedProvider).toBe('elevenlabs');

    const reloaded = new VoiceSettingsManager(settingsPath);
    expect(reloaded.getSettings().selectedVoiceId).toBe('eleven-rachel');
    expect(reloaded.getSettings().selectedProvider).toBe('elevenlabs');
  });

  // TEST 8: TTS router resolves ElevenLabs voice to ElevenLabs provider, not SAPI
  it('8. TTS router resolves ElevenLabs voice to ElevenLabs provider, not SAPI', () => {
    const catalog = new VoiceCatalogService();
    const provider = catalog.getProviderForVoice('eleven-rachel');
    expect(provider).toBeDefined();
    expect(provider!.id).toBe('elevenlabs');

    const provider2 = catalog.getProviderForVoice('elevenlabs-21m00Tcm4TlvDq8ikWAM');
    expect(provider2).toBeDefined();
    expect(provider2!.id).toBe('elevenlabs');
  });

  // TEST 9: TTS request to ElevenLabs includes correct API key and voice ID
  it('9. TTS request to ElevenLabs includes correct API key and voice ID', async () => {
    const provider = new ElevenLabsTTSProvider({ apiKey: 'eleven-test-key-12345' });
    expect(provider.getApiKey()).toBe('eleven-test-key-12345');
    expect(provider.isConfigured()).toBe(true);

    const originalFetch = global.fetch;
    let requestedUrl = '';
    let requestHeaders: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: any, opts: any) => {
      requestedUrl = String(url);
      requestHeaders = opts?.headers;
      return {
        ok: true,
        arrayBuffer: async () => new Uint8Array([0xFF, 0xFB, 0x90, 0x64]).buffer
      } as any;
    });

    try {
      const res = await provider.synthesize('Testing voice synthesis', { voiceId: 'eleven-rachel' });
      expect(res.voiceId).toBe('eleven-rachel');
      expect(res.providerId).toBe('elevenlabs');
      expect(requestedUrl).toContain('api.elevenlabs.io');
      expect(requestHeaders['xi-api-key']).toBe('eleven-test-key-12345');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // TEST 10: Fallback to Windows voice does NOT occur when ElevenLabs is valid
  it('10. Fallback to Windows voice does NOT occur when ElevenLabs is valid and succeeds', async () => {
    const catalog = new VoiceCatalogService();
    const elevenProvider = new ElevenLabsTTSProvider({ apiKey: 'valid-key' });
    vi.spyOn(elevenProvider, 'synthesize').mockResolvedValue({
      spokenText: 'Hello world',
      voiceId: 'eleven-rachel',
      format: 'mp3',
      durationMs: 1200,
      audioBase64: 'synthetic-base64',
      providerId: 'elevenlabs'
    });
    catalog.registerProvider(elevenProvider);

    const result = await catalog.synthesize('Hello world', {
      voiceId: 'eleven-rachel',
      allowFallback: true
    });

    expect(result.fallbackTriggered).toBeFalsy();
    expect(result.voiceId).toBe('eleven-rachel');
    expect(result.providerId).toBe('elevenlabs');
  });

  // TEST 11: When ElevenLabs fails with fallback enabled, explicit fallback event is published with reason
  it('11. When ElevenLabs fails with fallback enabled, explicit fallback event is published with reason', async () => {
    const catalog = new VoiceCatalogService();
    catalog.setEventBus(mockEventBus as any);

    const elevenProvider = new ElevenLabsTTSProvider({ apiKey: 'bad-key' });
    vi.spyOn(elevenProvider, 'synthesize').mockRejectedValue(new Error('Invalid ElevenLabs API key (401 Unauthorized)'));
    catalog.registerProvider(elevenProvider);

    const result = await catalog.synthesize('Hello fallback', {
      voiceId: 'eleven-rachel',
      allowFallback: true
    });

    expect(result.fallbackTriggered).toBe(true);
    expect(result.fallbackReason).toContain('Invalid ElevenLabs API key');
    expect(result.originalVoiceId).toBe('eleven-rachel');

    const fallbackEvent = capturedEvents.find(e => e.type === 'TTS_FALLBACK_TRIGGERED');
    expect(fallbackEvent).toBeDefined();
    expect(fallbackEvent!.payload.originalVoiceId).toBe('eleven-rachel');
    expect(fallbackEvent!.payload.reason).toContain('Invalid ElevenLabs API key');
  });

  // TEST 12: When ElevenLabs fails with fallback disabled, an error is thrown with reason
  it('12. When ElevenLabs fails with fallback disabled, an error is thrown with reason', async () => {
    const catalog = new VoiceCatalogService();
    const elevenProvider = new ElevenLabsTTSProvider({ apiKey: 'bad-key' });
    vi.spyOn(elevenProvider, 'synthesize').mockRejectedValue(new Error('Quota exceeded on ElevenLabs account'));
    catalog.registerProvider(elevenProvider);

    await expect(
      catalog.synthesize('Hello preview', {
        voiceId: 'eleven-rachel',
        allowFallback: false
      })
    ).rejects.toThrow('Quota exceeded on ElevenLabs account');
  });

  // TEST 13: Personality change does NOT overwrite manually selected ElevenLabs voice
  it('13. Personality change does NOT overwrite manually selected ElevenLabs voice', () => {
    const settingsPath = path.join(tempDir, 'voice-settings.json');
    const voiceSettings = new VoiceSettingsManager(settingsPath);
    voiceSettings.updateSettings({ selectedVoiceId: 'eleven-charlie' });

    const personalityMgr = new PersonalityManager();
    personalityMgr.setPersonality('professional');

    expect(voiceSettings.getSettings().selectedVoiceId).toBe('eleven-charlie');
    expect(voiceSettings.getSettings().selectedProvider).toBe('elevenlabs');
  });

  // TEST 14: Voice settings persist across restart / reload
  it('14. Voice settings persist across restart / reload', () => {
    const settingsPath = path.join(tempDir, 'voice-settings.json');
    const mgr1 = new VoiceSettingsManager(settingsPath);
    mgr1.updateSettings({
      selectedVoiceId: 'eleven-george',
      selectedProvider: 'elevenlabs',
      speechRate: 1.15,
      pitch: 0.95
    });

    const mgr2 = new VoiceSettingsManager(settingsPath);
    const loaded = mgr2.getSettings();
    expect(loaded.selectedVoiceId).toBe('eleven-george');
    expect(loaded.selectedProvider).toBe('elevenlabs');
    expect(loaded.speechRate).toBe(1.15);
    expect(loaded.pitch).toBe(0.95);
  });

  // TEST 15: Echo gate clears cleanly after TTS playback ends
  it('15. Echo gate clears cleanly after TTS playback ends', async () => {
    const mockCapture = new AudioCaptureService({ mockCapture: true, eventBus: mockEventBus });
    const mockOutput = new AudioOutputService({ eventBus: mockEventBus });
    const mockSTT = new SpeechRecognitionService();

    const voiceInput = new VoiceInputManager({
      audioCapture: mockCapture,
      audioOutput: mockOutput,
      speechRecognition: mockSTT,
      eventBus: mockEventBus
    });

    await voiceInput.startPassiveListening();

    // Enter speaking state
    voiceInput.enterSpeakingState('Assistant is speaking');
    expect(voiceInput.isEchoSuppressionActive()).toBe(true);

    // Frame while speaking must be gated (rolling buffer stays empty)
    const testFrame = createSyntheticAudioFrame({ rms: 500 });
    voiceInput.handleAudioFrame(testFrame);
    expect((voiceInput as any).rollingWakeFrames.length).toBe(0);

    // Exit speaking state
    voiceInput.exitSpeakingState('Playback complete');

    // Wait past echo cooldown window (600ms)
    await new Promise(r => setTimeout(r, 650));
    expect(voiceInput.isEchoSuppressionActive()).toBe(false);

    // Frame after cooldown should now be accepted into rolling buffer
    voiceInput.handleAudioFrame(testFrame);
    expect((voiceInput as any).rollingWakeFrames.length).toBeGreaterThanOrEqual(1);

    await voiceInput.stop();
  });

  // TEST 16: Diagnostic trail contains all required fields for a complete voice turn
  it('16. Diagnostic trail contains all required fields for a complete voice turn', () => {
    const diag = new VoiceDiagnosticsService(mockEventBus as any);

    diag.startTurn('sess-100', 'cmd-200');
    diag.recordDevice('mic-built-in-1', 16000, 1);
    diag.recordMicFrame(createSyntheticAudioFrame({ rms: 250 }));
    diag.recordVadState('SPEECH', 280);
    diag.recordWakeState('Hey Megh');
    diag.recordCommandCaptureState('TRANSCRIBING');
    diag.recordSttConnection('google-cloud-stt', 'v2-realtime', 'CONNECTED');
    diag.recordSttFrameSent(3200);
    diag.recordSttPartial('open');
    diag.recordSttFinal('open chrome browser');
    diag.recordModel('google-gemini', 'gemini-2.5-flash', 340);
    diag.recordTtsRequested('elevenlabs', 'eleven-rachel');
    diag.recordTtsResolved('elevenlabs', 'eleven-rachel');
    diag.recordTtsAudio('audio/mpeg', 18400);
    diag.recordAudioOutput('default-speakers', 42);

    const completed = diag.completeTurn(true);

    // Verify all 31 audit fields
    expect(completed.voiceSessionId).toBe('sess-100');
    expect(completed.commandId).toBe('cmd-200');
    expect(completed.micDeviceId).toBe('mic-built-in-1');
    expect(completed.micSampleRate).toBe(16000);
    expect(completed.micChannels).toBe(1);
    expect(completed.audioFramesReceived).toBe(1);
    expect(completed.audioBytesReceived).toBeGreaterThan(0);
    expect(completed.averageRms).toBe(250);
    expect(completed.maxRms).toBe(280);
    expect(completed.vadState).toBe('SPEECH');
    expect(completed.wakeState).toBe('Hey Megh');
    expect(completed.commandCaptureState).toBe('TRANSCRIBING');
    expect(completed.sttProvider).toBe('google-cloud-stt');
    expect(completed.sttModel).toBe('v2-realtime');
    expect(completed.sttConnectionState).toBe('FINALIZED');
    expect(completed.sttFramesSent).toBe(1);
    expect(completed.sttFinalTranscript).toBe('open chrome browser');
    expect(completed.modelProviderRequested).toBe('google-gemini');
    expect(completed.modelSelected).toBe('gemini-2.5-flash');
    expect(completed.modelLatencyMs).toBe(340);
    expect(completed.ttsProviderRequested).toBe('elevenlabs');
    expect(completed.ttsVoiceRequested).toBe('eleven-rachel');
    expect(completed.ttsProviderResolved).toBe('elevenlabs');
    expect(completed.ttsVoiceResolved).toBe('eleven-rachel');
    expect(completed.ttsFallbackTriggered).toBe(false);
    expect(completed.ttsAudioFormat).toBe('audio/mpeg');
    expect(completed.ttsAudioBytes).toBe(18400);
    expect(completed.audioOutputDeviceId).toBe('default-speakers');
    expect(completed.audioOutputLatencyMs).toBe(42);
    expect(completed.completedSuccessfully).toBe(true);
    expect(completed.turnDurationMs).toBeGreaterThanOrEqual(0);
  });
});
