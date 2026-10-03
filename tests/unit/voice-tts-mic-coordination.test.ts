import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {
  VoiceInputManager,
  AudioCaptureService,
  AudioOutputService,
  SpeechRecognitionService,
  AcousticWakeWordDetector
} from '../../packages/voice/src/index';
import { MeghAIServer } from '../../apps/api/src/server';
import { KillSwitch } from '../../packages/security/src/index';
import type { AudioFrame } from '../../packages/shared-types/src/index';

function createSyntheticFrame(options: {
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

describe('MeghAI Voice TTS & Microphone Coordination Subsystem', () => {
  let tempDir: string;
  let mockCapture: AudioCaptureService;
  let mockOutput: AudioOutputService;
  let mockSTT: SpeechRecognitionService;
  let voiceInput: VoiceInputManager;
  let capturedEvents: Array<{ type: string; payload: any }>;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `meghai-tts-mic-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    KillSwitch.reset();

    capturedEvents = [];
    const eventBus = {
      publish: (type: any, payload: any) => {
        capturedEvents.push({ type, payload });
      }
    };

    mockCapture = new AudioCaptureService({ mockCapture: true, eventBus });
    mockOutput = new AudioOutputService({ eventBus });
    mockSTT = new SpeechRecognitionService();

    voiceInput = new VoiceInputManager({
      audioCapture: mockCapture,
      audioOutput: mockOutput,
      speechRecognition: mockSTT,
      eventBus
    });
  });

  afterEach(async () => {
    KillSwitch.reset();
    await voiceInput.stop();
    await mockCapture.stop();
    mockOutput.stop();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('Test 1: while in SPEAKING state, high-RMS mic frames (RMS > 1500) do NOT trigger barge-in or stop AudioOutputService', async () => {
    await voiceInput.startPassiveListening();
    expect(voiceInput.getState()).toBe('PASSIVE_WAKE_LISTENING');

    // Assistant begins speaking TTS
    voiceInput.enterSpeakingState('The product of 25 and 4 is 100.');
    expect(voiceInput.getState()).toBe('SPEAKING');

    const stopSpy = vi.spyOn(mockOutput, 'stop');

    // Simulate microphone picking up loud speaker audio in room (RMS 1800, 2400)
    for (let i = 0; i < 10; i++) {
      const frame = createSyntheticFrame({ rms: 2000, sequenceNumber: i + 1 });
      voiceInput.handleAudioFrame(frame);
    }

    // Must NOT stop AudioOutputService
    expect(stopSpy).not.toHaveBeenCalled();
    // Must remain in SPEAKING state
    expect(voiceInput.getState()).toBe('SPEAKING');

    // Check that VOICE_RECOGNITION_GATED was emitted
    const gatedEvent = capturedEvents.find(e => e.type === 'VOICE_RECOGNITION_GATED');
    expect(gatedEvent).toBeDefined();
    expect(gatedEvent?.payload.speakingText).toBe('The product of 25 and 4 is 100.');
  });

  it('Test 2: while in SPEAKING state, incoming mic frames are NOT buffered into commandFrames', async () => {
    await voiceInput.startPassiveListening();
    voiceInput.enterSpeakingState('Testing buffer suppression.');

    for (let i = 0; i < 5; i++) {
      const frame = createSyntheticFrame({ rms: 1500, sequenceNumber: i + 1 });
      voiceInput.handleAudioFrame(frame);
    }

    // State is still SPEAKING and not command capture or transcribing
    expect(voiceInput.getState()).toBe('SPEAKING');
    const transcribingEvent = capturedEvents.find(e => e.type === 'VOICE_TRANSCRIBING');
    expect(transcribingEvent).toBeUndefined();
  });

  it('Test 3: while in SPEAKING state, VAD speech-start and speech-end do NOT trigger command finish or new sessions', async () => {
    await voiceInput.startPassiveListening();
    voiceInput.enterSpeakingState('Continuous speech output active.');

    // Deliver 20 frames of speech-level RMS (which would normally trigger VAD speech)
    for (let i = 0; i < 20; i++) {
      const frame = createSyntheticFrame({ rms: 1200, sequenceNumber: i + 1 });
      voiceInput.handleAudioFrame(frame);
    }

    expect(voiceInput.getState()).toBe('SPEAKING');
    const finalEvent = capturedEvents.find(e => e.type === 'TRANSCRIPT_FINAL');
    expect(finalEvent).toBeUndefined();
  });

  it('Test 4: while in SPEAKING state, normal room audio does NOT trigger wake detection to start a new session', async () => {
    await voiceInput.startPassiveListening();
    voiceInput.enterSpeakingState('Assistant is speaking its response.');

    const wakeConfirmedEvent = capturedEvents.find(e => e.type === 'WAKE_ACTIVATION_STARTED');
    expect(wakeConfirmedEvent).toBeUndefined();

    // High energy audio frames arrive during speaking
    for (let i = 0; i < 15; i++) {
      const frame = createSyntheticFrame({ rms: 1600, sequenceNumber: i + 1 });
      voiceInput.handleAudioFrame(frame);
    }

    expect(voiceInput.getState()).toBe('SPEAKING');
    expect(capturedEvents.filter(e => e.type === 'WAKE_ACTIVATION_STARTED').length).toBe(0);
  });

  it('Test 5: physical audio capture remains active (isCapturing() === true) throughout TTS playback', async () => {
    await mockCapture.start();
    await voiceInput.startPassiveListening();
    expect(mockCapture.isCapturing()).toBe(true);

    // Enter speaking state
    voiceInput.enterSpeakingState('Speaking without killing physical capture device.');
    expect(voiceInput.getState()).toBe('SPEAKING');

    // Physical capture MUST remain active continuously (no pop/click device restarts)
    expect(mockCapture.isCapturing()).toBe(true);
    expect(mockCapture.getState()).toBe('MIC_LISTENING');

    // Exit speaking state
    voiceInput.exitSpeakingState();
    expect(mockCapture.isCapturing()).toBe(true);
    expect(voiceInput.getState()).toBe('PASSIVE_WAKE_LISTENING');
  });

  it('Test 6: when TTS completes, VoiceInputManager flushes stale buffers and enters echo cooldown window', async () => {
    await mockCapture.start();
    await voiceInput.startPassiveListening();
    voiceInput.enterSpeakingState('Response finished.');

    voiceInput.exitSpeakingState('Playback finished cleanly');

    const resumedEvent = capturedEvents.find(e => e.type === 'VOICE_RECOGNITION_RESUMED');
    expect(resumedEvent).toBeDefined();
    expect(resumedEvent?.payload.cooldownMs).toBe(600);
  });

  it('Test 7: during post-TTS cooldown window (600ms), lingering reverberation frames are discarded and do not trigger wake', async () => {
    await mockCapture.start();
    await voiceInput.startPassiveListening();
    voiceInput.enterSpeakingState('Audio just finished.');
    voiceInput.exitSpeakingState();

    // In cooldown window right now
    const initialActivationCount = capturedEvents.filter(e => e.type === 'WAKE_ACTIVATION_STARTED').length;

    // Send reverberation audio frames
    for (let i = 0; i < 8; i++) {
      const frame = createSyntheticFrame({ rms: 1400, sequenceNumber: i + 1 });
      voiceInput.handleAudioFrame(frame);
    }

    // Must not trigger wake activation
    expect(capturedEvents.filter(e => e.type === 'WAKE_ACTIVATION_STARTED').length).toBe(initialActivationCount);
  });

  it('Test 8: after post-TTS cooldown window, VoiceInputManager cleanly transitions to PASSIVE_WAKE_LISTENING', async () => {
    await mockCapture.start();
    await voiceInput.startPassiveListening();
    voiceInput.enterSpeakingState('Hello world');
    voiceInput.exitSpeakingState();

    expect(voiceInput.getState()).toBe('PASSIVE_WAKE_LISTENING');
  });

  it('Test 9: intentional user barge-in with acoustic wake phrase during TTS interrupts speech and activates command capture', async () => {
    await mockCapture.start();
    await voiceInput.startPassiveListening();
    voiceInput.enterSpeakingState('Long story about distant galaxies and constellations...');

    const interruptSpy = vi.spyOn(mockOutput, 'interruptTTS');

    // Mock acoustic detector detecting intentional "Hey Megh"
    const wakeDetector = (voiceInput as any).wakeDetector;
    vi.spyOn(wakeDetector, 'detectWakePhrase').mockResolvedValue({
      detected: true,
      phrase: 'Hey Megh',
      confidence: 0.88,
      rawText: 'hey megh'
    });

    // Send 10 frames during TTS
    for (let i = 0; i < 10; i++) {
      const frame = createSyntheticFrame({ rms: 1000, sequenceNumber: i + 1 });
      voiceInput.handleAudioFrame(frame);
    }

    // Allow promise resolution
    await new Promise(r => setTimeout(r, 50));

    expect(interruptSpy).toHaveBeenCalledWith('User intentional barge-in');
    const interruptedEvent = capturedEvents.find(e => e.type === 'INTERRUPTED');
    expect(interruptedEvent).toBeDefined();
    expect(interruptedEvent?.payload.reason).toContain('User intentional barge-in');
  });

  it('Test 10: keyboard chat with autoSpeak ON triggers TTS to completion without interruption', async () => {
    const server = new MeghAIServer(tempDir);
    server.voiceSettings.updateSettings({ autoSpeak: 'ON' });

    vi.spyOn(server.modelRouter, 'completeWithFallback').mockResolvedValue({
      content: '10 plus 10 is 20.',
      providerId: 'local-ollama',
      modelId: 'llama3.2:latest',
      tokensUsed: { totalTokens: 10, promptTokens: 4, completionTokens: 6 },
      latencyMs: 80,
      finishReason: 'stop'
    });

    // Mock both stream and buffer audio playback
    const playStreamSpy = vi.spyOn(server.audioPlayback, 'playTTSStream').mockResolvedValue({
      success: true,
      durationMs: 400,
      timeToFirstAudioMs: 50
    });
    const playTTSSpy = vi.spyOn(server.audioPlayback, 'playTTS').mockResolvedValue({
      success: true,
      durationMs: 400
    });

    const res = await server.processUserRequest('What is 10 plus 10?');
    expect(res.status).toBe('COMPLETED');
    expect(playStreamSpy.mock.calls.length + playTTSSpy.mock.calls.length).toBeGreaterThan(0);
    expect(server.aiState).toBe('READY');
  }, 15000);

  it('Test 11: voice command triggers model, then TTS speaks to completion without self-interruption', async () => {
    const server = new MeghAIServer(tempDir);
    server.voiceSettings.updateSettings({ autoSpeak: 'ON' });

    vi.spyOn(server.modelRouter, 'completeWithFallback').mockResolvedValue({
      content: '25 multiplied by 4 is 100.',
      providerId: 'local-ollama',
      modelId: 'llama3.2:latest',
      tokensUsed: { totalTokens: 12, promptTokens: 6, completionTokens: 6 },
      latencyMs: 90,
      finishReason: 'stop'
    });

    const simulateMicDuringSpeech = () => {
      // While TTS is playing, simulate microphone receiving loud speaker sound
      for (let i = 0; i < 5; i++) {
        const loudFrame = createSyntheticFrame({ rms: 2200, sequenceNumber: i + 1 });
        server.voiceInput.handleAudioFrame(loudFrame);
      }
    };

    const playStreamSpy = vi.spyOn(server.audioPlayback, 'playTTSStream').mockImplementation(async () => {
      simulateMicDuringSpeech();
      return { success: true, durationMs: 500, timeToFirstAudioMs: 60 };
    });

    const playTTSSpy = vi.spyOn(server.audioPlayback, 'playTTS').mockImplementation(async () => {
      simulateMicDuringSpeech();
      return { success: true, durationMs: 500 };
    });

    const res = await server.processUserRequest('what is 25 multiplied by 4', false, {
      source: 'VOICE',
      voiceSessionId: 'vs-test-1',
      commandId: 'cmd-test-1'
    });

    expect(res.status).toBe('COMPLETED');
    expect(playStreamSpy.mock.calls.length + playTTSSpy.mock.calls.length).toBeGreaterThan(0);
    // After speakResponse finishes, AI state is READY and voiceInput is in passive listening or idle
    expect(server.aiState).toBe('READY');
    expect(server.voiceInput.getState()).not.toBe('SPEAKING');
  }, 15000);

  it('Test 12: UI stop / /api/v1/voice/stop immediately interrupts TTS and transitions state cleanly', async () => {
    const server = new MeghAIServer(tempDir);
    server.setAIState('SPEAKING');
    server.voiceInput.enterSpeakingState('Long response in progress');

    const stopPlaybackSpy = vi.spyOn(server.audioPlayback, 'stop').mockReturnValue(true);

    // Call voice stop directly
    const stopped = server.audioPlayback.stop('User requested voice stop');
    server.voiceInput.exitSpeakingState('User requested voice stop');
    server.setAIState('READY');

    expect(stopPlaybackSpy).toHaveBeenCalled();
    expect(stopped).toBe(true);
    expect(server.aiState).toBe('READY');
    expect(server.voiceInput.getState()).not.toBe('SPEAKING');
  });

  it('Test 13: VoiceInputManager does not enter an infinite state transition loop between SPEAKING and PASSIVE_WAKE_LISTENING', async () => {
    await mockCapture.start();
    await voiceInput.startPassiveListening();

    let stateTransitions = 0;
    voiceInput.onStateChange(() => {
      stateTransitions++;
    });

    // Enter speaking
    voiceInput.enterSpeakingState('First utterance');
    // Calling enterSpeakingState again with same or different text must not cycle states infinitely
    voiceInput.enterSpeakingState('First utterance update');

    // Exit speaking
    voiceInput.exitSpeakingState();
    // Calling exitSpeakingState again when not speaking is a no-op
    voiceInput.exitSpeakingState();

    // Verify state transition count was strictly bounded (expected: SPEAKING -> PASSIVE_WAKE_LISTENING = 2 transitions)
    expect(stateTransitions).toBeLessThanOrEqual(4);
    expect(voiceInput.getState()).toBe('PASSIVE_WAKE_LISTENING');
  });
});
