import type {
  AudioFrame,
  VoiceInputState,
  WakeWordResult,
  STTResult,
  EventType
} from '@meghai/shared-types';
import { VoiceActivityDetector } from './vad.js';
import { AcousticWakeWordDetector } from './wake-word.js';
import { SpeechRecognitionService } from './stt.js';
import { AudioCaptureService } from './index.js';
import { AudioOutputService } from './output-service.js';

export interface VoiceInputManagerOptions {
  audioCapture: AudioCaptureService;
  audioOutput: AudioOutputService;
  speechRecognition?: SpeechRecognitionService;
  eventBus?: { publish: (type: EventType, payload: any, correlationId?: string) => void };
  onCommand?: (transcript: string) => Promise<void> | void;
  maxCommandDurationMs?: number; // default: 12000
}

/**
 * Master Voice Input Manager (Phases 8 - 15)
 * Orchestrates full microphone audio pipeline:
 * MICROPHONE -> VAD -> WAKE-WORD -> COMMAND_CAPTURE -> STT -> COMMAND PIPELINE -> TTS
 * Strictly guarded state transitions with zero event loops and instant KillSwitch abort.
 */
export class VoiceInputManager {
  private state: VoiceInputState = 'IDLE';
  private readonly audioCapture: AudioCaptureService;
  private readonly audioOutput: AudioOutputService;
  private readonly speechRecognition: SpeechRecognitionService;
  private readonly vad: VoiceActivityDetector;
  private readonly wakeDetector: AcousticWakeWordDetector;
  private readonly eventBus?: { publish: (type: EventType, payload: any, correlationId?: string) => void };
  private readonly commandHandler?: (transcript: string) => Promise<void> | void;
  private readonly maxCommandDurationMs: number;

  private rollingWakeFrames: AudioFrame[] = [];
  private commandFrames: AudioFrame[] = [];
  private commandStartTime = 0;
  private commandTimer: NodeJS.Timeout | null = null;
  private isProcessingWake = false;
  private unsubscribeFrame?: () => void;
  private onStateCallbacks = new Set<(state: VoiceInputState, reason?: string) => void>();

  constructor(options: VoiceInputManagerOptions) {
    this.audioCapture = options.audioCapture;
    this.audioOutput = options.audioOutput;
    this.speechRecognition = options.speechRecognition || new SpeechRecognitionService();
    this.eventBus = options.eventBus;
    this.commandHandler = options.onCommand;
    this.maxCommandDurationMs = options.maxCommandDurationMs ?? 12000;

    this.vad = new VoiceActivityDetector({
      eventBus: this.eventBus,
      onSpeechStart: () => {
        if (this.state === 'PASSIVE_WAKE_LISTENING') {
          // Speech started while listening for wake word
        }
      },
      onSpeechEnd: () => {
        if (this.state === 'COMMAND_CAPTURE') {
          // User stopped speaking command; trigger transcription
          this.finishCommandCapture('VAD speech ended');
        }
      }
    });

    this.wakeDetector = new AcousticWakeWordDetector({
      eventBus: this.eventBus,
      onWakeDetected: (res) => this.handleWakeConfirmed(res)
    });
  }

  public getState(): VoiceInputState {
    return this.state;
  }

  private setState(newState: VoiceInputState, reason?: string): void {
    if (this.state === newState) return;
    this.state = newState;
    this.eventBus?.publish('VOICE_INPUT_STATE_CHANGED', { state: newState, reason });
    for (const cb of this.onStateCallbacks) {
      try { cb(newState, reason); } catch {}
    }
  }

  /**
   * Start passive wake listening
   */
  public async startPassiveListening(): Promise<void> {
    if (this.state !== 'IDLE' && this.state !== 'ERROR') {
      return;
    }

    if (!this.audioCapture.isCapturing()) {
      await this.audioCapture.start();
    }

    this.rollingWakeFrames = [];
    this.commandFrames = [];
    this.vad.reset();
    this.wakeDetector.reset();

    if (!this.unsubscribeFrame) {
      this.unsubscribeFrame = this.audioCapture.onFrame(frame => this.handleAudioFrame(frame));
    }

    this.setState('PASSIVE_WAKE_LISTENING', 'Microphone active, listening for wake phrase');
  }

  /**
   * Stop voice input pipeline completely
   */
  public async stop(reason = 'Voice input stopped'): Promise<void> {
    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }

    if (this.unsubscribeFrame) {
      this.unsubscribeFrame();
      this.unsubscribeFrame = undefined;
    }

    this.rollingWakeFrames = [];
    this.commandFrames = [];
    this.vad.reset();
    this.wakeDetector.reset();

    this.setState('IDLE', reason);
  }

  /**
   * Process each sequential 100ms audio frame
   */
  private handleAudioFrame(frame: AudioFrame): void {
    // 1. Process VAD
    const vadResult = this.vad.processFrame(frame);

    // 2. Handle state-specific routing
    if (this.state === 'PASSIVE_WAKE_LISTENING') {
      // Maintain rolling buffer of last 15 frames (~1.5s of audio)
      this.rollingWakeFrames.push(frame);
      if (this.rollingWakeFrames.length > 15) {
        this.rollingWakeFrames.shift();
      }

      // Check wake word if frame has sufficient acoustic energy and we have >= 8 frames (800ms)
      if (vadResult.isSpeech && this.rollingWakeFrames.length >= 8 && !this.isProcessingWake) {
        this.triggerWakeCheck();
      }
    } else if (this.state === 'COMMAND_CAPTURE') {
      this.commandFrames.push(frame);

      // Check max command duration timeout
      if (Date.now() - this.commandStartTime >= this.maxCommandDurationMs) {
        this.finishCommandCapture('Max duration timeout reached');
      }
    }
  }

  /**
   * Check rolling audio frames for "Hey Megh" or "Megh"
   */
  private async triggerWakeCheck(): Promise<void> {
    if (this.isProcessingWake || this.state !== 'PASSIVE_WAKE_LISTENING') return;

    this.isProcessingWake = true;
    try {
      const pcmBuffer = Buffer.concat(this.rollingWakeFrames.map(f => f.data));
      await this.wakeDetector.detectWakePhrase(pcmBuffer);
    } catch {} finally {
      this.isProcessingWake = false;
    }
  }

  /**
   * Guarded transition: Wake phrase confirmed
   */
  private async handleWakeConfirmed(res: WakeWordResult): Promise<void> {
    if (this.state !== 'PASSIVE_WAKE_LISTENING') return;

    this.setState('WAKE_CONFIRMED', `Acoustic match: ${res.phrase} (${res.confidence})`);

    // Play pleasant activation / listening chime cue
    try {
      await this.audioOutput.playCue('listening');
    } catch {}

    // Transition directly into command capture
    this.commandFrames = [];
    this.commandStartTime = Date.now();
    this.vad.reset();
    this.setState('COMMAND_CAPTURE', 'Listening for user command');

    // Safety timeout to prevent staying in command capture indefinitely
    if (this.commandTimer) clearTimeout(this.commandTimer);
    this.commandTimer = setTimeout(() => {
      if (this.state === 'COMMAND_CAPTURE') {
        this.finishCommandCapture('Command silence timeout');
      }
    }, this.maxCommandDurationMs);
  }

  /**
   * Finish command audio capture and begin transcription
   */
  private async finishCommandCapture(reason: string): Promise<void> {
    if (this.state !== 'COMMAND_CAPTURE') return;

    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }

    if (this.commandFrames.length < 3) {
      // Audio too short (<300ms), return to passive listening
      this.setState('PASSIVE_WAKE_LISTENING', 'Command audio too short');
      return;
    }

    const commandAudioPcm = Buffer.concat(this.commandFrames.map(f => f.data));
    this.commandFrames = [];

    this.setState('TRANSCRIBING', reason);
    this.eventBus?.publish('VOICE_TRANSCRIBING', {
      durationMs: commandAudioPcm.length / 32,
      bytes: commandAudioPcm.length
    });

    try {
      const result: STTResult = await this.speechRecognition.transcribe(commandAudioPcm);
      const text = (result.text || '').trim();

      if (text.length > 0) {
        this.eventBus?.publish('TRANSCRIPT_FINAL', {
          text,
          confidence: result.confidence,
          culture: result.culture
        });

        // Transition to PROCESSING and dispatch to command handler
        this.setState('PROCESSING', `Executing command: "${text}"`);

        if (this.commandHandler) {
          await this.commandHandler(text);
        }

        // Return to passive listening once processing / speaking concludes
        if (this.audioCapture.isCapturing()) {
          this.setState('PASSIVE_WAKE_LISTENING', 'Resumed passive listening');
        } else {
          this.setState('IDLE', 'Command completed');
        }
      } else {
        // No discernible speech recognized
        this.setState('PASSIVE_WAKE_LISTENING', 'No speech recognized, resumed passive listening');
      }
    } catch (err: any) {
      this.eventBus?.publish('VOICE_ERROR', { error: err.message });
      this.setState('PASSIVE_WAKE_LISTENING', `Transcription error: ${err.message}`);
    }
  }

  public onStateChange(cb: (state: VoiceInputState, reason?: string) => void): () => void {
    this.onStateCallbacks.add(cb);
    return () => this.onStateCallbacks.delete(cb);
  }
}
