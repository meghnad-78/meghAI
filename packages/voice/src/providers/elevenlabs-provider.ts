import fs from 'node:fs';
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
 * ElevenLabs High-Fidelity Voice Provider
 * Catalog of authentic ElevenLabs voice models with truthful credentials evaluation.
 */
export class ElevenLabsTTSProvider implements TTSProvider {
  public readonly id = 'elevenlabs';
  public readonly name = 'ElevenLabs Generative Voice';

  public async listVoices(): Promise<VoiceProfile[]> {
    const hasKey = Boolean(process.env['ELEVENLABS_API_KEY']);
    const reason = hasKey ? undefined : 'API key (ELEVENLABS_API_KEY) not configured';

    return this.getElevenLabsCatalog().map(v => ({
      ...v,
      available: hasKey,
      isAvailable: hasKey,
      requiresApiKey: true,
      availabilityReason: reason
    }));
  }

  public async synthesize(text: string, options: TTSOptions = {}): Promise<TTSSynthesisResult> {
    const apiKey = process.env['ELEVENLABS_API_KEY'];
    if (!apiKey) {
      throw new Error('ElevenLabs TTS requires ELEVENLABS_API_KEY to be configured.');
    }

    const cleanText = (text || '').trim();
    if (!cleanText) {
      throw new Error('TTS synthesis text cannot be empty.');
    }

    const voiceId = options.voiceId || 'eleven-rachel';
    const catalog = await this.listVoices();
    const voiceProfile = catalog.find(v => v.id === voiceId) || catalog[0];

    // Extract elevenlabs model ID from description/mapping or use Rachel default
    const apiVoiceId = voiceProfile.style || '21m00Tcm4TlvDq8ikWAM';

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${apiVoiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ElevenLabs synthesis API error (${response.status}): ${err}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const audioBase64 = audioBuffer.toString('base64');
    const tempPath = path.join(
      os.tmpdir(),
      `meghai-tts-eleven-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.mp3`
    );
    await fsp.writeFile(tempPath, audioBuffer);

    return {
      audioFilePath: tempPath,
      audioBuffer,
      audioBase64,
      durationMs: Math.round((audioBuffer.length / 16000) * 1000) || 1000,
      format: 'mp3',
      sampleRate: 44100,
      voiceId: voiceProfile.id,
      spokenText: cleanText
    };
  }

  public async isAvailable(): Promise<boolean> {
    return Boolean(process.env['ELEVENLABS_API_KEY']);
  }

  private getElevenLabsCatalog(): VoiceProfile[] {
    const list: Array<{ id: string; name: string; lang: string; gender: 'female' | 'male'; tone: string; externalId: string }> = [
      { id: 'eleven-rachel', name: 'Rachel', lang: 'en-US', gender: 'female', tone: 'Calm, narrative & soothing', externalId: '21m00Tcm4TlvDq8ikWAM' },
      { id: 'eleven-adam', name: 'Adam', lang: 'en-US', gender: 'male', tone: 'Deep, authoritative & narrative', externalId: 'pNInz6obpgDQGcFmaJgB' },
      { id: 'eleven-antoni', name: 'Antoni', lang: 'en-US', gender: 'male', tone: 'Well-rounded, friendly & balanced', externalId: 'ErXwobaYiN019PkySvjV' },
      { id: 'eleven-josh', name: 'Josh', lang: 'en-US', gender: 'male', tone: 'Warm, young & conversational', externalId: 'TxGEqnHWrfWFTfGW9XjX' },
      { id: 'eleven-arnold', name: 'Arnold', lang: 'en-US', gender: 'male', tone: 'Crisp, articulate & commanding', externalId: 'VR6AewLTigWG4xSOukaG' },
      { id: 'eleven-bella', name: 'Bella', lang: 'en-US', gender: 'female', tone: 'Expressive, dramatic & narrative', externalId: 'EXAVITQu4vr4xnSDxMaL' },
      { id: 'eleven-domi', name: 'Domi', lang: 'en-US', gender: 'female', tone: 'Strong, energetic & engaging', externalId: 'AZnzlk1XvdvUeBnXmlld' },
      { id: 'eleven-elli', name: 'Elli', lang: 'en-US', gender: 'female', tone: 'Gentle, youthful & empathetic', externalId: 'MF3mGyEYCl7XYWbV9V6O' },
      { id: 'eleven-sam', name: 'Sam', lang: 'en-US', gender: 'male', tone: 'Dynamic, modern young American', externalId: 'yoZ06aMxZJJ28mfd3POQ' },
      { id: 'eleven-nicole', name: 'Nicole', lang: 'en-US', gender: 'female', tone: 'Whispering, soft & intimate', externalId: 'piTKgcLEGmPE4e6mEKli' },
      { id: 'eleven-clyde', name: 'Clyde', lang: 'en-US', gender: 'male', tone: 'Gritty, veteran & rugged character', externalId: '2EiwWnXFnvU5JabPnv8n' },
      { id: 'eleven-fin', name: 'Fin', lang: 'en-IE', gender: 'male', tone: 'Irish sailor, lively & buoyant', externalId: 'D38z5RcWu1voky8WS1ja' },
      { id: 'eleven-freya', name: 'Freya', lang: 'en-US', gender: 'female', tone: 'Friendly, youthful & enthusiastic', externalId: 'jsCqWAovK2LkecY7zXl4' },
      { id: 'eleven-gigi', name: 'Gigi', lang: 'en-US', gender: 'female', tone: 'Animated, childish & bubbly', externalId: 'jBpfuIE2acCO8z3wKNLl' },
      { id: 'eleven-giovanni', name: 'Giovanni', lang: 'en-IT', gender: 'male', tone: 'Italian accent, cultured & warm', externalId: 'zcAOhNBS3c14rBihAFp1' },
      { id: 'eleven-glinda', name: 'Glinda', lang: 'en-US', gender: 'female', tone: 'Enchanting, mythical & regal', externalId: 'z9fAnlkpzviPz146aGWa' },
      { id: 'eleven-grace', name: 'Grace', lang: 'en-US', gender: 'female', tone: 'Gentle Southern American warmth', externalId: 'oWAxZDxUOHaAJbsK4403' },
      { id: 'eleven-harry', name: 'Harry', lang: 'en-US', gender: 'male', tone: 'Anxious, intense & dramatic', externalId: 'SOYHLrjzK2X1ezoPC6cr' },
      { id: 'eleven-james', name: 'James', lang: 'en-AU', gender: 'male', tone: 'Australian calm broadcast anchor', externalId: 'ZQe5CZNOzWyzPSCn5a3c' },
      { id: 'eleven-jeremy', name: 'Jeremy', lang: 'en-IE', gender: 'male', tone: 'Irish storyteller & friendly narrator', externalId: 'bVMeCyTHy58xNoL34h3p' },
      { id: 'eleven-jessie', name: 'Jessie', lang: 'en-US', gender: 'male', tone: 'Raspy, grandfatherly & weathered', externalId: 't0jbNlBVZ17f02VDIeMI' },
      { id: 'eleven-joseph', name: 'Joseph', lang: 'en-GB', gender: 'male', tone: 'Deep aristocratic British male', externalId: 'Zlb1dXrM653N07WRdFW3' },
      { id: 'eleven-marcus', name: 'Marcus', lang: 'en-US', gender: 'male', tone: 'Authoritative, resonant barytone', externalId: 'Id9jZ7Vd1f618b76e01a' },
      { id: 'eleven-matilda', name: 'Matilda', lang: 'en-US', gender: 'female', tone: 'Warm, cozy audiobook narrator', externalId: 'XrExE9yKIg1WjnnlVkGX' },
      { id: 'eleven-michael', name: 'Michael', lang: 'en-US', gender: 'male', tone: 'Conversational, natural modern male', externalId: 'flq6f7yk4E4fJM5XTYov' },
      { id: 'eleven-mimi', name: 'Mimi', lang: 'en-SE', gender: 'female', tone: 'Swedish cadence, playful & light', externalId: 'zrHiDhphv9ZnVXBqCLjz' },
      { id: 'eleven-patrick', name: 'Patrick', lang: 'en-US', gender: 'male', tone: 'Shouty, energetic video game style', externalId: 'ODq5zmih8GrVes37Dizd' },
      { id: 'eleven-paul', name: 'Paul', lang: 'en-US', gender: 'male', tone: 'Grounded, factual news anchor', externalId: '5Q0t7uMcjvnagumLfvZi' },
      { id: 'eleven-serena', name: 'Serena', lang: 'en-US', gender: 'female', tone: 'Pleasant, engaging fairytale reader', externalId: 'pMsXg702672B10z4Vl7J' },
      { id: 'eleven-thomas', name: 'Thomas', lang: 'en-US', gender: 'male', tone: 'Calm, whimsical & thoughtful', externalId: 'GBv7mTt0atIp3Br8iCZE' },
      { id: 'eleven-charlie', name: 'Charlie', lang: 'en-AU', gender: 'male', tone: 'Natural casual Australian bloke', externalId: 'IKne3meq5aSn9XLyUdCD' },
      { id: 'eleven-george', name: 'George', lang: 'en-GB', gender: 'male', tone: 'Raspy, seasoned British voice', externalId: 'JBFqnCBsd6RMkjVDRZzb' },
      { id: 'eleven-callum', name: 'Callum', lang: 'en-US', gender: 'male', tone: 'Intense characters & villains', externalId: 'N2lVS1w4EtoT3dr4eOWO' },
      { id: 'eleven-river', name: 'River', lang: 'en-US', gender: 'male', tone: 'Confident, neutral & youthful', externalId: 'SAz9YHcvj6GT2YYXdXww' },
      { id: 'eleven-liam', name: 'Liam', lang: 'en-US', gender: 'male', tone: 'Articulate young tech narrator', externalId: 'TX3LPaxmHKxFdv7VOQHJ' },
      { id: 'eleven-charlotte', name: 'Charlotte', lang: 'en-SE', gender: 'female', tone: 'Seductive & alluring Scandinavian', externalId: 'XB0fDUnXU5ikFXrFcQLo' },
      { id: 'eleven-alice', name: 'Alice', lang: 'en-GB', gender: 'female', tone: 'Confident, modern British executive', externalId: 'Xb7hH8MSUJpSbSDYk0k2' },
      { id: 'eleven-will', name: 'Will', lang: 'en-US', gender: 'male', tone: 'Friendly, accessible everyday male', externalId: 'bIHbv24MWmeRgasZH58o' },
      { id: 'eleven-jessica', name: 'Jessica', lang: 'en-US', gender: 'female', tone: 'Expressive, crisp & commercial', externalId: 'cgSgspJ2msm6clMCkdW9' },
      { id: 'eleven-eric', name: 'Eric', lang: 'en-US', gender: 'male', tone: 'Friendly conversational podcast host', externalId: 'cjVigY5qzO86Huf0OWal' },
      { id: 'eleven-chris', name: 'Chris', lang: 'en-US', gender: 'male', tone: 'Charming, casual & relatable', externalId: 'iP95p4xoKVk53GoZ742B' },
      { id: 'eleven-brian', name: 'Brian', lang: 'en-US', gender: 'male', tone: 'Deep resonant audiobook narrator', externalId: 'nPczCjzI2devNBz1zQrb' },
      { id: 'eleven-daniel', name: 'Daniel', lang: 'en-GB', gender: 'male', tone: 'Authoritative British news presenter', externalId: 'onwK4e9ZLuTAKqWW03F9' },
      { id: 'eleven-lily', name: 'Lily', lang: 'en-GB', gender: 'female', tone: 'Velvety, sophisticated British female', externalId: 'pFZP5JQG7iQjIQuC4Bku' },
      { id: 'eleven-bill', name: 'Bill', lang: 'en-US', gender: 'male', tone: 'Trustworthy, wise documentary voice', externalId: 'pqHfZKP75CvOlQylNhV4' },
      { id: 'eleven-sarah', name: 'Sarah', lang: 'en-US', gender: 'female', tone: 'Cheerfully upbeat & professional', externalId: 'EXAVITQu4vr4xnSDxMaL' }
    ];

    return list.map(item => ({
      id: item.id,
      name: `ElevenLabs ${item.name}`,
      provider: 'elevenlabs',
      language: item.lang,
      gender: item.gender,
      naturalness: 'generative',
      capabilities: {
        speedSupport: true,
        pitchSupport: false,
        emotionSupport: true,
        styleSupport: true,
        streamingSupport: true
      },
      supportsPreview: true,
      supportsStreaming: true,
      tone: item.tone,
      style: item.externalId,
      isAvailable: false,
      available: false
    }));
  }
}
