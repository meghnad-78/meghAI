import type { AudioFrame, VADState, VADFrameResult, EventType } from '@meghai/shared-types';

export interface VADOptions {
  minSpeechRms?: number;         // Minimum RMS to count as speech (default: 300)
  speechLeadFrames?: number;     // Consecutive frames needed to trigger speech start (default: 2 = 200ms)
  silenceTimeoutMs?: number;     // Silence duration to trigger speech end (default: 900ms)
  noiseFloorAlpha?: number;      // Exponential smoothing factor for noise floor (default: 0.05)
  thresholdMultiplier?: number;  // Multiplier over noise floor (default: 2.5)
  onSpeechStart?: () => void;
  onSpeechEnd?: (durationMs: number) => void;
  eventBus?: { publish: (type: EventType, payload: any, correlationId?: string) => void };
}

/**
 * Real Local Voice Activity Detector (VAD) (Phase 7)
 * High-performance, low-latency, frame-based speech activity detector.
 * Adapts to background acoustic noise floor with debounced speech start/end transitions.
 */
export class VoiceActivityDetector {
  private state: VADState = 'SILENCE';
  private noiseFloor: number = 80;
  private consecutiveSpeechFrames: number = 0;
  private consecutiveSilenceFrames: number = 0;
  private speechStartTime: number = 0;
  private speechDurationMs: number = 0;
  private silenceDurationMs: number = 0;

  private readonly minSpeechRms: number;
  private readonly speechLeadFrames: number;
  private readonly silenceTimeoutMs: number;
  private readonly noiseFloorAlpha: number;
  private readonly thresholdMultiplier: number;
  private readonly onSpeechStart?: () => void;
  private readonly onSpeechEnd?: (durationMs: number) => void;
  private readonly eventBus?: { publish: (type: EventType, payload: any, correlationId?: string) => void };

  constructor(options: VADOptions = {}) {
    this.minSpeechRms = options.minSpeechRms ?? 300;
    this.speechLeadFrames = options.speechLeadFrames ?? 2;
    this.silenceTimeoutMs = options.silenceTimeoutMs ?? 2200;
    this.noiseFloorAlpha = options.noiseFloorAlpha ?? 0.05;
    this.thresholdMultiplier = options.thresholdMultiplier ?? 2.5;
    this.onSpeechStart = options.onSpeechStart;
    this.onSpeechEnd = options.onSpeechEnd;
    this.eventBus = options.eventBus;
  }

  public getState(): VADState {
    return this.state;
  }

  public isSpeechActive(): boolean {
    return this.state === 'SPEECH';
  }

  public getNoiseFloor(): number {
    return Math.round(this.noiseFloor * 10) / 10;
  }

  public getEffectiveThreshold(): number {
    return Math.max(this.minSpeechRms, this.noiseFloor * this.thresholdMultiplier);
  }

  /**
   * Process a single 100ms AudioFrame
   */
  public processFrame(frame: AudioFrame): VADFrameResult {
    const frameRms = frame.rms;
    const threshold = this.getEffectiveThreshold();
    const isFrameSpeech = frameRms >= threshold;

    if (isFrameSpeech) {
      this.consecutiveSpeechFrames++;
      this.consecutiveSilenceFrames = 0;
      this.silenceDurationMs = 0;

      if (this.state === 'SILENCE') {
        if (this.consecutiveSpeechFrames >= this.speechLeadFrames) {
          this.state = 'SPEECH';
          this.speechStartTime = frame.timestamp;
          this.speechDurationMs = this.consecutiveSpeechFrames * frame.durationMs;

          this.onSpeechStart?.();
          this.eventBus?.publish('VAD_SPEECH_STARTED', {
            rms: frameRms,
            threshold,
            timestamp: frame.timestamp
          });
        }
      } else {
        // Already in SPEECH
        this.speechDurationMs += frame.durationMs;
      }
    } else {
      // Silence frame
      this.consecutiveSilenceFrames++;
      this.consecutiveSpeechFrames = 0;
      this.silenceDurationMs = this.consecutiveSilenceFrames * frame.durationMs;

      if (this.state === 'SILENCE') {
        // Track ambient room noise floor slowly during silence
        this.noiseFloor = this.noiseFloor * (1 - this.noiseFloorAlpha) + frameRms * this.noiseFloorAlpha;
      } else {
        // In SPEECH, check if silence exceeds timeout
        this.speechDurationMs += frame.durationMs;

        if (this.silenceDurationMs >= this.silenceTimeoutMs) {
          this.state = 'SILENCE';
          const finalDuration = Math.max(0, this.speechDurationMs - this.silenceDurationMs);

          this.onSpeechEnd?.(finalDuration);
          this.eventBus?.publish('VAD_SPEECH_ENDED', {
            speechDurationMs: finalDuration,
            timestamp: frame.timestamp
          });

          this.speechDurationMs = 0;
          this.speechStartTime = 0;
        }
      }
    }

    return {
      isSpeech: this.state === 'SPEECH',
      state: this.state,
      speechDurationMs: this.speechDurationMs,
      silenceDurationMs: this.silenceDurationMs,
      rms: frameRms,
      threshold
    };
  }

  public reset(): void {
    this.state = 'SILENCE';
    this.consecutiveSpeechFrames = 0;
    this.consecutiveSilenceFrames = 0;
    this.speechStartTime = 0;
    this.speechDurationMs = 0;
    this.silenceDurationMs = 0;
  }
}
