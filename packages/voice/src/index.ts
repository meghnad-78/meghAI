import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  VoiceProfile,
  VoiceProviderId,
  VoiceCapability,
  PersonalityMode,
  VoiceSettings,
  AutoSpeakMode,
  TTSOptions,
  TTSSynthesisResult,
  TTSProvider,
  AudioPlaybackStatus,
  AudioOutputState,
  AudioCueType,
  MicrophoneState,
  AudioFrame,
  AudioCaptureDiagnostics,
  VADState,
  VADFrameResult,
  VoiceInputState,
  STTResult,
  STTProvider,
  WakeWordResult
} from '@meghai/shared-types';

export { AudioCueService } from './cues.js';
export { AudioOutputService } from './output-service.js';
export { VoiceCatalogService } from './catalog.js';
export { WindowsSapiTTSProvider } from './providers/sapi-provider.js';
export { WindowsOneCoreTTSProvider } from './providers/onecore-provider.js';
export { GoogleCloudTTSProvider } from './providers/google-provider.js';
export { ElevenLabsTTSProvider } from './providers/elevenlabs-provider.js';
export { OpenAITTSProvider } from './providers/openai-tts-provider.js';
export { VoiceActivityDetector } from './vad.js';
export { SpeechRecognitionService, WindowsSpeechSTTProvider, writePcmToWavFile } from './stt.js';
export { STTRouter } from './stt-router.js';
export { ElevenLabsSTTProvider } from './providers/elevenlabs-stt-provider.js';
export { GoogleCloudSTTProvider } from './providers/google-stt-provider.js';
export { OpenAIWhisperSTTProvider } from './providers/openai-stt-provider.js';
export {
  validateAudioParameters,
  analyzeAudioQuality,
  trimSilencePadding,
  writePcmToWavBuffer
} from './audio-preprocessor.js';
export { AcousticWakeWordDetector, WakeWordDetector, stripWakePhrase } from './wake-word.js';
export { VoiceInputManager } from './voice-input-manager.js';

export type {
  VoiceProfile,
  VoiceProviderId,
  VoiceCapability,
  PersonalityMode,
  VoiceSettings,
  AutoSpeakMode,
  TTSOptions,
  TTSSynthesisResult,
  TTSProvider,
  AudioPlaybackStatus,
  AudioOutputState,
  AudioCueType,
  MicrophoneState,
  AudioFrame,
  AudioCaptureDiagnostics,
  VADState,
  VADFrameResult,
  VoiceInputState,
  STTResult,
  WakeWordResult
};

import { VoiceCatalogService } from './catalog.js';
import { AudioOutputService } from './output-service.js';
import { WindowsSapiTTSProvider } from './providers/sapi-provider.js';


/**
 * Native Windows Audio Playback Service
 * Authoritative controller for all audio playback (TTS, UI sound cues, thinking loops).
 * Guarantees zero overlapping audio, instant cancellation (<50ms), and truthful state reporting.
 */
export class AudioPlaybackService extends AudioOutputService {
  /**
   * Play audio through the default Windows audio device (backward-compatible alias for playTTS)
   */
  public async play(
    audioSource: string | Buffer | TTSSynthesisResult,
    metadata: { voiceId?: string; text?: string; correlationId?: string } = {}
  ): Promise<void> {
    await this.playTTS(audioSource, metadata);
  }
}

/**
 * Unified Voice Catalog & Studio (Section 69 & 70)
 * Directory of real installed Windows voices + supported cloud voices.
 */
export class VoiceCatalog {
  private service: VoiceCatalogService;
  private customVoices?: VoiceProfile[];

  constructor(customVoices?: VoiceProfile[]) {
    this.service = new VoiceCatalogService();
    if (customVoices && customVoices.length > 0) {
      this.customVoices = [...customVoices];
    }
  }

  public listVoices(filter?: { language?: string; provider?: string; gender?: string; naturalness?: string; availableOnly?: boolean }): VoiceProfile[] {
    if (this.customVoices) {
      return this.customVoices.filter(v => {
        if (filter?.language && !(v.language || '').toLowerCase().startsWith(filter.language.toLowerCase())) return false;
        if (filter?.provider) {
          const target = filter.provider.toLowerCase();
          if (target === 'local') {
            if (v.provider !== 'windows-sapi' && (v.provider as any) !== 'local') return false;
          } else if (target === 'google' && (v.provider === 'google-cloud' || (v.provider as any) === 'google')) {
            // match
          } else if (v.provider !== target) {
            return false;
          }
        }
        if (filter?.gender && v.gender !== filter.gender) return false;
        if (filter?.naturalness && v.naturalness !== filter.naturalness) return false;
        if (filter?.availableOnly && !v.available && !v.isAvailable) return false;
        return true;
      });
    }
    return this.service.listVoices(filter);
  }

  public getVoice(id: string): VoiceProfile | undefined {
    if (this.customVoices) {
      return this.customVoices.find(v => v.id === id);
    }
    return this.service.getVoice(id);
  }

  public registerVoice(voice: VoiceProfile): void {
    if (!this.customVoices) {
      this.customVoices = [...this.service.listVoices()];
    }
    const existingIndex = this.customVoices.findIndex(v => v.id === voice.id);
    if (existingIndex >= 0) {
      this.customVoices[existingIndex] = voice;
    } else {
      this.customVoices.push(voice);
    }
  }

  public async refreshFromProvider(ttsProvider: TTSProvider): Promise<VoiceProfile[]> {
    try {
      const realVoices = await ttsProvider.listVoices();
      if (realVoices && realVoices.length > 0) {
        if (!this.customVoices) {
          this.customVoices = [...this.service.listVoices()];
        }
        for (const rv of realVoices) {
          const idx = this.customVoices.findIndex(v => v.id === rv.id);
          if (idx >= 0) this.customVoices[idx] = rv;
          else this.customVoices.push(rv);
        }
      }
    } catch {
      // Fallback
    }
    return this.listVoices();
  }

  public getService(): VoiceCatalogService {
    return this.service;
  }
}

/**
 * Personality Studio (Section 69, 70, 98)
 * Manages MeghAI's tone, pacing, and behavioral personality presets.
 */
export class PersonalityStudio {
  private static readonly PROMPTS: Record<PersonalityMode, { description: string; instruction: string }> = {
    PROFESSIONAL: {
      description: 'Concise, structured, and focused on executive clarity and precision.',
      instruction: 'Maintain a professional, highly articulate tone. Be direct, clear, and action-oriented.'
    },
    WARM: {
      description: 'Supportive, conversational, and naturally engaging.',
      instruction: 'Respond with warmth and empathy. Be courteous, accessible, and reassuring.'
    },
    FUTURISTIC_COMPANION: {
      description: 'High-tech, deeply proactive, and razor-sharp intelligence partner.',
      instruction: 'Act as an omnipresent futuristic operating layer. Provide swift insights and proactive assistance.'
    },
    CALM_ASSISTANT: {
      description: 'Deliberate, peaceful, minimalist, and non-distracting.',
      instruction: 'Adopt a steady, peaceful cadence. Keep explanations uncluttered and grounding.'
    }
  };

  public static getPersonalityPrompt(mode: PersonalityMode): { description: string; instruction: string } {
    return this.PROMPTS[mode] || this.PROMPTS.FUTURISTIC_COMPANION;
  }
}

/**
 * Voice Settings & Synthesis Manager with Disk Persistence
 */
export class VoiceSettingsManager {
  private settings: VoiceSettings;
  private persistencePath?: string;

  constructor(initialSettings?: Partial<VoiceSettings>, persistencePath?: string) {
    if (persistencePath !== undefined) {
      this.persistencePath = persistencePath || undefined;
    } else if (!initialSettings || Object.keys(initialSettings).length === 0) {
      this.persistencePath = path.join(os.homedir(), '.meghai', 'voice-settings.json');
    }

    const persisted = this.loadPersisted();

    this.settings = {
      selectedVoiceId: initialSettings?.selectedVoiceId || persisted?.selectedVoiceId || 'onecore-heera',
      selectedProvider: initialSettings?.selectedProvider || persisted?.selectedProvider || 'windows-onecore',
      speechRate: initialSettings?.speechRate ?? persisted?.speechRate ?? 1.0,
      pitch: initialSettings?.pitch ?? persisted?.pitch ?? 1.0,
      volume: initialSettings?.volume ?? persisted?.volume ?? 1.0,
      personalityMode: initialSettings?.personalityMode || persisted?.personalityMode || 'FUTURISTIC_COMPANION',
      autoSpeak: initialSettings?.autoSpeak || persisted?.autoSpeak || 'ON'
    };

    if (this.persistencePath && !persisted) {
      this.persist();
    }
  }

  public getSettings(): VoiceSettings {
    return { ...this.settings };
  }

  public updateSettings(updates: Partial<VoiceSettings>): VoiceSettings {
    this.settings = {
      ...this.settings,
      ...updates
    };
    if (this.persistencePath) {
      this.persist();
    }
    return this.getSettings();
  }

  private loadPersisted(): Partial<VoiceSettings> | null {
    if (!this.persistencePath) return null;
    try {
      if (fs.existsSync(this.persistencePath)) {
        const raw = fs.readFileSync(this.persistencePath, 'utf8');
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  private persist(): void {
    if (!this.persistencePath) return;
    try {
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.persistencePath, JSON.stringify(this.settings, null, 2), 'utf8');
    } catch {}
  }

  public previewVoice(voiceId: string, text = 'Greetings. I am MeghAI, your personal operating layer.'): {
    voiceId: string;
    text: string;
    speechRate: number;
    pitch: number;
    volume: number;
    status: 'READY' | 'SYNTHESIZED';
  } {
    return {
      voiceId,
      text,
      speechRate: this.settings.speechRate,
      pitch: this.settings.pitch,
      volume: this.settings.volume,
      status: 'SYNTHESIZED'
    };
  }
}

/**
 * Real Windows Native Audio Capture Service (Section 64 & 65)
 * Captures 16 kHz 16-bit mono PCM audio from Windows default input device using winmm waveIn.
 */
export class AudioCaptureService {
  private state: MicrophoneState = 'MIC_OFF';
  private activeProcess: { pid?: number; kill: () => void } | null = null;
  private pendingBuffer: Buffer = Buffer.alloc(0);
  private sequenceNumber = 0;
  private startTime = 0;
  private totalBytesCaptured = 0;
  private currentMetrics = { rms: 0, peak: 0, normalizedLevel: 0 };
  private activeDeviceName = 'Default Windows Audio Input';
  private mockTimer: NodeJS.Timeout | null = null;
  private lastLevelPublishTime = 0;

  private onFrameCallbacks = new Set<(frame: AudioFrame) => void>();
  private onLevelCallbacks = new Set<(level: { rms: number; peak: number; normalizedLevel: number }) => void>();
  private onStateCallbacks = new Set<(state: MicrophoneState, reason?: string) => void>();

  private permissionBroker?: { evaluate: (scope: any) => { granted: boolean; reason?: string } };
  private eventBus?: { publish: (type: any, payload: any, correlationId?: string) => void };
  private mockCapture: boolean;

  constructor(options: {
    permissionBroker?: { evaluate: (scope: any) => { granted: boolean; reason?: string } };
    eventBus?: { publish: (type: any, payload: any, correlationId?: string) => void };
    mockCapture?: boolean;
  } = {}) {
    this.permissionBroker = options.permissionBroker;
    this.eventBus = options.eventBus;
    this.mockCapture = options.mockCapture ?? false;
  }

  /**
   * Set state and notify all registered listeners
   */
  private setState(newState: MicrophoneState, reason?: string): void {
    if (this.state === newState) return;
    this.state = newState;
    for (const cb of this.onStateCallbacks) {
      try { cb(newState, reason); } catch {}
    }
  }

  public getState(): MicrophoneState {
    return this.state;
  }

  public isCapturing(): boolean {
    return this.state === 'MIC_LISTENING';
  }

  /**
   * Compute RMS, peak, and normalized level (0.0..1.0) from raw 16-bit PCM bytes
   */
  public static computeAudioMetrics(pcmBuffer: Buffer): { rms: number; peak: number; normalizedLevel: number } {
    const numSamples = Math.floor(pcmBuffer.length / 2);
    if (numSamples === 0) {
      return { rms: 0, peak: 0, normalizedLevel: 0 };
    }

    let sumSquares = 0;
    let peak = 0;

    for (let i = 0; i < numSamples; i++) {
      const sample = pcmBuffer.readInt16LE(i * 2);
      const abs = Math.abs(sample);
      if (abs > peak) peak = abs;
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / numSamples);
    // Dynamic normalizer: 10,000 RMS is strong conversational speech level
    const normalizedLevel = Math.min(1.0, Math.round((rms / 10000) * 1000) / 1000);

    return {
      rms: Math.round(rms * 10) / 10,
      peak,
      normalizedLevel
    };
  }

  /**
   * Discover and enumerate Windows audio input devices
   */
  public async listInputDevices(): Promise<Array<{ id: number; name: string; channels: number }>> {
    if (process.platform !== 'win32' || this.mockCapture) {
      return [
        { id: 0, name: 'Default Audio Input Device (Simulated)', channels: 1 }
      ];
    }

    const scriptPath = this.resolveScriptPath('list-devices.ps1');
    if (!fs.existsSync(scriptPath)) {
      return [{ id: 0, name: 'Default Windows Audio Input', channels: 1 }];
    }

    return new Promise((resolve) => {
      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath
      ], { windowsHide: true });

      let stdout = '';
      child.stdout.on('data', d => { stdout += d.toString(); });
      child.on('close', code => {
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout.trim());
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            const result = arr.map((d: any) => ({
              id: Number(d.Id ?? d.id ?? 0),
              name: String(d.Name ?? d.name ?? 'Microphone').trim() || 'Microphone',
              channels: Number(d.Channels ?? d.channels ?? 1)
            }));
            resolve(result.length > 0 ? result : [{ id: 0, name: 'Default Windows Audio Input', channels: 1 }]);
            return;
          } catch {}
        }
        resolve([{ id: 0, name: 'Default Windows Audio Input', channels: 1 }]);
      });
      child.on('error', () => {
        resolve([{ id: 0, name: 'Default Windows Audio Input', channels: 1 }]);
      });
    });
  }

  /**
   * Start live microphone audio capture
   */
  public async start(options?: { deviceId?: number }): Promise<void> {
    if (this.state === 'MIC_LISTENING' || this.state === 'MIC_STARTING') {
      return;
    }

    // Permission Verification
    if (this.permissionBroker) {
      const perm = this.permissionBroker.evaluate('MICROPHONE');
      if (!perm.granted) {
        this.setState('MIC_ERROR', `Microphone permission denied: ${perm.reason}`);
        this.eventBus?.publish('MIC_ERROR', { error: `Permission denied: ${perm.reason}` });
        throw new Error(`Microphone permission denied: ${perm.reason}`);
      }
    }

    this.setState('MIC_STARTING');
    this.eventBus?.publish('MIC_STARTING', { timestamp: Date.now() });

    // Device Availability Check
    const devices = await this.listInputDevices();
    if (devices.length === 0) {
      this.setState('MIC_DEVICE_UNAVAILABLE', 'No audio input devices found.');
      this.eventBus?.publish('MIC_DEVICE_UNAVAILABLE', { error: 'No audio input devices detected on system.' });
      throw new Error('No audio input devices detected on system.');
    }

    this.activeDeviceName = devices[0]?.name || 'Default Windows Microphone';
    this.sequenceNumber = 0;
    this.totalBytesCaptured = 0;
    this.startTime = Date.now();
    this.pendingBuffer = Buffer.alloc(0);
    this.currentMetrics = { rms: 0, peak: 0, normalizedLevel: 0 };

    if (this.mockCapture || process.platform !== 'win32') {
      this.startMockCapture();
    } else {
      await this.startNativeCapture();
    }

    this.setState('MIC_LISTENING');
    this.eventBus?.publish('MIC_LISTENING', {
      activeDevice: this.activeDeviceName,
      sampleRate: 16000,
      channels: 1,
      format: 'pcm_s16le',
      timestamp: Date.now()
    });
  }

  /**
   * Start native Windows waveIn capture process
   */
  private startNativeCapture(): Promise<void> {
    return new Promise((resolve, reject) => {
      const scriptPath = this.resolveScriptPath('mic-stream.ps1');
      if (!fs.existsSync(scriptPath)) {
        this.setState('MIC_ERROR', `mic-stream.ps1 script not found at ${scriptPath}`);
        return reject(new Error(`mic-stream.ps1 script not found at ${scriptPath}`));
      }

      const child = spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath
      ], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let started = false;
      let stderrOutput = '';

      this.activeProcess = {
        pid: child.pid,
        kill: () => {
          try {
            if (child.pid) {
              execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => {});
            }
            child.kill();
          } catch {}
        }
      };

      child.stdout.on('data', (chunk: Buffer) => {
        if (!started) {
          started = true;
          resolve();
        }
        this.handleIncomingAudioData(chunk);
      });

      child.stderr.on('data', (errData: Buffer) => {
        const msg = errData.toString();
        stderrOutput += msg;
        if (msg.includes('NO_INPUT_DEVICES')) {
          this.setState('MIC_DEVICE_UNAVAILABLE', 'No input devices available.');
          this.eventBus?.publish('MIC_DEVICE_UNAVAILABLE', { error: 'No input devices available' });
        }
      });

      child.on('close', (code) => {
        this.activeProcess = null;
        if (!started) {
          if (stderrOutput.includes('NO_INPUT_DEVICES')) {
            this.setState('MIC_DEVICE_UNAVAILABLE', 'No input devices found.');
            reject(new Error('No audio input devices found.'));
          } else {
            this.setState('MIC_ERROR', `Process exited early with code ${code}: ${stderrOutput}`);
            reject(new Error(`Microphone capture failed to start (exit code ${code}): ${stderrOutput}`));
          }
        } else {
          if (this.state !== 'MIC_STOPPING' && this.state !== 'MIC_OFF') {
            this.setState('MIC_OFF', 'Stream closed');
            this.eventBus?.publish('MIC_OFF', { reason: 'Process closed' });
          }
        }
      });

      child.on('error', (err) => {
        this.activeProcess = null;
        this.setState('MIC_ERROR', err.message);
        if (!started) {
          reject(err);
        }
      });

      // Safety timeout: resolve if alive after 1.5 seconds even if quiet
      setTimeout(() => {
        if (!started && this.activeProcess) {
          started = true;
          resolve();
        }
      }, 1500);
    });
  }

  /**
   * Process raw byte chunks into exact 100ms frames and compute metrics
   */
  private handleIncomingAudioData(chunk: Buffer): void {
    this.totalBytesCaptured += chunk.length;
    this.pendingBuffer = Buffer.concat([this.pendingBuffer, chunk]);

    const frameByteLength = 3200; // 100ms frame at 16kHz 16-bit mono PCM

    while (this.pendingBuffer.length >= frameByteLength) {
      const frameBuffer = Buffer.from(this.pendingBuffer.subarray(0, frameByteLength));
      this.pendingBuffer = this.pendingBuffer.subarray(frameByteLength);
      this.sequenceNumber++;

      const metrics = AudioCaptureService.computeAudioMetrics(frameBuffer);
      this.currentMetrics = metrics;

      const frame: AudioFrame = {
        timestamp: Date.now(),
        sampleRate: 16000,
        channels: 1,
        format: 'pcm_s16le',
        sequenceNumber: this.sequenceNumber,
        durationMs: 100,
        data: frameBuffer,
        rms: metrics.rms,
        peak: metrics.peak,
        normalizedLevel: metrics.normalizedLevel
      };

      // Emit frame to internal subscribers (VAD, Wake-Word, STT)
      for (const cb of this.onFrameCallbacks) {
        try { cb(frame); } catch {}
      }

      // Emit level callbacks
      for (const cb of this.onLevelCallbacks) {
        try { cb(metrics); } catch {}
      }

      // Publish throttled MIC_LEVEL event onto EventBus (~100ms intervals)
      const now = Date.now();
      if (now - this.lastLevelPublishTime >= 100) {
        this.lastLevelPublishTime = now;
        this.eventBus?.publish('MIC_LEVEL', {
          rms: metrics.rms,
          peak: metrics.peak,
          normalizedLevel: metrics.normalizedLevel,
          sequenceNumber: this.sequenceNumber,
          state: this.state
        });
      }
    }
  }

  /**
   * Synthetic frame generation for CI / non-Windows environments
   */
  private startMockCapture(): void {
    const frameByteLength = 3200;
    const numSamples = 1600;
    let phase = 0;

    this.mockTimer = setInterval(() => {
      if (this.state !== 'MIC_LISTENING') return;

      const buf = Buffer.alloc(frameByteLength);
      for (let i = 0; i < numSamples; i++) {
        const sampleVal = Math.round(Math.sin(phase) * 3500 + (Math.random() - 0.5) * 300);
        buf.writeInt16LE(sampleVal, i * 2);
        phase += (2 * Math.PI * 440) / 16000;
      }
      this.handleIncomingAudioData(buf);
    }, 100);
  }

  /**
   * Stop audio capture and release Windows native resources
   */
  public async stop(reason = 'Capture stopped by user'): Promise<boolean> {
    if (this.state === 'MIC_OFF' && !this.activeProcess && !this.mockTimer) {
      return false;
    }

    this.setState('MIC_STOPPING', reason);
    this.eventBus?.publish('MIC_STOPPING', { reason, timestamp: Date.now() });

    if (this.mockTimer) {
      clearInterval(this.mockTimer);
      this.mockTimer = null;
    }

    if (this.activeProcess) {
      this.activeProcess.kill();
      this.activeProcess = null;
    }

    this.pendingBuffer = Buffer.alloc(0);
    this.currentMetrics = { rms: 0, peak: 0, normalizedLevel: 0 };
    this.setState('MIC_OFF', reason);
    this.eventBus?.publish('MIC_OFF', { reason, timestamp: Date.now() });

    return true;
  }

  /**
   * Diagnostics reporting for observability and telemetry
   */
  public getDiagnostics(): AudioCaptureDiagnostics {
    const isLive = this.state === 'MIC_LISTENING';
    const streamDurationMs = isLive && this.startTime > 0 ? Date.now() - this.startTime : 0;

    return {
      sampleRate: 16000,
      channels: 1,
      format: 'pcm_s16le',
      frameCount: this.sequenceNumber,
      totalBytes: this.totalBytesCaptured,
      currentRms: this.currentMetrics.rms,
      peakLevel: this.currentMetrics.peak,
      normalizedLevel: this.currentMetrics.normalizedLevel,
      streamDurationMs,
      activeDevice: this.activeDeviceName,
      isLive,
      state: this.state,
      aecAvailable: false,
      aecMode: 'VOICE_SESSION_GATING_FALLBACK'
    };
  }

  public onFrame(cb: (frame: AudioFrame) => void): () => void {
    this.onFrameCallbacks.add(cb);
    return () => this.onFrameCallbacks.delete(cb);
  }

  public onLevel(cb: (level: { rms: number; peak: number; normalizedLevel: number }) => void): () => void {
    this.onLevelCallbacks.add(cb);
    return () => this.onLevelCallbacks.delete(cb);
  }

  public onStateChange(cb: (state: MicrophoneState, reason?: string) => void): () => void {
    this.onStateCallbacks.add(cb);
    return () => this.onStateCallbacks.delete(cb);
  }

  private resolveScriptPath(scriptName: string): string {
    const curDir = typeof __dirname !== 'undefined'
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));

    const candidates = [
      path.join(curDir, 'scripts', scriptName),
      path.join(curDir, '..', 'src', 'scripts', scriptName),
      path.join(curDir, '..', 'scripts', scriptName),
      path.join(process.cwd(), 'packages', 'voice', 'src', 'scripts', scriptName),
      path.join(process.cwd(), 'packages', 'voice', 'dist', 'scripts', scriptName)
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0];
  }
}
