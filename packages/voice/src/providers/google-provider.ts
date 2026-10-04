import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  VoiceProfile,
  TTSOptions,
  TTSSynthesisResult,
  TTSProvider
} from '@meghai/shared-types';

interface RawGoogleVoice {
  id: string;
  name: string;
  language: string;
  gender: 'female' | 'male' | 'neutral';
  naturalness: 'standard' | 'neural' | 'studio' | 'generative';
  tone: string;
  style: string;
}

/**
 * Google Cloud / Gemini TTS Provider
 * Authentic catalog of Google Cloud Text-to-Speech Neural2, Journey, Studio, and Wavenet voices.
 */
export class GoogleCloudTTSProvider implements TTSProvider {
  public readonly id = 'google-cloud';
  public readonly name = 'Google Cloud / Gemini Neural';

  public async listVoices(): Promise<VoiceProfile[]> {
    const hasKey = Boolean(process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || process.env['GOOGLE_CLOUD_API_KEY'] || process.env['GOOGLE_TTS_API_KEY']);
    const reason = hasKey ? undefined : 'API key (GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_TTS_API_KEY) not configured';

    return this.getGoogleCatalog().map(v => ({
      ...v,
      available: hasKey,
      isAvailable: hasKey,
      requiresApiKey: true,
      availabilityReason: reason
    }));
  }

  public async synthesize(text: string, options: TTSOptions = {}): Promise<TTSSynthesisResult> {
    const apiKey = process.env['GEMINI_API_KEY'] || process.env['GOOGLE_API_KEY'] || process.env['GOOGLE_CLOUD_API_KEY'] || process.env['GOOGLE_TTS_API_KEY'];
    if (!apiKey) {
      throw new Error('Google Cloud TTS requires GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_TTS_API_KEY to be configured.');
    }

    const cleanText = (text || '').trim();
    if (!cleanText) {
      throw new Error('TTS synthesis text cannot be empty.');
    }

    const voiceId = options.voiceId || 'goog-en-us-journey-f';
    const catalog = await this.listVoices();
    const voiceProfile = catalog.find(v => v.id === voiceId) || catalog[0];

    const voiceCode = voiceProfile.name.replace(/^Google\s*/i, '').trim();
    const langCode = voiceProfile.language || 'en-US';

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: cleanText },
        voice: {
          languageCode: langCode,
          name: voiceCode
        },
        audioConfig: {
          audioEncoding: 'LINEAR16',
          speakingRate: options.speechRate ?? 1.0,
          pitch: (options.pitch ? (options.pitch - 1.0) * 10 : 0),
          volumeGainDb: (options.volume ? (options.volume - 1.0) * 6 : 0)
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Cloud TTS synthesis API error (${response.status}): ${errText}`);
    }

    const data = await response.json() as { audioContent: string };
    const audioBuffer = Buffer.from(data.audioContent, 'base64');
    const tempWavPath = path.join(
      os.tmpdir(),
      `meghai-tts-google-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.wav`
    );
    await fsp.writeFile(tempWavPath, audioBuffer);

    return {
      audioFilePath: tempWavPath,
      audioBuffer,
      audioBase64: data.audioContent,
      durationMs: Math.round((audioBuffer.length / 48000) * 1000) || 1000,
      format: 'wav',
      sampleRate: 24000,
      voiceId: voiceProfile.id,
      spokenText: cleanText
    };
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(process.env['GEMINI_API_KEY'] || process.env['GOOGLE_TTS_API_KEY']);
  }

  public getGoogleCatalog(): VoiceProfile[] {
    const raw: RawGoogleVoice[] = [
      // English (US)
      { id: 'goog-en-us-journey-f', name: 'en-US-Journey-F', language: 'en-US', gender: 'female', naturalness: 'generative', tone: 'Expressive conversational female', style: 'Journey Generative' },
      { id: 'goog-en-us-journey-o', name: 'en-US-Journey-O', language: 'en-US', gender: 'female', naturalness: 'generative', tone: 'Warm natural female companion', style: 'Journey Generative' },
      { id: 'goog-en-us-journey-d', name: 'en-US-Journey-D', language: 'en-US', gender: 'male', naturalness: 'generative', tone: 'Dynamic narrative male', style: 'Journey Generative' },
      { id: 'goog-en-us-studio-o', name: 'en-US-Studio-O', language: 'en-US', gender: 'female', naturalness: 'studio', tone: 'Broadcast studio quality female', style: 'Studio Master' },
      { id: 'goog-en-us-studio-q', name: 'en-US-Studio-Q', language: 'en-US', gender: 'male', naturalness: 'studio', tone: 'Deep executive studio male', style: 'Studio Master' },
      { id: 'goog-en-us-neural2-a', name: 'en-US-Neural2-A', language: 'en-US', gender: 'male', naturalness: 'neural', tone: 'Articulate neutral male', style: 'Neural2' },
      { id: 'goog-en-us-neural2-c', name: 'en-US-Neural2-C', language: 'en-US', gender: 'female', naturalness: 'neural', tone: 'Crisp clear female', style: 'Neural2' },
      { id: 'goog-en-us-neural2-d', name: 'en-US-Neural2-D', language: 'en-US', gender: 'male', naturalness: 'neural', tone: 'Warm natural male', style: 'Neural2' },
      { id: 'goog-en-us-neural2-e', name: 'en-US-Neural2-E', language: 'en-US', gender: 'female', naturalness: 'neural', tone: 'Friendly narrative female', style: 'Neural2' },
      { id: 'goog-en-us-neural2-f', name: 'en-US-Neural2-F', language: 'en-US', gender: 'female', naturalness: 'neural', tone: 'Calm authoritative female', style: 'Neural2' },
      { id: 'goog-en-us-neural2-i', name: 'en-US-Neural2-I', language: 'en-US', gender: 'male', naturalness: 'neural', tone: 'Grounded documentary male', style: 'Neural2' },
      { id: 'goog-en-us-neural2-j', name: 'en-US-Neural2-J', language: 'en-US', gender: 'male', naturalness: 'neural', tone: 'Energetic engaging male', style: 'Neural2' },
      { id: 'goog-en-us-wavenet-a', name: 'en-US-Wavenet-A', language: 'en-US', gender: 'male', naturalness: 'standard', tone: 'Standard Wavenet male', style: 'Wavenet' },
      { id: 'goog-en-us-wavenet-c', name: 'en-US-Wavenet-C', language: 'en-US', gender: 'female', naturalness: 'standard', tone: 'Standard Wavenet female', style: 'Wavenet' },

      // English (GB)
      { id: 'goog-en-gb-studio-b', name: 'en-GB-Studio-B', language: 'en-GB', gender: 'male', naturalness: 'studio', tone: 'Distinguished British male studio', style: 'Studio Master' },
      { id: 'goog-en-gb-studio-c', name: 'en-GB-Studio-C', language: 'en-GB', gender: 'female', naturalness: 'studio', tone: 'Elegant British female studio', style: 'Studio Master' },
      { id: 'goog-en-gb-neural2-a', name: 'en-GB-Neural2-A', language: 'en-GB', gender: 'female', naturalness: 'neural', tone: 'Crisp British female', style: 'Neural2' },
      { id: 'goog-en-gb-neural2-b', name: 'en-GB-Neural2-B', language: 'en-GB', gender: 'male', naturalness: 'neural', tone: 'Refined British male', style: 'Neural2' },
      { id: 'goog-en-gb-neural2-c', name: 'en-GB-Neural2-C', language: 'en-GB', gender: 'female', naturalness: 'neural', tone: 'Warm British conversational female', style: 'Neural2' },
      { id: 'goog-en-gb-neural2-d', name: 'en-GB-Neural2-D', language: 'en-GB', gender: 'male', naturalness: 'neural', tone: 'Narrative British male', style: 'Neural2' },

      // English (India)
      { id: 'goog-en-in-neural2-a', name: 'en-IN-Neural2-A', language: 'en-IN', gender: 'female', naturalness: 'neural', tone: 'Articulate Indian English female', style: 'Neural2' },
      { id: 'goog-en-in-neural2-b', name: 'en-IN-Neural2-B', language: 'en-IN', gender: 'male', naturalness: 'neural', tone: 'Confident Indian English male', style: 'Neural2' },
      { id: 'goog-en-in-neural2-c', name: 'en-IN-Neural2-C', language: 'en-IN', gender: 'male', naturalness: 'neural', tone: 'Smooth Indian English male', style: 'Neural2' },
      { id: 'goog-en-in-neural2-d', name: 'en-IN-Neural2-D', language: 'en-IN', gender: 'female', naturalness: 'neural', tone: 'Warm Indian English female', style: 'Neural2' },
      { id: 'goog-en-in-wavenet-a', name: 'en-IN-Wavenet-A', language: 'en-IN', gender: 'female', naturalness: 'standard', tone: 'Classic Indian English female', style: 'Wavenet' },
      { id: 'goog-en-in-wavenet-b', name: 'en-IN-Wavenet-B', language: 'en-IN', gender: 'male', naturalness: 'standard', tone: 'Classic Indian English male', style: 'Wavenet' },

      // Hindi (India)
      { id: 'goog-hi-swara', name: 'hi-IN-Neural2-A', language: 'hi-IN', gender: 'female', naturalness: 'neural', tone: 'Swara - Expressive natural Hindi female', style: 'Neural2' },
      { id: 'goog-hi-madhur', name: 'hi-IN-Neural2-B', language: 'hi-IN', gender: 'male', naturalness: 'neural', tone: 'Madhur - Warm natural Hindi male', style: 'Neural2' },
      { id: 'goog-hi-neural2-c', name: 'hi-IN-Neural2-C', language: 'hi-IN', gender: 'male', naturalness: 'neural', tone: 'Clear articulate Hindi male', style: 'Neural2' },
      { id: 'goog-hi-neural2-d', name: 'hi-IN-Neural2-D', language: 'hi-IN', gender: 'female', naturalness: 'neural', tone: 'Gentle conversational Hindi female', style: 'Neural2' },
      { id: 'goog-hi-wavenet-a', name: 'hi-IN-Wavenet-A', language: 'hi-IN', gender: 'female', naturalness: 'standard', tone: 'Standard Wavenet Hindi female', style: 'Wavenet' },
      { id: 'goog-hi-wavenet-b', name: 'hi-IN-Wavenet-B', language: 'hi-IN', gender: 'male', naturalness: 'standard', tone: 'Standard Wavenet Hindi male', style: 'Wavenet' },

      // Bengali (India)
      { id: 'goog-bn-tanima', name: 'bn-IN-Neural2-A', language: 'bn-IN', gender: 'female', naturalness: 'neural', tone: 'Tanima - Sweet natural Bengali female', style: 'Neural2' },
      { id: 'goog-bn-aniruddha', name: 'bn-IN-Neural2-B', language: 'bn-IN', gender: 'male', naturalness: 'neural', tone: 'Aniruddha - Clear melodious Bengali male', style: 'Neural2' },
      { id: 'goog-bn-wavenet-a', name: 'bn-IN-Wavenet-A', language: 'bn-IN', gender: 'female', naturalness: 'standard', tone: 'Standard Bengali female', style: 'Wavenet' },
      { id: 'goog-bn-wavenet-b', name: 'bn-IN-Wavenet-B', language: 'bn-IN', gender: 'male', naturalness: 'standard', tone: 'Standard Bengali male', style: 'Wavenet' },

      // Multilingual
      { id: 'goog-es-neural2-a', name: 'es-ES-Neural2-A', language: 'es-ES', gender: 'female', naturalness: 'neural', tone: 'Castilian Spanish natural female', style: 'Neural2' },
      { id: 'goog-es-neural2-b', name: 'es-ES-Neural2-B', language: 'es-ES', gender: 'male', naturalness: 'neural', tone: 'Castilian Spanish natural male', style: 'Neural2' },
      { id: 'goog-fr-neural2-a', name: 'fr-FR-Neural2-A', language: 'fr-FR', gender: 'female', naturalness: 'neural', tone: 'French Parisian natural female', style: 'Neural2' },
      { id: 'goog-fr-neural2-b', name: 'fr-FR-Neural2-B', language: 'fr-FR', gender: 'male', naturalness: 'neural', tone: 'French Parisian natural male', style: 'Neural2' },
      { id: 'goog-de-neural2-a', name: 'de-DE-Neural2-A', language: 'de-DE', gender: 'female', naturalness: 'neural', tone: 'German Standard natural female', style: 'Neural2' },
      { id: 'goog-de-neural2-b', name: 'de-DE-Neural2-B', language: 'de-DE', gender: 'male', naturalness: 'neural', tone: 'German Standard natural male', style: 'Neural2' },
      { id: 'goog-ja-neural2-b', name: 'ja-JP-Neural2-B', language: 'ja-JP', gender: 'female', naturalness: 'neural', tone: 'Japanese Tokyo natural female', style: 'Neural2' },
      { id: 'goog-ja-neural2-c', name: 'ja-JP-Neural2-C', language: 'ja-JP', gender: 'male', naturalness: 'neural', tone: 'Japanese Tokyo natural male', style: 'Neural2' }
    ];

    return raw.map(item => {
      const words = item.tone.toLowerCase().split(/[\s,&-]+/).filter(w => w.length > 3);
      const chars = Array.from(new Set([item.naturalness, ...words])).slice(0, 5);

      return {
        id: item.id,
        voiceId: item.id,
        providerVoiceId: item.name,
        name: item.name,
        provider: 'google-cloud',
        language: item.language,
        gender: item.gender,
        naturalness: item.naturalness,
        capabilities: {
          speedSupport: true,
          pitchSupport: true,
          emotionSupport: item.naturalness === 'generative' || item.naturalness === 'studio',
          styleSupport: false,
          streamingSupport: true
        },
        supportedControls: ['speed', 'pitch'],
        characteristics: chars,
        supportsPreview: true,
        supportsStreaming: true,
        tone: item.tone,
        style: item.style,
        isAvailable: false,
        available: false,
        requiresApiKey: true,
        requiresCredential: true
      };
    });
  }
}
