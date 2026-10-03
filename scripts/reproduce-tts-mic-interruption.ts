import { VoiceInputManager } from '../packages/voice/src/voice-input-manager.js';
import { AudioOutputService } from '../packages/voice/src/output-service.js';
import { AudioCaptureService } from '../packages/voice/src/index.js';
import { EventBus } from '../packages/events/src/index.js';
import type { AudioFrame } from '@meghai/shared-types';

async function reproduce() {
  const eventBus = new EventBus();
  const eventTrace: Array<{ type: string; payload: any; timestamp: number }> = [];

  eventBus.subscribe('*', (evt) => {
    eventTrace.push({ type: evt.type, payload: evt.payload, timestamp: Date.now() });
    console.log(`[EVENT] ${evt.type}:`, typeof evt.payload === 'object' ? JSON.stringify(evt.payload).slice(0, 100) : evt.payload);
  });

  const audioCapture = new AudioCaptureService({ mockCapture: true });
  const audioOutput = new AudioOutputService({ eventBus });

  let commandProcessed = false;

  const voiceInput = new VoiceInputManager({
    audioCapture,
    audioOutput,
    eventBus,
    speechRecognition: {
      transcribe: async () => ({
        text: 'what is 25 multiplied by 4',
        confidence: 0.99,
        providerId: 'mock-online',
        source: 'online'
      }),
      isAvailable: async () => true,
      getStats: () => ({ totalTranscriptions: 1, failedTranscriptions: 0, averageLatencyMs: 50, cacheHitRate: 0 })
    } as any,
    onCommand: async (cmd, meta) => {
      console.log(`[COMMAND HANDLER CALLED] "${cmd}"`);
      commandProcessed = true;
      // Simulate server speakResponse starting TTS playback
      console.log('[SIMULATING TTS PLAYBACK START]');
      // Start fake TTS playback that takes 1000ms
      const fakeStream: AsyncIterable<Buffer> = {
        [Symbol.asyncIterator]: () => {
          let chunk = 0;
          return {
            async next() {
              if (chunk++ < 1) {
                // Return a WAV chunk
                const pcm = Buffer.alloc(16000 * 2); // 1 sec of audio
                return { done: false, value: pcm };
              }
              return { done: true, value: undefined };
            }
          };
        }
      };

      // Start TTS playback in background
      const playPromise = audioOutput.playTTSStream(fakeStream, {
        voiceId: 'onecore-heera',
        text: '25 multiplied by 4 is 100'
      });

      // While TTS is playing, simulate microphone frames capturing speaker output with RMS = 1200
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 100));
        const speakerEchoFrame: AudioFrame = {
          data: Buffer.alloc(3200),
          timestamp: Date.now(),
          sequenceNumber: 100 + i,
          sampleRate: 16000,
          channels: 1,
          format: 'pcm_s16le',
          durationMs: 100,
          rms: 1200, // Speaker output picked up by mic
          peak: 2400,
          normalizedLevel: 0.12
        };
        console.log(`[FEEDING MIC FRAME DURING TTS] rms=${speakerEchoFrame.rms} isPlaying=${audioOutput.isPlaying()}`);
        voiceInput.handleAudioFrame(speakerEchoFrame);
      }

      await playPromise.catch(err => console.log('[TTS ERROR/STOP]', err.message));
    }
  });

  await voiceInput.startPassiveListening();
  console.log('[INITIAL STATE]', voiceInput.getState());

  // Simulate user speaking "Hey Megh"
  console.log('[SIMULATING WAKE DETECTION]');
  (voiceInput as any).handleWakeConfirmed({
    phrase: 'hey megh',
    confidence: 0.95,
    matchedIndices: [0, 1]
  });

  console.log('[STATE AFTER WAKE]', voiceInput.getState());

  // Simulate user speaking command for 500ms
  for (let i = 0; i < 5; i++) {
    const frame: AudioFrame = {
      data: Buffer.alloc(3200),
      timestamp: Date.now(),
      sequenceNumber: i + 1,
      sampleRate: 16000,
      channels: 1,
      format: 'pcm_s16le',
      durationMs: 100,
      rms: 800,
      peak: 1600,
      normalizedLevel: 0.08
    };
    voiceInput.handleAudioFrame(frame);
  }

  // Finish command capture (simulating silence end)
  console.log('[FINISHING COMMAND CAPTURE]');
  await (voiceInput as any).finishCommandCapture('Silence detected');

  console.log('[FINAL STATE]', voiceInput.getState());
  console.log('[FINAL IS_PLAYING]', audioOutput.isPlaying());

  const interruptedEvents = eventTrace.filter(e => e.type === 'INTERRUPTED');
  console.log('[INTERRUPTED EVENTS COUNT]:', interruptedEvents.length);
  if (interruptedEvents.length > 0) {
    console.log('[INTERRUPTED EVENT DETAILS]:', interruptedEvents[0]);
  }
}

reproduce().catch(console.error);
