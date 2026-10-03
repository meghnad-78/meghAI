import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  VoiceProfile,
  TTSOptions,
  TTSSynthesisResult,
  TTSProvider
} from '@meghai/shared-types';

/**
 * OpenAI Speech TTS Provider (Online-First)
 * Authentic OpenAI Text-to-Speech integration (Alloy, Echo, Fable, Onyx, Nova, Shimmer).
 */
export class OpenAITTSProvider implements TTSProvider {
  public readonly id = 'openai';
  public readonly name = 'OpenAI Speech (TTS-1)';

  public async listVoices(): Promise<VoiceProfile[]> {
    const hasKey = Boolean(process.env['OPENAI_API_KEY']);
    const reason = hasKey ? undefined : 'API key (OPENAI_API_KEY) not configured';

    return this.getOpenAICatalog().map(v => ({
      ...v,
      available: hasKey,
      isAvailable: hasKey,
      requiresApiKey: true,
      availabilityReason: reason
    }));
  }

  public async synthesize(text: string, options: TTSOptions = {}): Promise<TTSSynthesisResult> {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('NO_CREDENTIALS: OpenAI TTS requires OPENAI_API_KEY to be configured.');
    }

    const cleanText = (text || '').trim();
    if (!cleanText) {
      throw new Error('TTS synthesis text cannot be empty.');
    }

    const catalog = await this.listVoices();
    const voiceId = options.voiceId || 'openai-nova';
    const profile = catalog.find(v => v.id === voiceId) || catalog[0];
    const openaiVoice = profile.name.toLowerCase(); // 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: openaiVoice,
        input: cleanText,
        speed: options.speechRate ?? 1.0,
        response_format: 'wav'
      })
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(`OPENAI_TTS_ERROR (${response.status}): ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const audioBase64 = audioBuffer.toString('base64');
    const tempPath = path.join(
      os.tmpdir(),
      `meghai-tts-openai-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.wav`
    );
    await fsp.writeFile(tempPath, audioBuffer);

    return {
      audioFilePath: tempPath,
      audioBuffer,
      audioBase64,
      durationMs: Math.round((audioBuffer.length / 48000) * 1000) || 1000,
      format: 'wav',
      sampleRate: 24000,
      voiceId: profile.id,
      spokenText: cleanText
    };
  }

  public async synthesizeStream(text: string, options: TTSOptions = {}): Promise<AsyncIterable<Buffer>> {
    const apiKey = process.env['OPENAI_API_KEY'];
    if (!apiKey) {
      throw new Error('NO_CREDENTIALS: OpenAI TTS requires OPENAI_API_KEY to be configured.');
    }

    const cleanText = (text || '').trim();
    if (!cleanText) {
      throw new Error('TTS synthesis text cannot be empty.');
    }

    const catalog = await this.listVoices();
    const voiceId = options.voiceId || 'openai-nova';
    const profile = catalog.find(v => v.id === voiceId) || catalog[0];
    const openaiVoice = profile.name.toLowerCase();

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: openaiVoice,
        input: cleanText,
        speed: options.speechRate ?? 1.0,
        response_format: 'wav'
      })
    });

    if (!response.ok || !response.body) {
      const err = await response.text().catch(() => '');
      throw new Error(`OPENAI_TTS_ERROR (${response.status}): ${err}`);
    }

    const reader = (response.body as any).getReader();
    return {
      [Symbol.asyncIterator]: () => ({
        async next() {
          const { done, value } = await reader.read();
          if (done) return { done: true, value: undefined };
          return { done: false, value: Buffer.from(value) };
        }
      })
    };
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(process.env['OPENAI_API_KEY']);
  }

  private getOpenAICatalog(): VoiceProfile[] {
    return [
      {
        id: 'openai-alloy',
        name: 'Alloy',
        displayName: 'OpenAI Alloy',
        provider: 'openai',
        language: 'en-US',
        gender: 'neutral',
        naturalness: 'neural',
        tone: 'Balanced, versatile & clear',
        style: 'Modern digital assistant',
        isAvailable: Boolean(process.env['OPENAI_API_KEY']),
        requiresApiKey: true,
        capabilities: {
          speedSupport: true,
          pitchSupport: false,
          emotionSupport: true,
          styleSupport: true,
          streamingSupport: true
        }
      },
      {
        id: 'openai-echo',
        name: 'Echo',
        displayName: 'OpenAI Echo',
        provider: 'openai',
        language: 'en-US',
        gender: 'male',
        naturalness: 'neural',
        tone: 'Warm, conversational & resonant',
        style: 'Friendly counselor',
        isAvailable: Boolean(process.env['OPENAI_API_KEY']),
        requiresApiKey: true,
        capabilities: {
          speedSupport: true,
          pitchSupport: false,
          emotionSupport: true,
          styleSupport: true,
          streamingSupport: true
        }
      },
      {
        id: 'openai-fable',
        name: 'Fable',
        displayName: 'OpenAI Fable',
        provider: 'openai',
        language: 'en-GB',
        gender: 'neutral',
        naturalness: 'neural',
        tone: 'Expressive, lyrical & British accent',
        style: 'Storyteller',
        isAvailable: Boolean(process.env['OPENAI_API_KEY']),
        requiresApiKey: true,
        capabilities: {
          speedSupport: true,
          pitchSupport: false,
          emotionSupport: true,
          styleSupport: true,
          streamingSupport: true
        }
      },
      {
        id: 'openai-onyx',
        name: 'Onyx',
        displayName: 'OpenAI Onyx',
        provider: 'openai',
        language: 'en-US',
        gender: 'male',
        naturalness: 'neural',
        tone: 'Deep, authoritative & commanding',
        style: 'Executive advisor',
        isAvailable: Boolean(process.env['OPENAI_API_KEY']),
        requiresApiKey: true,
        capabilities: {
          speedSupport: true,
          pitchSupport: false,
          emotionSupport: true,
          styleSupport: true,
          streamingSupport: true
        }
      },
      {
        id: 'openai-nova',
        name: 'Nova',
        displayName: 'OpenAI Nova',
        provider: 'openai',
        language: 'en-US',
        gender: 'female',
        naturalness: 'neural',
        tone: 'Bright, energetic & helpful',
        style: 'Personal companion',
        isAvailable: Boolean(process.env['OPENAI_API_KEY']),
        requiresApiKey: true,
        capabilities: {
          speedSupport: true,
          pitchSupport: false,
          emotionSupport: true,
          styleSupport: true,
          streamingSupport: true
        }
      },
      {
        id: 'openai-shimmer',
        name: 'Shimmer',
        displayName: 'OpenAI Shimmer',
        provider: 'openai',
        language: 'en-US',
        gender: 'female',
        naturalness: 'neural',
        tone: 'Clear, optimistic & soothing',
        style: 'Gentle guide',
        isAvailable: Boolean(process.env['OPENAI_API_KEY']),
        requiresApiKey: true,
        capabilities: {
          speedSupport: true,
          pitchSupport: false,
          emotionSupport: true,
          styleSupport: true,
          streamingSupport: true
        }
      }
    ];
  }
}
