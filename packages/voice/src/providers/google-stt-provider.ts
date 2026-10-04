import type {
  STTProvider,
  STTOptions,
  STTResult,
  STTCapabilities,
  STTProviderHealth
} from '@meghai/shared-types';
import { writePcmToWavBuffer } from '../audio-preprocessor.js';

/**
 * Google Cloud Speech-to-Text & Gemini Audio Provider (Online-First)
 * Official Google Cloud Speech-to-Text v1 / Chirp and Gemini Audio Recognition.
 * Native multilingual support with high-accuracy Hindi, Bengali, and Hinglish code-switching,
 * plus speechContexts / keyterm phrase adaptation.
 */
export class GoogleCloudSTTProvider implements STTProvider {
  public readonly id = 'google-cloud-stt';
  public readonly name = 'Google Cloud Speech / Chirp';

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env['GOOGLE_CLOUD_API_KEY'] || process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY'];
  }

  public isConfigured(): boolean {
    const key = this.apiKey || process.env['GOOGLE_CLOUD_API_KEY'] || process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY'];
    return Boolean(key && key.trim().length > 0);
  }

  public isAvailable(): boolean {
    return this.isConfigured();
  }

  public async initialize(): Promise<void> {
    this.apiKey = this.apiKey || process.env['GOOGLE_CLOUD_API_KEY'] || process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY'];
  }

  public getLanguages(): string[] {
    return [
      'en-US', 'en-IN', 'hi-IN', 'bn-IN', 'es-ES', 'fr-FR', 'de-DE',
      'ja-JP', 'ko-KR', 'zh-CN', 'ar-SA', 'ru-RU', 'pt-BR'
    ];
  }

  public getCapabilities(): STTCapabilities {
    return {
      supportsRealtime: true,
      supportsKeytermBiasing: true,
      supportsLanguageDetection: true,
      supportsCodeSwitching: true,
      supportedAudioEncodings: ['pcm_s16le', 'wav', 'flac'],
      languages: this.getLanguages(),
      models: ['chirp_2', 'default', 'gemini-2.5-flash']
    };
  }

  public async healthCheck(): Promise<STTProviderHealth> {
    const isConfig = this.isConfigured();
    if (!isConfig) {
      return {
        available: false,
        latencyMs: 0,
        isConfigured: false,
        message: 'GOOGLE_CLOUD_API_KEY or GEMINI_API_KEY not configured.'
      };
    }

    const start = Date.now();
    try {
      const key = this.apiKey || process.env['GOOGLE_CLOUD_API_KEY'] || process.env['GEMINI_API_KEY'];
      // Lightweight probe
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
        method: 'GET'
      });
      return {
        available: res.ok,
        latencyMs: Date.now() - start,
        isConfigured: true,
        message: res.ok ? 'Google Cloud STT reachable and authenticated' : `HTTP ${res.status}`
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
    const key = this.apiKey || process.env['GOOGLE_CLOUD_API_KEY'] || process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY'];
    if (!key) {
      throw new Error('NO_CREDENTIALS: Google Cloud STT requires GOOGLE_CLOUD_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY.');
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
    const audioBase64 = wavBuffer.toString('base64');
    const startTime = Date.now();

    // Keyterms context biasing
    const keyterms = options.keyterms || ['MeghAI', 'Antigravity', 'VS Code', 'GitHub', 'Java', 'COMEDK'];

    // If GOOGLE_CLOUD_API_KEY is specifically configured, try Google Cloud Speech-to-Text API v1
    if (process.env['GOOGLE_CLOUD_API_KEY']) {
      try {
        const lang = options.language || 'en-US';
        const sttUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${key}`;
        const sttBody = {
          config: {
            encoding: 'LINEAR16',
            sampleRateHertz: options.sampleRate ?? 16000,
            languageCode: lang,
            alternativeLanguageCodes: ['hi-IN', 'bn-IN', 'en-IN'],
            enableAutomaticPunctuation: true,
            speechContexts: [{ phrases: keyterms }]
          },
          audio: {
            content: audioBase64
          }
        };

        const res = await fetch(sttUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sttBody)
        });

        if (res.ok) {
          const json = await res.json() as any;
          const result = json.results?.[0]?.alternatives?.[0];
          if (result && result.transcript) {
            return {
              text: result.transcript.trim(),
              confidence: result.confidence ?? 0.94,
              detectedLanguage: lang,
              durationMs: Date.now() - startTime,
              providerId: this.id,
              modelId: 'google-v1-speech',
              isFinal: true
            };
          }
        }
      } catch {
        // Fall back to Gemini Multimodal Audio transcription below
      }
    }

    // High-fidelity multimodal Gemini 3.5 Flash Lite audio transcription
    const modelName = 'gemini-3.5-flash-lite';
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
    const prompt = `You are a speech-to-text transcriber for the personal AI MeghAI.
Transcribe the user's speech audio verbatim.
Rules:
1. Preserve natural code-switching (e.g. Hindi/Bengali/English mixed like "calculator kholo" or "aaj DSA revise karna hai").
2. Do NOT translate to English if spoken in Hindi or Bengali. Transcribe in the original language using standard Romanized/Devanagari script as spoken.
3. Known context keyterms: ${keyterms.join(', ')}.
4. Output JSON format only: {"transcript": "...", "language": "...", "confidence": 0.95}`;

    const res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'audio/wav',
                data: audioBase64
              }
            }
          ]
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.0
        }
      })
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`GOOGLE_STT_ERROR (${res.status}): ${err}`);
    }

    const data = await res.json() as any;
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = { transcript: rawContent.trim(), language: 'en', confidence: 0.9 };
    }

    const transcript = (parsed.transcript || '').trim();
    const detectedLang = parsed.language || options.language || 'en';

    return {
      text: transcript,
      confidence: Number(parsed.confidence ?? 0.95),
      detectedLanguage: detectedLang,
      languageMetadata: {
        code: detectedLang,
        isCodeSwitched: Boolean(detectedLang === 'hi' || detectedLang === 'bn' || transcript.match(/[a-zA-Z]/))
      },
      durationMs: Date.now() - startTime,
      providerId: this.id,
      modelId: 'gemini-3.5-flash-lite-audio',
      isFinal: true
    };
  }
}
