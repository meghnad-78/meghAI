import type {
  AudioFrame,
  VoiceInputState,
  WakeWordResult,
  STTResult,
  EventType
} from '@meghai/shared-types';
import { VoiceActivityDetector } from './vad.js';
import { AcousticWakeWordDetector, stripWakePhrase } from './wake-word.js';
import { SpeechRecognitionService } from './stt.js';
import { AudioCaptureService } from './index.js';
import { AudioOutputService } from './output-service.js';

export interface VoiceCommandMeta {
  voiceSessionId: string;
  commandId: string;
}

export interface VoiceInputManagerOptions {
  audioCapture: AudioCaptureService;
  audioOutput: AudioOutputService;
  speechRecognition?: SpeechRecognitionService;
  eventBus?: { publish: (type: EventType, payload: any, correlationId?: string) => void };
  onCommand?: (transcript: string, meta?: VoiceCommandMeta) => Promise<void> | void;
  maxCommandDurationMs?: number; // default: 60000 (60s)
  silenceThresholdMs?: number;   // default: 2200 (2.2s)
}

/**
 * Master Voice Input Manager (Online-First Real-Time Architecture)
 * Orchestrates full microphone audio pipeline:
 * MICROPHONE -> VAD -> WAKE-WORD -> WAKE_DETECTED -> ACTIVATION -> COMMAND_LISTENING -> STT -> MODEL -> TTS
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
  private readonly commandHandler?: (transcript: string, meta?: VoiceCommandMeta) => Promise<void> | void;
  private readonly maxCommandDurationMs: number;
  private readonly silenceThresholdMs: number;

  private currentVoiceSessionId: string | null = null;
  private currentCommandId: string | null = null;
  private isTranscribing = false;
  private isProcessingCommand = false;
  private isSpeaking = false;
  private currentSpeakingText: string | null = null;
  private bargeInFrames: AudioFrame[] = [];
  private isCheckingBargeIn = false;
  private echoCooldownUntil = 0;
  private processedCommandHashes = new Set<string>();

  private rollingWakeFrames: AudioFrame[] = [];
  private commandFrames: AudioFrame[] = [];
  private commandStartTime = 0;
  private commandTimer: NodeJS.Timeout | null = null;
  private silenceCheckTimer: NodeJS.Timeout | null = null;
  private speechDetectedInSession = false;
  private isProcessingWake = false;
  private lastPartialTranscriptTime = 0;
  private isProcessingPartial = false;
  private unsubscribeFrame?: () => void;
  private unsubscribeAudioOutput?: () => void;
  private onStateCallbacks = new Set<(state: VoiceInputState, reason?: string) => void>();

  constructor(options: VoiceInputManagerOptions) {
    this.audioCapture = options.audioCapture;
    this.audioOutput = options.audioOutput;
    this.speechRecognition = options.speechRecognition || new SpeechRecognitionService();
    this.eventBus = options.eventBus;
    this.commandHandler = options.onCommand;
    this.maxCommandDurationMs = options.maxCommandDurationMs ?? 60000;
    this.silenceThresholdMs = options.silenceThresholdMs ?? 2200;

    // Direct synchronization with AudioOutputService
    if (this.audioOutput && typeof this.audioOutput.onStateChange === 'function') {
      this.unsubscribeAudioOutput = this.audioOutput.onStateChange((outputState, reason) => {
        if (outputState === 'PLAYING_TTS') {
          this.enterSpeakingState(this.audioOutput.getCurrentSpeakingText() || '');
        } else if (outputState === 'IDLE' || outputState === 'STOPPING') {
          if (this.isSpeaking || this.state === 'SPEAKING') {
            this.exitSpeakingState(reason);
          }
        }
      });
    }

    this.vad = new VoiceActivityDetector({
      eventBus: this.eventBus,
      silenceTimeoutMs: this.silenceThresholdMs,
      onSpeechStart: () => {
        if (this.state === 'COMMAND_CAPTURE' || (this.state as any) === 'COMMAND_LISTENING') {
          this.speechDetectedInSession = true;
          if (this.silenceCheckTimer) {
            clearTimeout(this.silenceCheckTimer);
            this.silenceCheckTimer = null;
          }
        }
      },
      onSpeechEnd: () => {
        if (this.state === 'COMMAND_CAPTURE' || (this.state as any) === 'COMMAND_LISTENING') {
          // User finished speaking their command after sustained silence >= silenceThresholdMs
          this.finishCommandCapture('VAD silence threshold reached');
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
    this.currentVoiceSessionId = null;
    this.currentCommandId = null;
    this.isTranscribing = false;
    this.isProcessingCommand = false;
    this.speechDetectedInSession = false;

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
    if (this.silenceCheckTimer) {
      clearTimeout(this.silenceCheckTimer);
      this.silenceCheckTimer = null;
    }

    if (this.unsubscribeFrame) {
      this.unsubscribeFrame();
      this.unsubscribeFrame = undefined;
    }

    if (this.unsubscribeAudioOutput) {
      this.unsubscribeAudioOutput();
      this.unsubscribeAudioOutput = undefined;
    }

    this.isSpeaking = false;
    this.currentSpeakingText = null;
    this.bargeInFrames = [];
    this.isCheckingBargeIn = false;

    this.rollingWakeFrames = [];
    this.commandFrames = [];
    this.vad.reset();
    this.wakeDetector.reset();
    this.currentVoiceSessionId = null;
    this.currentCommandId = null;
    this.isTranscribing = false;
    this.isProcessingCommand = false;
    this.speechDetectedInSession = false;

    this.setState('IDLE', reason);
  }

  /**
   * Enter SPEAKING state when assistant begins audio playback.
   * Suppresses wake detection, STT, and command VAD.
   */
  public enterSpeakingState(spokenText = ''): void {
    if (this.isSpeaking && this.state === 'SPEAKING') {
      this.currentSpeakingText = spokenText;
      return;
    }

    this.isSpeaking = true;
    this.currentSpeakingText = spokenText;

    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }
    if (this.silenceCheckTimer) {
      clearTimeout(this.silenceCheckTimer);
      this.silenceCheckTimer = null;
    }

    this.flushStaleAudio();
    this.setState('SPEAKING', 'Audio playback active, voice recognition gated');
    this.eventBus?.publish('VOICE_RECOGNITION_GATED', {
      reason: 'TTS playback active',
      speakingText: spokenText
    });
  }

  /**
   * Exit SPEAKING state when assistant completes audio playback.
   * Flushes stale audio buffers containing speaker sound and enters echo cooldown.
   */
  public exitSpeakingState(reason = 'Audio playback completed'): void {
    if (!this.isSpeaking && this.state !== 'SPEAKING') {
      return;
    }

    this.isSpeaking = false;
    this.currentSpeakingText = null;
    this.flushStaleAudio();

    // Echo cooldown window (600ms) to clear room reverberation and echo
    this.echoCooldownUntil = Date.now() + 600;

    this.eventBus?.publish('VOICE_RECOGNITION_RESUMED', {
      reason,
      cooldownMs: 600
    });

    if (this.audioCapture.isCapturing()) {
      this.setState('PASSIVE_WAKE_LISTENING', 'Playback finished, resumed passive wake listening');
    } else {
      this.setState('IDLE', 'Playback finished');
    }
  }

  /**
   * Flush stale audio buffers that may contain speaker output or stale room sound
   */
  public flushStaleAudio(): void {
    this.commandFrames = [];
    this.rollingWakeFrames = [];
    this.bargeInFrames = [];
    this.vad.reset();
    this.wakeDetector.reset();
    this.isTranscribing = false;
    this.isProcessingPartial = false;
  }

  /**
   * Process each sequential 100ms audio frame
   */
  public handleAudioFrame(frame: AudioFrame): void {
    const now = Date.now();

    // 0. Hard voice state gating during TTS playback (Parts 3, 4, 5)
    const isSpeakingNow =
      this.isSpeaking ||
      this.state === 'SPEAKING' ||
      (this.audioOutput && (this.audioOutput.isSpeakingTTS() || this.audioOutput.isPlaying()));

    if (isSpeakingNow) {
      if (this.rollingWakeFrames.length > 0) {
        this.rollingWakeFrames = [];
      }
      if (this.commandFrames.length > 0) {
        this.commandFrames = [];
      }
      // CRITICAL: Raw RMS threshold alone (e.g. frame.rms > 750) is NEVER a barge-in trigger!
      // Assistant speaker audio reflected into the microphone easily reaches 1000-3000 RMS.
      // While speaking: keep physical capture alive, but strictly gate VAD, STT, and command accumulation.

      // Rolling buffer for intentional acoustic barge-in verification (user speaking "Hey Megh")
      this.bargeInFrames.push(frame);
      if (this.bargeInFrames.length > 15) {
        this.bargeInFrames.shift();
      }

      if (this.bargeInFrames.length >= 8 && !this.isCheckingBargeIn) {
        this.checkBargeInWakePhrase();
      }

      // Return immediately — do NOT process VAD, do NOT buffer into commandFrames, do NOT trigger wake
      return;
    }

    // In post-TTS echo cooldown window (600ms), clear any lingering reverberation
    if (now < this.echoCooldownUntil) {
      if (this.rollingWakeFrames.length > 0) this.rollingWakeFrames = [];
      if (this.commandFrames.length > 0) this.commandFrames = [];
      return;
    }

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
    } else if (this.state === 'COMMAND_CAPTURE' || (this.state as any) === 'COMMAND_LISTENING') {
      // IN COMMAND LISTENING: NEVER DROP INCOMING AUDIO FRAMES
      this.commandFrames.push(frame);

      // Periodically trigger partial transcript preview every 2.5s
      if (
        now - this.lastPartialTranscriptTime >= 2500 &&
        !this.isProcessingPartial &&
        this.commandFrames.length >= 15
      ) {
        this.lastPartialTranscriptTime = now;
        this.triggerPartialTranscript().catch(() => {});
      }

      // Check max command duration safety timeout
      if (now - this.commandStartTime >= this.maxCommandDurationMs) {
        this.finishCommandCapture('Max duration timeout reached');
      }
    }
  }

  /**
   * Periodic partial transcription preview for live UI feedback
   */
  private async triggerPartialTranscript(): Promise<void> {
    if (this.isProcessingPartial || this.commandFrames.length < 15) return;
    this.isProcessingPartial = true;
    try {
      const pcmBuffer = Buffer.concat(this.commandFrames.map(f => f.data));
      const result = await this.speechRecognition.transcribe(pcmBuffer);
      const text = (result.interpretedText || result.text || '').trim();
      if (text && (this.state === 'COMMAND_CAPTURE' || (this.state as any) === 'COMMAND_LISTENING')) {
        const stripped = stripWakePhrase(text);
        const clean = (stripped.cleaned || text).trim();
        if (clean) {
          this.emitPartialTranscript(clean);
        }
      }
    } catch {
      // Partials are best-effort preview telemetry
    } finally {
      this.isProcessingPartial = false;
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
   * Check rolling audio frames during TTS for intentional acoustic barge-in ("Hey Megh" / "Hey Megh, stop")
   * Strictly verifies acoustic wake phrase and prevents self-speech interruption.
   */
  private async checkBargeInWakePhrase(): Promise<void> {
    if (this.isCheckingBargeIn || (!this.isSpeaking && this.state !== 'SPEAKING')) return;
    this.isCheckingBargeIn = true;
    try {
      const pcmBuffer = Buffer.concat(this.bargeInFrames.map(f => f.data));
      const res = await this.wakeDetector.detectWakePhrase(pcmBuffer);
      if (res && res.detected && (res.confidence ?? 0) >= 0.70) {
        // Prevent false barge-in if the assistant is speaking its own name (e.g. "I am MeghAI")
        const currentText = (this.currentSpeakingText || '').toLowerCase();
        const isSelfSpeakingWake = currentText.includes('hey megh') || currentText.includes('megh');
        if (isSelfSpeakingWake && (res.confidence ?? 0) < 0.85) {
          return;
        }

        // Verified intentional user barge-in!
        this.eventBus?.publish('INTERRUPTED', {
          reason: 'User intentional barge-in detected during TTS',
          phrase: res.phrase,
          confidence: res.confidence
        });

        if (this.audioOutput) {
          this.audioOutput.interruptTTS('User intentional barge-in');
        }

        this.exitSpeakingState('User intentional barge-in');
        await this.handleWakeConfirmed(res);
      }
    } catch {
      // Best-effort acoustic barge-in check
    } finally {
      this.isCheckingBargeIn = false;
    }
  }

  /**
   * Guarded transition: Wake phrase confirmed (Section 4 & 5)
   * WAKE_DETECTED -> ACTIVATION -> COMMAND_LISTENING immediately without waiting on cue
   */
  private async handleWakeConfirmed(res: WakeWordResult): Promise<void> {
    if (this.state !== 'PASSIVE_WAKE_LISTENING' && this.state !== 'SPEAKING') return;

    // Allocate fresh voiceSessionId and commandId
    this.currentVoiceSessionId = `vs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.currentCommandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.isTranscribing = false;
    this.isProcessingCommand = false;
    this.speechDetectedInSession = false;

    // Retain trailing frames (300ms pre-roll) so words immediately following wake are not clipped
    const preRoll = this.rollingWakeFrames.slice(-3);
    this.commandFrames = [...preRoll];
    this.rollingWakeFrames = [];

    // State: WAKE_DETECTED / WAKE_CONFIRMED
    this.setState('WAKE_CONFIRMED', `Acoustic match: ${res.phrase} (${res.confidence})`);
    this.eventBus?.publish('WAKE_ACTIVATION_STARTED', {
      phrase: res.phrase,
      confidence: res.confidence,
      voiceSessionId: this.currentVoiceSessionId,
      commandId: this.currentCommandId
    });

    // Play activation / listening chime cue asynchronously (non-blocking)
    this.audioOutput.playCue('listening').catch(() => {});

    // Transition directly into command capture / listening
    this.commandStartTime = Date.now();
    this.vad.reset();
    this.setState('COMMAND_CAPTURE', 'Listening for user command');

    // Silence timeout: If user said wake phrase but stays silent for 5.5s, cleanly return to passive listening
    if (this.silenceCheckTimer) clearTimeout(this.silenceCheckTimer);
    this.silenceCheckTimer = setTimeout(() => {
      if ((this.state === 'COMMAND_CAPTURE' || (this.state as any) === 'COMMAND_LISTENING') && !this.speechDetectedInSession) {
        if (this.commandFrames.length < 5) {
          this.setState('PASSIVE_WAKE_LISTENING', 'No speech followed wake activation');
        } else {
          this.finishCommandCapture('Silence timeout');
        }
      }
    }, 5500);

    // Absolute max command duration safety timeout
    if (this.commandTimer) clearTimeout(this.commandTimer);
    this.commandTimer = setTimeout(() => {
      if (this.state === 'COMMAND_CAPTURE' || (this.state as any) === 'COMMAND_LISTENING') {
        this.finishCommandCapture('Max duration timeout');
      }
    }, this.maxCommandDurationMs);
  }

  /**
   * Preview telemetry for live streaming partial transcripts.
   * STRICT GUARANTEE: Never invokes command handler, never executes model, never creates chat bubbles.
   */
  public emitPartialTranscript(text: string): void {
    if (!text || !text.trim()) return;
    const voiceSessionId = this.currentVoiceSessionId || `vs-${Date.now()}`;
    const commandId = this.currentCommandId || `cmd-${Date.now()}`;
    this.eventBus?.publish('TRANSCRIPT_PARTIAL', {
      voiceSessionId,
      commandId,
      text: text.trim(),
      isPartial: true
    });
  }

  /**
   * Finish command audio capture and begin transcription (Sections 10, 11, 12, 13)
   */
  private async finishCommandCapture(reason: string): Promise<void> {
    if (
      (this.state !== 'COMMAND_CAPTURE' && (this.state as any) !== 'COMMAND_LISTENING') ||
      this.isTranscribing ||
      this.isProcessingCommand
    ) {
      return;
    }
    this.isTranscribing = true;

    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }
    if (this.silenceCheckTimer) {
      clearTimeout(this.silenceCheckTimer);
      this.silenceCheckTimer = null;
    }

    if (this.commandFrames.length < 3) {
      // Audio too short (<300ms), return to passive listening
      this.isTranscribing = false;
      this.setState('PASSIVE_WAKE_LISTENING', 'Command audio too short');
      return;
    }

    const commandAudioPcm = Buffer.concat(this.commandFrames.map(f => f.data));
    this.commandFrames = [];

    const voiceSessionId = this.currentVoiceSessionId || `vs-${Date.now()}`;
    const commandId = this.currentCommandId || `cmd-${Date.now()}`;

    this.setState('TRANSCRIBING', reason);
    this.eventBus?.publish('VOICE_TRANSCRIBING', {
      voiceSessionId,
      commandId,
      durationMs: commandAudioPcm.length / 32,
      bytes: commandAudioPcm.length
    });

    try {
      const result: STTResult = await this.speechRecognition.transcribe(commandAudioPcm);
      const rawText = (result.text || '').trim();
      const initialInterpreted = (result.interpretedText || rawText).trim();

      // Deterministic wake phrase removal (Section 12):
      // "Hey Megh, what is 25 multiplied by 4?" -> "what is 25 multiplied by 4?"
      const stripped = stripWakePhrase(initialInterpreted || rawText);
      const cleanCommandText = (stripped.cleaned || initialInterpreted || rawText).trim();

      if (cleanCommandText.length > 0) {
        // Transcript idempotency check per session & command
        const canonicalKey = `${voiceSessionId}:${commandId}:${cleanCommandText.toLowerCase()}`;
        if (this.processedCommandHashes.has(canonicalKey)) {
          this.isTranscribing = false;
          return;
        }
        this.processedCommandHashes.add(canonicalKey);
        if (this.processedCommandHashes.size > 200) {
          const first = this.processedCommandHashes.values().next().value;
          if (first) this.processedCommandHashes.delete(first);
        }

        this.eventBus?.publish('TRANSCRIPT_FINAL', {
          voiceSessionId,
          commandId,
          text: cleanCommandText,
          rawText: result.rawText || rawText,
          interpretedText: cleanCommandText,
          confidence: result.confidence,
          detectedLanguage: result.detectedLanguage,
          culture: result.culture,
          providerId: result.providerId,
          wakeStripped: stripped.wakeStripped
        });

        // Transition to PROCESSING and dispatch to common command handler (Section 13)
        this.isProcessingCommand = true;
        this.setState('PROCESSING', `Executing command: "${cleanCommandText}"`);

        if (this.commandHandler) {
          await this.commandHandler(cleanCommandText, { voiceSessionId, commandId });
        }
      } else {
        // No discernible command text recognized
        this.setState('PASSIVE_WAKE_LISTENING', 'No speech recognized, resumed passive listening');
      }
    } catch (err: any) {
      this.eventBus?.publish('VOICE_ERROR', {
        voiceSessionId,
        commandId,
        error: err.message
      });
      this.setState('PASSIVE_WAKE_LISTENING', `Transcription error: ${err.message}`);
    } finally {
      this.isTranscribing = false;
      this.isProcessingCommand = false;
      // Echo cooldown: suppress microphone wake triggers for 600ms after command/speech finishes
      this.echoCooldownUntil = Date.now() + 600;

      // Do NOT revert to PASSIVE_WAKE_LISTENING if the assistant has transitioned into SPEAKING!
      if (this.state !== 'SPEAKING' && !this.isSpeaking) {
        if (this.audioCapture.isCapturing()) {
          this.setState('PASSIVE_WAKE_LISTENING', 'Resumed passive listening');
        } else {
          this.setState('IDLE', 'Command completed');
        }
      }
    }
  }

  public onStateChange(cb: (state: VoiceInputState, reason?: string) => void): () => void {
    this.onStateCallbacks.add(cb);
    return () => this.onStateCallbacks.delete(cb);
  }
}
