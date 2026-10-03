import type {
  STTProvider,
  STTOptions,
  STTResult,
  STTRoutingDecision,
  STTQualityMode,
  STTProviderHealth
} from '@meghai/shared-types';
import { ElevenLabsSTTProvider } from './providers/elevenlabs-stt-provider.js';
import { GoogleCloudSTTProvider } from './providers/google-stt-provider.js';
import { OpenAIWhisperSTTProvider } from './providers/openai-stt-provider.js';
import { WindowsSpeechSTTProvider } from './stt.js';
import { analyzeAudioQuality } from './audio-preprocessor.js';

export interface STTRouterConfig {
  defaultQualityMode?: STTQualityMode;
  contextKeyterms?: string[];
}

/**
 * Online-First STT Router
 * Intelligently selects the best available online STT provider based on:
 * - Language & locale (English, Hindi, Bengali, Hinglish code switching)
 * - Quality mode (REALTIME, BALANCED, HIGH_ACCURACY)
 * - Configured credentials & provider health
 * - Context keyterms adaptation
 * - Online failover chain
 */
export class STTRouter {
  private providers: Map<string, STTProvider> = new Map();
  private qualityMode: STTQualityMode = 'BALANCED';
  private contextKeyterms: Set<string> = new Set([
    'MeghAI',
    'Antigravity',
    'Meghnad',
    'VS Code',
    'GitHub',
    'Java',
    'Python',
    'TypeScript',
    'DSA',
    'Calculator',
    'Notepad',
    'COMEDK',
    'arrays',
    'recursion',
    'kholo',
    'batao'
  ]);

  constructor(config: STTRouterConfig = {}) {
    if (config.defaultQualityMode) {
      this.qualityMode = config.defaultQualityMode;
    }
    if (config.contextKeyterms) {
      for (const k of config.contextKeyterms) this.contextKeyterms.add(k);
    }

    this.registerStandardProviders();
  }

  public registerProvider(provider: STTProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(id: string): STTProvider | undefined {
    return this.providers.get(id);
  }

  public listProviders(): STTProvider[] {
    return Array.from(this.providers.values());
  }

  public setQualityMode(mode: STTQualityMode): void {
    this.qualityMode = mode;
  }

  public getQualityMode(): STTQualityMode {
    return this.qualityMode;
  }

  public addKeyterms(terms: string[]): void {
    for (const t of terms) {
      if (t && t.trim()) this.contextKeyterms.add(t.trim());
    }
  }

  public getKeyterms(): string[] {
    return Array.from(this.contextKeyterms);
  }

  /**
   * Evaluates request parameters and provider capabilities to make an intelligent routing decision.
   */
  public async route(options: STTOptions = {}): Promise<STTRoutingDecision> {
    const qualityMode = options.qualityMode || this.qualityMode;
    const lang = (options.language || '').toLowerCase();

    // 1. Explicit provider override
    if (options.providerId && this.providers.has(options.providerId)) {
      const p = this.providers.get(options.providerId)!;
      const isConfig = typeof p.isConfigured === 'function' ? p.isConfigured() : true;
      if (isConfig) {
        return {
          selectedProvider: p.id,
          reason: `User explicitly requested provider '${p.name}'.`,
          qualityMode,
          fallbackChain: this.buildFallbackChain(p.id),
          language: options.language,
          keytermsApplied: this.getKeyterms()
        };
      }
    }

    // 2. Filter available configured online providers
    const onlineCandidates: STTProvider[] = [];
    for (const p of this.providers.values()) {
      if (p.id === 'windows-system-speech') continue; // Skip local Windows dictation as primary
      const isConfig = typeof p.isConfigured === 'function' ? p.isConfigured() : true;
      if (isConfig) {
        onlineCandidates.push(p);
      }
    }

    // 3. Provider selection by language and capabilities
    if (onlineCandidates.length > 0) {
      const isIndic = lang.startsWith('hi') || lang.startsWith('bn') || options.enableCodeSwitching;

      // For Indic languages (Hindi, Bengali, Hinglish), Google/Gemini or ElevenLabs Scribe are strongest
      if (isIndic) {
        const google = onlineCandidates.find(p => p.id === 'google-cloud-stt');
        if (google) {
          return {
            selectedProvider: google.id,
            reason: 'Auto-routed to Google Cloud / Gemini: superior Hindi, Bengali & Indic code-switching accuracy.',
            qualityMode,
            fallbackChain: this.buildFallbackChain(google.id),
            language: options.language,
            keytermsApplied: this.getKeyterms()
          };
        }
        const eleven = onlineCandidates.find(p => p.id === 'elevenlabs-scribe');
        if (eleven) {
          return {
            selectedProvider: eleven.id,
            reason: 'Auto-routed to ElevenLabs Scribe v2: native multilingual Indic & code-switching support.',
            qualityMode,
            fallbackChain: this.buildFallbackChain(eleven.id),
            language: options.language,
            keytermsApplied: this.getKeyterms()
          };
        }
      }

      // Quality mode routing
      if (qualityMode === 'REALTIME') {
        const realtimeCandidate = onlineCandidates.find(p => p.getCapabilities?.()?.supportsRealtime);
        if (realtimeCandidate) {
          return {
            selectedProvider: realtimeCandidate.id,
            reason: `Selected '${realtimeCandidate.name}' for low-latency REALTIME streaming capability.`,
            qualityMode,
            fallbackChain: this.buildFallbackChain(realtimeCandidate.id),
            language: options.language,
            keytermsApplied: this.getKeyterms()
          };
        }
      }

      if (qualityMode === 'HIGH_ACCURACY') {
        const highAccCandidate = onlineCandidates.find(p => p.id === 'elevenlabs-scribe' || p.id === 'openai-whisper' || p.id === 'google-cloud-stt');
        if (highAccCandidate) {
          return {
            selectedProvider: highAccCandidate.id,
            reason: `Selected '${highAccCandidate.name}' for HIGH_ACCURACY mode.`,
            qualityMode,
            fallbackChain: this.buildFallbackChain(highAccCandidate.id),
            language: options.language,
            keytermsApplied: this.getKeyterms()
          };
        }
      }

      // Default: pick first available online provider
      const primary = onlineCandidates[0];
      return {
        selectedProvider: primary.id,
        reason: `Auto-selected configured online provider '${primary.name}'.`,
        qualityMode,
        fallbackChain: this.buildFallbackChain(primary.id),
        language: options.language,
        keytermsApplied: this.getKeyterms()
      };
    }

    // 4. No online provider configured (Section 6: Do NOT automatically fall back to Windows Dictation)
    return {
      selectedProvider: 'none',
      reason: 'NO_ONLINE_STT_CONFIGURED: No online realtime STT provider (ElevenLabs Scribe, Google Cloud, or OpenAI) is configured.',
      qualityMode,
      fallbackChain: [],
      language: options.language,
      keytermsApplied: []
    };
  }

  /**
   * Executes transcription with intelligent online failover.
   */
  public async transcribe(audioBuffer: Buffer, options: STTOptions = {}): Promise<STTResult> {
    const quality = analyzeAudioQuality(audioBuffer, options.sampleRate ?? 16000);
    if (!quality.isValid && quality.durationMs === 0) {
      return {
        text: '',
        confidence: 0,
        providerId: 'none',
        isFinal: true
      };
    }

    const decision = await this.route(options);
    if (decision.selectedProvider === 'none') {
      throw new Error('NO_ONLINE_STT_CONFIGURED: Please configure an API key for ElevenLabs, Google Cloud, or OpenAI in Provider Center.');
    }

    const candidateIds = [decision.selectedProvider, ...decision.fallbackChain];
    let lastError: Error | null = null;

    const enrichedOptions: STTOptions = {
      ...options,
      keyterms: options.keyterms || this.getKeyterms()
    };

    for (const provId of candidateIds) {
      const provider = this.providers.get(provId);
      if (!provider) continue;

      try {
        const result = await provider.transcribe(audioBuffer, enrichedOptions);
        if (result && result.text) {
          // Perform lightweight transparent normalization (Section 32)
          const normalized = this.normalizeTranscript(result.text);
          return {
            ...result,
            rawText: result.text,
            interpretedText: normalized.interpretedText,
            providerId: provId
          };
        }
      } catch (err: any) {
        lastError = err;
        // Proceed to next fallback provider
      }
    }

    if (lastError) throw lastError;

    return {
      text: '',
      confidence: 0,
      providerId: decision.selectedProvider,
      isFinal: true
    };
  }

  /**
   * Lightweight transparent transcript normalization (Section 32).
   * Maps common colloquial phrases to clean canonical intents without changing meaning.
   */
  public normalizeTranscript(rawText: string): { rawText: string; interpretedText: string } {
    const clean = rawText.trim();
    let interpreted = clean;

    // Polite / colloquial prefix stripping for execution (loop for chained prefixes)
    const prefixRegex = /^(please|hey megh|megh|can you please|could you please|just|sun|bhai|yaar)\s+/i;
    let prev = '';
    while (prev !== interpreted && prefixRegex.test(interpreted)) {
      prev = interpreted;
      interpreted = interpreted.replace(prefixRegex, '').trim();
    }

    // Common action normalization
    if (/^open\s+calculator(\s+please)?$/i.test(interpreted) || /^(calculator\s+kholo|calculator\s+khol\s+do)$/i.test(interpreted)) {
      interpreted = 'Open Calculator';
    } else if (/^open\s+notepad(\s+please)?$/i.test(interpreted) || /^(notepad\s+kholo|notepad\s+khol\s+do)$/i.test(interpreted)) {
      interpreted = 'Open Notepad';
    }

    return {
      rawText: clean,
      interpretedText: interpreted
    };
  }

  private buildFallbackChain(excludeId: string): string[] {
    const chain: string[] = [];
    for (const p of this.providers.values()) {
      if (p.id === excludeId || p.id === 'windows-system-speech') continue;
      const isConfig = typeof p.isConfigured === 'function' ? p.isConfigured() : true;
      if (isConfig) {
        chain.push(p.id);
      }
    }
    return chain;
  }

  private registerStandardProviders(): void {
    this.registerProvider(new ElevenLabsSTTProvider());
    this.registerProvider(new GoogleCloudSTTProvider());
    this.registerProvider(new OpenAIWhisperSTTProvider());
    this.registerProvider(new WindowsSpeechSTTProvider());
  }
}
