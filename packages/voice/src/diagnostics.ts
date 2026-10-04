import type {
  VoiceTurnDiagnostic,
  AudioFrame,
  EventType
} from '@meghai/shared-types';

export interface VoiceDiagnosticsOptions {
  eventBus?: { publish: (type: EventType, payload: any, correlationId?: string) => void };
  maxHistory?: number;
}

/**
 * Production Voice Diagnostic Trail Service
 * Records complete end-to-end telemetry across every voice turn:
 * MIC -> VAD -> WAKE -> COMMAND CAPTURE -> STT -> MODEL -> TTS ROUTER -> OUTPUT
 */
export class VoiceDiagnosticsService {
  private activeTurn: VoiceTurnDiagnostic | null = null;
  private history: VoiceTurnDiagnostic[] = [];
  private readonly maxHistory: number;
  private readonly eventBus?: { publish: (type: EventType, payload: any, correlationId?: string) => void };

  // Running accumulator for active turn RMS calculation
  private rmsSum = 0;

  constructor(options: VoiceDiagnosticsOptions = {}) {
    this.maxHistory = options.maxHistory ?? 50;
    this.eventBus = options.eventBus;
  }

  public startTurn(voiceSessionId?: string, commandId?: string): VoiceTurnDiagnostic {
    const vsId = voiceSessionId || `vs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cmdId = commandId || `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    this.rmsSum = 0;
    this.activeTurn = {
      voiceSessionId: vsId,
      commandId: cmdId,
      micDeviceId: 'default',
      micSampleRate: 16000,
      micChannels: 1,
      audioFramesReceived: 0,
      audioBytesReceived: 0,
      averageRms: 0,
      maxRms: 0,
      vadState: 'SILENCE',
      wakeState: 'IDLE',
      commandCaptureState: 'IDLE',
      sttProvider: 'none',
      sttModel: 'none',
      sttConnectionState: 'IDLE',
      sttFramesSent: 0,
      sttPartialTranscripts: [],
      sttFinalTranscript: '',
      modelProviderRequested: 'none',
      modelSelected: 'none',
      modelLatencyMs: 0,
      ttsProviderRequested: 'none',
      ttsVoiceRequested: 'none',
      ttsProviderResolved: 'none',
      ttsVoiceResolved: 'none',
      ttsFallbackTriggered: false,
      ttsFallbackReason: undefined,
      ttsAudioFormat: 'wav',
      ttsAudioBytes: 0,
      audioOutputDeviceId: 'default',
      audioOutputLatencyMs: 0,
      completedSuccessfully: false,
      failurePoint: undefined,
      timestamp: Date.now()
    };

    this.notifyUpdate();
    return { ...this.activeTurn };
  }

  public recordDevice(deviceId: string | number, sampleRate = 16000, channels = 1): void {
    if (!this.activeTurn) {
      this.startTurn();
    }
    const turn = this.activeTurn!;
    turn.micDeviceId = deviceId;
    turn.micSampleRate = sampleRate;
    turn.micChannels = channels;
    this.notifyUpdate();
  }

  public recordMicFrame(frame: AudioFrame, deviceId?: string | number): void {
    if (!this.activeTurn) {
      this.startTurn();
    }
    const turn = this.activeTurn!;
    turn.audioFramesReceived++;
    turn.audioBytesReceived += frame.data ? frame.data.length : 0;
    turn.micSampleRate = frame.sampleRate || turn.micSampleRate;
    turn.micChannels = frame.channels || turn.micChannels;
    if (deviceId !== undefined) {
      turn.micDeviceId = deviceId;
    }

    const frameRms = frame.rms || 0;
    this.rmsSum += frameRms;
    turn.averageRms = Math.round(this.rmsSum / turn.audioFramesReceived);
    if (frameRms > turn.maxRms) {
      turn.maxRms = frameRms;
    }
  }

  public recordVadState(state: string, rms?: number): void {
    if (!this.activeTurn) return;
    this.activeTurn.vadState = state;
    if (rms !== undefined && rms > this.activeTurn.maxRms) {
      this.activeTurn.maxRms = rms;
    }
  }

  public recordWakeState(state: string): void {
    if (!this.activeTurn) {
      this.startTurn();
    }
    this.activeTurn!.wakeState = state;
    this.notifyUpdate();
  }

  public recordCommandCaptureState(state: string): void {
    if (!this.activeTurn) {
      this.startTurn();
    }
    this.activeTurn!.commandCaptureState = state;
    this.notifyUpdate();
  }

  public recordSttConnection(provider: string, model: string, connectionState: string): void {
    if (!this.activeTurn) this.startTurn();
    const turn = this.activeTurn!;
    turn.sttProvider = provider;
    turn.sttModel = model;
    turn.sttConnectionState = connectionState;
    this.notifyUpdate();
  }

  public recordSttFrameSent(bytes: number): void {
    if (!this.activeTurn) return;
    this.activeTurn.sttFramesSent++;
    this.activeTurn.audioBytesReceived += bytes;
  }

  public recordSttPartial(partial: string): void {
    if (!this.activeTurn || !partial) return;
    const clean = partial.trim();
    if (!clean) return;
    const list = this.activeTurn.sttPartialTranscripts;
    if (list.length === 0 || list[list.length - 1] !== clean) {
      list.push(clean);
      if (list.length > 20) list.shift();
    }
    this.notifyUpdate();
  }

  public recordSttFinal(finalText: string, provider?: string, model?: string): void {
    if (!this.activeTurn) this.startTurn();
    const turn = this.activeTurn!;
    turn.sttFinalTranscript = (finalText || '').trim();
    if (provider) turn.sttProvider = provider;
    if (model) turn.sttModel = model;
    turn.sttConnectionState = 'FINALIZED';
    this.notifyUpdate();
  }

  public recordModel(providerRequested: string, modelSelected: string, latencyMs: number): void {
    if (!this.activeTurn) this.startTurn();
    const turn = this.activeTurn!;
    turn.modelProviderRequested = providerRequested;
    turn.modelSelected = modelSelected;
    turn.modelLatencyMs = latencyMs;
    this.notifyUpdate();
  }

  public recordTtsRequested(provider: string, voice: string): void {
    if (!this.activeTurn) this.startTurn();
    const turn = this.activeTurn!;
    turn.ttsProviderRequested = provider;
    turn.ttsVoiceRequested = voice;
  }

  public recordTtsResolved(provider: string, voice: string): void {
    if (!this.activeTurn) this.startTurn();
    const turn = this.activeTurn!;
    turn.ttsProviderResolved = provider;
    turn.ttsVoiceResolved = voice;
    this.notifyUpdate();
  }

  public recordTtsFallback(fallbackProvider: string, fallbackVoice: string, reason: string): void {
    if (!this.activeTurn) this.startTurn();
    const turn = this.activeTurn!;
    turn.ttsFallbackTriggered = true;
    turn.ttsFallbackReason = reason;
    turn.ttsProviderResolved = fallbackProvider;
    turn.ttsVoiceResolved = fallbackVoice;
    this.notifyUpdate();
  }

  public recordTtsAudio(format: string, bytes: number): void {
    if (!this.activeTurn) return;
    const turn = this.activeTurn!;
    turn.ttsAudioFormat = format;
    turn.ttsAudioBytes = bytes;
  }

  public recordAudioOutput(deviceId: string, latencyMs: number): void {
    if (!this.activeTurn) return;
    const turn = this.activeTurn!;
    turn.audioOutputDeviceId = deviceId;
    turn.audioOutputLatencyMs = latencyMs;
  }

  public completeTurn(success: boolean, failurePoint?: string): VoiceTurnDiagnostic {
    if (!this.activeTurn) {
      this.startTurn();
    }
    const turn = this.activeTurn!;
    turn.completedSuccessfully = success;
    turn.turnDurationMs = Math.max(0, Date.now() - (turn.timestamp || Date.now()));
    if (failurePoint) {
      turn.failurePoint = failurePoint;
    }

    const snapshot = { ...turn };
    this.history.unshift(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    this.notifyUpdate();
    return snapshot;
  }

  public getActiveTurn(): VoiceTurnDiagnostic | null {
    return this.activeTurn ? { ...this.activeTurn } : null;
  }

  public getLastTurn(): VoiceTurnDiagnostic | null {
    if (this.activeTurn) return { ...this.activeTurn };
    return this.history.length > 0 ? { ...this.history[0] } : null;
  }

  public getHistory(limit?: number): VoiceTurnDiagnostic[] {
    const list = this.history.map(t => ({ ...t }));
    return limit !== undefined ? list.slice(0, limit) : list;
  }

  public reset(): void {
    this.activeTurn = null;
    this.history = [];
    this.rmsSum = 0;
  }

  private notifyUpdate(): void {
    if (this.eventBus && this.activeTurn) {
      this.eventBus.publish('VOICE_DIAGNOSTICS_UPDATED', {
        diagnostic: { ...this.activeTurn }
      });
    }
  }
}

export const globalVoiceDiagnostics = new VoiceDiagnosticsService();
