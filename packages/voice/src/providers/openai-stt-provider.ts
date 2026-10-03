import type {
  STTProvider,
  STTOptions,
  STTResult,
  STTCapabilities,
  STTProviderHealth,
  STTWordTiming
} from '@meghai/shared-types';
import { writePcmToWavBuffer } from '../audio-preprocessor.js';

/**
 * OpenAI Whisper STT Provider (Online-First)
 * Official OpenAI Audio Transcriptions API integration (Whisper-1).
 * Native multilingual support with keyterm prompt biasing and word-level timestamps.
 */
export class OpenAIWhisperSTTProvider implements STTProvider {
  public readonly id = 'openai-whisper';
  public readonly name = 'OpenAI Whisper';

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['OPENAI_API_KEY'];
  }

  public isConfigured(): boolean {
    const key = this.apiKey || process.env['OPENAI_API_KEY'];
    return Boolean(key && key.trim().length > 0);
  }

  public isAvailable(): boolean {
    return this.isConfigured();
  }

  public async initialize(): Promise<void> {
    this.apiKey = this.apiKey || process.env['OPENAI_API_KEY'];
  }

  public getLanguages(): string[] {
    return [
      'en', 'hi', 'bn', 'es', 'fr', 'de', 'ja', 'ko', 'zh',
      'ar', 'ru', 'pt', 'it', 'nl', 'tr', 'pl', 'sv', 'id'
    ];
  }

  public getCapabilities(): STTCapabilities {
    return {
      supportsRealtime: false,
      supportsKeytermBiasing: true,
      supportsLanguageDetection: true,
      supportsCodeSwitching: true,
      supportedAudioEncodings: ['pcm_s16le', 'wav', 'mp3'],
      languages: this.getLanguages(),
      models: ['whisper-1']
    };
  }

  public async healthCheck(): Promise<STTProviderHealth> {
    const isConfig = this.isConfigured();
    if (!isConfig) {
      return {
        available: false,
        latencyMs: 0,
        isConfigured: false,
        message: 'OPENAI_API_KEY not configured.'
      };
    }

    const start = Date.now();
    try {
      const key = this.apiKey || process.env['OPENAI_API_KEY'];
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${key}` }
      });
      return {
        available: res.ok,
        latencyMs: Date.now() - start,
        isConfigured: true,
        message: res.ok ? 'OpenAI Whisper reachable and authenticated' : `HTTP ${res.status}`
      };
    } catch (err: any) {
      return {
        available: false,
        latencyMs: Date.now() - start,
        isConfigured: true,
        message: err.message
      };
    }
  }

  public async transcribe(audioBuffer: Buffer, options: STTOptions = {}): Promise<STTResult> {
    const key = this.apiKey || process.env['OPENAI_API_KEY'];
    if (!key) {
      throw new Error('NO_CREDENTIALS: OpenAI Whisper requires OPENAI_API_KEY to be configured.');
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        text: '',
        confidence: 0,
        providerId: this.id,
        isFinal: true
      };
    }

    const wavBuffer = writePcmToWavBuffer(audioBuffer, options.sampleRate ?? 16000, 1);
    const startTime = Date.now();

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(wavBuffer)], { type: 'audio/wav' });
    formData.append('file', blob, 'command.wav');
    formData.append('model', options.modelId || 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const keyterms = options.keyterms || ['MeghAI', 'Antigravity', 'VS Code', 'GitHub', 'Java', 'COMEDK'];
    formData.append('prompt', keyterms.join(', '));

    if (options.language) {
      formData.append('language', options.language.slice(0, 2).toLowerCase());
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`
      },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`OPENAI_WHISPER_ERROR (${response.status}): ${errText}`);
    }

    const json = await response.json() as any;
    const text = (json.text || '').trim();
    const detectedLang = json.language || options.language || 'en';

    const timestamps: STTWordTiming[] = Array.isArray(json.words)
      ? json.words.map((w: any) => ({
          word: w.word || '',
          startMs: Math.round((w.start || 0) * 1000),
          endMs: Math.round((w.end || 0) * 1000)
        }))
      : [];

    return {
      text,
      confidence: 0.96,
      detectedLanguage: detectedLang,
      languageMetadata: {
        code: detectedLang,
        isCodeSwitched: detectedLang === 'hi' || detectedLang === 'bn' || text.match(/[a-zA-Z]/) !== null
      },
      timestamps,
      durationMs: Date.now() - startTime,
      providerId: this.id,
      modelId: 'whisper-1',
      isFinal: true
    };
  }
}
