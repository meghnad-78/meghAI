import type {
  VoiceProfile,
  VoiceProviderId,
  TTSOptions,
  TTSSynthesisResult,
  TTSProvider
} from '@meghai/shared-types';
import { WindowsSapiTTSProvider } from './providers/sapi-provider.js';
import { WindowsOneCoreTTSProvider } from './providers/onecore-provider.js';
import { GoogleCloudTTSProvider } from './providers/google-provider.js';
import { ElevenLabsTTSProvider } from './providers/elevenlabs-provider.js';
import { OpenAITTSProvider } from './providers/openai-tts-provider.js';

export interface VoiceFilterOptions {
  language?: string;
  provider?: string;
  gender?: string;
  naturalness?: string;
  availableOnly?: boolean;
}

/**
 * Unified Multi-Provider Voice Catalog Service
 * Aggregates 100+ real voices across Windows SAPI, Windows OneCore, Google Cloud, ElevenLabs, and OpenAI.
 */
export class VoiceCatalogService {
  private providers: Map<string, TTSProvider> = new Map();
  private voiceCache: VoiceProfile[] = [];
  private initialized = false;

  constructor(customProviders?: TTSProvider[]) {
    if (customProviders && customProviders.length > 0) {
      for (const p of customProviders) {
        this.providers.set(p.id, p);
      }
    } else {
      const sapi = new WindowsSapiTTSProvider();
      const onecore = new WindowsOneCoreTTSProvider();
      const google = new GoogleCloudTTSProvider();
      const eleven = new ElevenLabsTTSProvider();
      const openai = new OpenAITTSProvider();

      this.providers.set('windows-sapi', sapi);
      this.providers.set('local', sapi); // Alias for backward compatibility
      this.providers.set('windows-onecore', onecore);
      this.providers.set('google-cloud', google);
      this.providers.set('google-cloud-tts', google);
      this.providers.set('google', google); // Alias
      this.providers.set('elevenlabs', eleven);
      this.providers.set('openai', openai);
    }
  }

  public async initialize(): Promise<VoiceProfile[]> {
    if (this.initialized && this.voiceCache.length > 0) {
      return this.voiceCache;
    }
    return this.refreshVoices();
  }

  public async refreshVoices(): Promise<VoiceProfile[]> {
    const aggregated: VoiceProfile[] = [];
    const seenIds = new Set<string>();

    // Query canonical providers
    const canonicalKeys = ['windows-sapi', 'windows-onecore', 'google-cloud', 'elevenlabs', 'openai'];
    for (const key of canonicalKeys) {
      const provider = this.providers.get(key);
      if (!provider) continue;
      try {
        const voices = await provider.listVoices();
        for (const v of voices) {
          if (!seenIds.has(v.id)) {
            seenIds.add(v.id);
            aggregated.push(v);
          }
        }
      } catch {
        // Continue to other providers if one fails
      }
    }

    this.voiceCache = aggregated;
    this.initialized = true;
    return this.voiceCache;
  }

  public listVoices(filter?: VoiceFilterOptions): VoiceProfile[] {
    const rawList = this.voiceCache.length > 0 ? this.voiceCache : this.getSeedCatalog();
    const enrichedList = rawList.map(v => {
      const supportedControls = v.supportedControls || (
        v.provider === 'elevenlabs'
          ? ['speed', 'stability', 'similarity', 'style']
          : v.provider === 'openai' || v.provider === 'windows-sapi' || (v.provider as any) === 'local'
          ? ['speed']
          : ['speed', 'pitch']
      );

      const characteristics = v.characteristics || (
        v.tone ? v.tone.toLowerCase().split(/[\s,&-]+/).filter(w => w.length > 3).slice(0, 4) : ['natural', 'clear']
      );

      return {
        ...v,
        voiceId: v.id,
        providerVoiceId: v.providerVoiceId || (v.style && v.provider === 'elevenlabs' ? v.style : v.name),
        requiresCredential: v.requiresCredential ?? v.requiresApiKey ?? (v.provider !== 'windows-sapi' && v.provider !== 'windows-onecore' && (v.provider as any) !== 'local'),
        supportedControls,
        characteristics
      };
    });

    if (!filter) return enrichedList;

    return enrichedList.filter(v => {
      if (filter.language && !(v.language || '').toLowerCase().startsWith(filter.language.toLowerCase())) {
        return false;
      }
      if (filter.provider) {
        const target = filter.provider.toLowerCase();
        if (target === 'local' || target === 'windows-sapi') {
          if (v.provider !== 'windows-sapi' && (v.provider as any) !== 'local') {
            return false;
          }
        } else if (target === 'windows-onecore') {
          if (v.provider !== 'windows-onecore') return false;
        } else if (
          target === 'google' || target === 'google-cloud' || target === 'google-cloud-tts'
        ) {
          if (v.provider !== 'google-cloud' && (v.provider as any) !== 'google' && (v.provider as any) !== 'google-cloud-tts') {
            return false;
          }
        } else if (target === 'elevenlabs') {
          if (v.provider !== 'elevenlabs') return false;
        } else if (target === 'openai') {
          if (v.provider !== 'openai') return false;
        } else if (v.provider !== target) {
          return false;
        }
      }
      if (filter.gender && v.gender !== filter.gender) {
        return false;
      }
      if (filter.naturalness && v.naturalness !== filter.naturalness) {
        return false;
      }
      if (filter.availableOnly && !v.available && !v.isAvailable) {
        return false;
      }
      return true;
    });
  }

  public getVoice(id: string): VoiceProfile | undefined {
    const list = this.voiceCache.length > 0 ? this.voiceCache : this.getSeedCatalog();
    const target = (id || '').toLowerCase();
    return list.find(v =>
      v.id.toLowerCase() === target ||
      v.name.toLowerCase() === target ||
      v.id.toLowerCase().replace(/^(local|sapi|onecore|goog|eleven)-/, '') === target.replace(/^(local|sapi|onecore|goog|eleven)-/, '')
    );
  }

  public getProvider(id: string): TTSProvider | undefined {
    return this.providers.get(id);
  }

  public getProviderForVoice(voiceId: string): TTSProvider {
    const voice = this.getVoice(voiceId);
    if (voice) {
      const p = this.providers.get(voice.provider);
      if (p) return p;
    }

    if (voiceId.startsWith('onecore-')) {
      const p = this.providers.get('windows-onecore');
      if (p) return p;
    }
    if (voiceId.startsWith('goog-')) {
      const p = this.providers.get('google-cloud');
      if (p) return p;
    }
    if (voiceId.startsWith('eleven-')) {
      const p = this.providers.get('elevenlabs');
      if (p) return p;
    }
    if (
      voiceId.startsWith('openai-') ||
      ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(voiceId.toLowerCase())
    ) {
      const p = this.providers.get('openai');
      if (p) return p;
    }

    // Default to windows-onecore or windows-sapi
    return this.providers.get('windows-onecore') || this.providers.get('windows-sapi') || this.providers.get('local')!;
  }

  /**
   * Synthesize speech using the appropriate provider for the chosen voice with intelligent local fallback
   */
  public async synthesize(text: string, options: TTSOptions = {}): Promise<TTSSynthesisResult> {
    const voiceId = options.voiceId || 'onecore-heera';
    const provider = this.getProviderForVoice(voiceId);

    try {
      return await provider.synthesize(text, options);
    } catch (err: any) {
      console.warn(`[VoiceCatalog] Selected provider '${provider.id}' failed for voice '${voiceId}':`, err.message);
      // If a cloud provider failed, only fallback if allowed
      if (options.allowFallback ?? true) {
        if (provider.id === 'google-cloud' || provider.id === 'elevenlabs' || provider.id === 'openai') {
          const fallbackProvider = this.providers.get('windows-onecore') || this.providers.get('windows-sapi')!;
          console.warn(`[VoiceCatalog] Explicit fallback to '${fallbackProvider.id}' (onecore-heera) for voice '${voiceId}'`);
          return await fallbackProvider.synthesize(text, {
            ...options,
            voiceId: 'onecore-heera'
          });
        }
      }
      throw err;
    }
  }

  /**
   * Synthesize speech as a stream of audio chunks for low-latency playback
   */
  public async synthesizeStream(text: string, options: TTSOptions = {}): Promise<AsyncIterable<Buffer>> {
    const voiceId = options.voiceId || 'onecore-heera';
    const provider = this.getProviderForVoice(voiceId);

    if (typeof (provider as any).synthesizeStream === 'function') {
      try {
        const res = await (provider as any).synthesizeStream(text, options);
        if (res && res.stream) return res.stream;
        return res;
      } catch (err: any) {
        console.warn(`[VoiceCatalog] Stream synthesis failed on '${provider.id}':`, err.message);
        if (!(options.allowFallback ?? true)) throw err;
      }
    }

    // Fallback: Synthesize full buffer and yield as a single chunk
    const result = await this.synthesize(text, options);
    const audioBuf = result.audioBuffer || Buffer.alloc(0);
    return {
      [Symbol.asyncIterator]: () => {
        let sent = false;
        return {
          async next(): Promise<IteratorResult<Buffer, any>> {
            if (!sent) {
              sent = true;
              return { done: false, value: audioBuf };
            }
            return { done: true, value: undefined };
          }
        };
      }
    };
  }

  public getStats(): {
    total: number;
    available: number;
    totalVoices: number;
    totalOfflineReady: number;
    totalCloud: number;
    totalAvailable: number;
    byProvider: Record<string, number>;
    providers: Record<string, { total: number; available: number }>;
  } {
    const list = this.voiceCache.length > 0 ? this.voiceCache : this.getSeedCatalog();
    const byProvider: Record<string, number> = {};
    const providers: Record<string, { total: number; available: number }> = {
      'windows-sapi': { total: 0, available: 0 },
      'windows-onecore': { total: 0, available: 0 },
      'google-cloud-tts': { total: 0, available: 0 },
      'elevenlabs': { total: 0, available: 0 },
      'openai': { total: 0, available: 0 }
    };
    let availableCount = 0;
    let offlineReadyCount = 0;
    let cloudCount = 0;

    for (const v of list) {
      byProvider[v.provider] = (byProvider[v.provider] || 0) + 1;
      const isAvail = !!(v.available || v.isAvailable);
      if (isAvail) availableCount++;

      const provKey = v.provider === 'google-cloud'
        ? 'google-cloud-tts'
        : (v.provider === 'local' ? 'windows-sapi' : v.provider);
      if (providers[provKey]) {
        providers[provKey].total++;
        if (isAvail) providers[provKey].available++;
      }

      if (v.provider === 'windows-sapi' || v.provider === 'windows-onecore' || v.provider === 'local') {
        offlineReadyCount++;
      } else {
        cloudCount++;
      }
    }

    return {
      total: list.length,
      available: availableCount,
      totalVoices: list.length,
      totalOfflineReady: offlineReadyCount,
      totalCloud: cloudCount,
      totalAvailable: availableCount,
      byProvider,
      providers
    };
  }

  private getSeedCatalog(): VoiceProfile[] {
    const sapi = new WindowsSapiTTSProvider();
    const onecore = new WindowsOneCoreTTSProvider();
    const google = new GoogleCloudTTSProvider();
    const eleven = new ElevenLabsTTSProvider();
    const openai = new OpenAITTSProvider();

    // Use synchronous fallbacks for instant synchronous access before async initialize()
    const sapiVoices = (sapi as any).getStandardFallbackVoices?.() || [];
    const onecoreVoices = (onecore as any).getStandardFallbackVoices?.() || [];
    const googleVoices = (google as any).getGoogleCatalog?.() || [];
    const elevenVoices = (eleven as any).getElevenLabsCatalog?.() || [];
    const openaiVoices = (openai as any).getOpenAICatalog?.() || [];

    return [...sapiVoices, ...onecoreVoices, ...googleVoices, ...elevenVoices, ...openaiVoices];
  }
}
