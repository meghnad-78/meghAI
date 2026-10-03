import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  VoiceProfile,
  TTSOptions,
  TTSSynthesisResult,
  TTSProvider
} from '@meghai/shared-types';

/**
 * Windows OneCore TTS Provider
 * Enumerates and synthesizes modern natural Windows OneCore neural voices (WinRT SpeechSynthesizer).
 */
export class WindowsOneCoreTTSProvider implements TTSProvider {
  public readonly id = 'windows-onecore';
  public readonly name = 'Windows OneCore (Natural)';

  private cachedVoices: VoiceProfile[] | null = null;

  public async listVoices(forceRefresh = false): Promise<VoiceProfile[]> {
    if (this.cachedVoices && !forceRefresh) {
      return this.cachedVoices;
    }

    if (process.platform !== 'win32') {
      this.cachedVoices = this.getStandardFallbackVoices();
      return this.cachedVoices;
    }

    try {
      const psCommand = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime;
try {
  $synth = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]::new();
  [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object {
    [PSCustomObject]@{
      Id = $_.Id;
      DisplayName = $_.DisplayName;
      Language = $_.Language;
      Gender = $_.Gender.ToString();
      Description = $_.Description
    }
  } | ConvertTo-Json -Compress;
} catch {
  Write-Output '[]';
}
`;
      const output = await this.runPowerShell(psCommand);
      const trimmed = output.trim();
      if (!trimmed || trimmed === '[]') {
        this.cachedVoices = this.getStandardFallbackVoices();
        return this.cachedVoices;
      }

      const parsed = JSON.parse(trimmed);
      const rawList = Array.isArray(parsed) ? parsed : [parsed];

      const discovered: VoiceProfile[] = rawList
        .filter((item: any) => item && item.DisplayName)
        .map((item: any) => {
          const rawName: string = item.DisplayName || 'Microsoft Voice';
          const genderStr = (item.Gender || 'neutral').toLowerCase();
          const gender = genderStr.includes('female') ? 'female' : genderStr.includes('male') ? 'male' : 'neutral';
          const culture: string = item.Language || 'en-US';

          let shortId = 'onecore-' + rawName.toLowerCase()
            .replace(/microsoft\s*/i, '')
            .replace(/\s*online/i, '')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/^-+|-+$/g, '');
          if (!shortId || shortId === 'onecore-') {
            shortId = `onecore-${Date.now()}`;
          }

          let tone = 'Smooth natural Windows voice';
          if (culture === 'en-IN') tone = 'Indian English natural cadence';
          else if (culture === 'en-GB') tone = 'British English natural tone';
          else if (culture === 'en-US') tone = 'American English natural tone';

          const characteristics: string[] = culture === 'en-IN'
            ? ['warm', 'natural', 'articulate', 'conversational']
            : culture === 'en-GB'
            ? ['refined', 'expressive', 'articulate', 'narrator']
            : ['natural', 'clear', 'confident', 'conversational'];

          return {
            id: shortId,
            voiceId: shortId,
            providerVoiceId: item.Id || item.DisplayName,
            name: rawName,
            provider: 'windows-onecore',
            language: culture,
            gender,
            isAvailable: true,
            available: true,
            requiresApiKey: false,
            naturalness: 'neural',
            capabilities: {
              speedSupport: true,
              pitchSupport: true,
              emotionSupport: false,
              styleSupport: false,
              streamingSupport: false
            },
            supportedControls: ['speed', 'pitch'],
            characteristics,
            supportsPreview: true,
            supportsStreaming: false,
            tone,
            style: 'Natural Modern OneCore'
          };
        });

      if (discovered.length === 0) {
        this.cachedVoices = this.getStandardFallbackVoices();
      } else {
        this.cachedVoices = discovered;
      }
    } catch {
      this.cachedVoices = this.getStandardFallbackVoices();
    }

    return this.cachedVoices;
  }

  public async synthesize(text: string, options: TTSOptions = {}): Promise<TTSSynthesisResult> {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      throw new Error('TTS synthesis text cannot be empty.');
    }

    const voices = await this.listVoices();
    let selectedVoice = voices[0] || this.getStandardFallbackVoices()[0];

    if (options.voiceId) {
      const targetId = options.voiceId.toLowerCase();
      const match = voices.find(v =>
        v.id.toLowerCase() === targetId ||
        v.name.toLowerCase() === targetId ||
        v.id.toLowerCase().includes(targetId) ||
        v.name.toLowerCase().includes(targetId) ||
        (targetId.startsWith('onecore-') && v.id.endsWith(targetId.replace('onecore-', '')))
      );
      if (match) selectedVoice = match;
    }

    const rate = options.speechRate ?? 1.0;
    const vol = options.volume ?? 1.0;

    const tempWavPath = path.join(
      os.tmpdir(),
      `meghai-tts-onecore-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.wav`
    );

    if (process.platform === 'win32') {
      const scriptPath = this.resolveScriptPath('synthesize-onecore.ps1');
      if (!fs.existsSync(scriptPath)) {
        throw new Error(`OneCore synthesis script not found at ${scriptPath}`);
      }

      // Extract voice search name (e.g. "Heera" or "David")
      const voiceSearchName = selectedVoice.name.replace(/microsoft\s*/i, '').trim();

      await new Promise<void>((resolve, reject) => {
        const child = spawn('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy', 'Bypass',
          '-File', scriptPath,
          '-Text', cleanText,
          '-VoiceName', voiceSearchName,
          '-Rate', String(rate),
          '-Volume', String(vol),
          '-OutputFile', tempWavPath
        ], { windowsHide: true });

        let stderr = '';
        child.stderr.on('data', d => { stderr += d.toString(); });
        child.on('close', code => {
          if (code === 0 && fs.existsSync(tempWavPath)) {
            resolve();
          } else {
            reject(new Error(`OneCore synthesis failed (code ${code}): ${stderr}`));
          }
        });
        child.on('error', reject);
      });
    } else {
      const mockWav = this.createMinimalWavBuffer();
      await fsp.writeFile(tempWavPath, mockWav);
    }

    if (!fs.existsSync(tempWavPath)) {
      throw new Error(`OneCore synthesis failed: output file '${tempWavPath}' was not created.`);
    }

    const audioBuffer = await fsp.readFile(tempWavPath);
    const audioBase64 = audioBuffer.toString('base64');
    // Sample rate is 16kHz for OneCore mono (32,000 bytes/sec)
    const durationMs = Math.round((audioBuffer.length / 32000) * 1000) || 1000;

    return {
      audioFilePath: tempWavPath,
      audioBuffer,
      audioBase64,
      durationMs,
      format: 'wav',
      sampleRate: 16000,
      voiceId: selectedVoice.id,
      spokenText: cleanText
    };
  }

  public async isAvailable(): Promise<boolean> {
    return process.platform === 'win32';
  }

  private runPowerShell(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => { stdout += data.toString(); });
      child.stderr.on('data', data => { stderr += data.toString(); });

      child.on('close', code => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`PowerShell OneCore execution failed (code ${code}): ${stderr || stdout}`));
        }
      });

      child.on('error', err => reject(err));
    });
  }

  private resolveScriptPath(scriptName: string): string {
    const curDir = typeof __dirname !== 'undefined'
      ? __dirname
      : path.dirname(fileURLToPath(import.meta.url));

    const candidates = [
      path.join(curDir, '..', 'scripts', scriptName),
      path.join(curDir, 'scripts', scriptName),
      path.join(process.cwd(), 'packages', 'voice', 'src', 'scripts', scriptName),
      path.join(process.cwd(), 'packages', 'voice', 'dist', 'scripts', scriptName)
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0];
  }

  private static readonly ONECORE_CAPABILITY: VoiceProfile['capabilities'] = {
    speedSupport: true,
    pitchSupport: true,
    emotionSupport: false,
    styleSupport: false,
    streamingSupport: false
  };

  private getStandardFallbackVoices(): VoiceProfile[] {
    const caps = WindowsOneCoreTTSProvider.ONECORE_CAPABILITY;
    return [
      {
        id: 'onecore-heera',
        voiceId: 'onecore-heera',
        providerVoiceId: 'Microsoft Heera',
        name: 'Microsoft Heera',
        provider: 'windows-onecore',
        language: 'en-IN',
        gender: 'female',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'neural',
        capabilities: caps,
        supportedControls: ['speed', 'pitch'],
        characteristics: ['warm', 'natural', 'articulate', 'conversational'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Warm natural Indian English',
        style: 'Modern OneCore'
      },
      {
        id: 'onecore-ravi',
        voiceId: 'onecore-ravi',
        providerVoiceId: 'Microsoft Ravi',
        name: 'Microsoft Ravi',
        provider: 'windows-onecore',
        language: 'en-IN',
        gender: 'male',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'neural',
        capabilities: caps,
        supportedControls: ['speed', 'pitch'],
        characteristics: ['clear', 'articulate', 'calm', 'professional'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Articulate Indian English',
        style: 'Modern OneCore'
      },
      {
        id: 'onecore-george',
        voiceId: 'onecore-george',
        providerVoiceId: 'Microsoft George',
        name: 'Microsoft George',
        provider: 'windows-onecore',
        language: 'en-GB',
        gender: 'male',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'neural',
        capabilities: caps,
        supportedControls: ['speed', 'pitch'],
        characteristics: ['refined', 'british', 'authoritative', 'narrator'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Refined British English',
        style: 'Modern OneCore'
      },
      {
        id: 'onecore-susan',
        voiceId: 'onecore-susan',
        providerVoiceId: 'Microsoft Susan',
        name: 'Microsoft Susan',
        provider: 'windows-onecore',
        language: 'en-GB',
        gender: 'female',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'neural',
        capabilities: caps,
        supportedControls: ['speed', 'pitch'],
        characteristics: ['expressive', 'british', 'warm', 'conversational'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Expressive British English',
        style: 'Modern OneCore'
      },
      {
        id: 'onecore-david',
        voiceId: 'onecore-david',
        providerVoiceId: 'Microsoft David',
        name: 'Microsoft David',
        provider: 'windows-onecore',
        language: 'en-US',
        gender: 'male',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'neural',
        capabilities: caps,
        supportedControls: ['speed', 'pitch'],
        characteristics: ['natural', 'american', 'confident', 'clear'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Natural American English male',
        style: 'Modern OneCore'
      },
      {
        id: 'onecore-zira',
        voiceId: 'onecore-zira',
        providerVoiceId: 'Microsoft Zira',
        name: 'Microsoft Zira',
        provider: 'windows-onecore',
        language: 'en-US',
        gender: 'female',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'neural',
        capabilities: caps,
        supportedControls: ['speed', 'pitch'],
        characteristics: ['clear', 'american', 'bright', 'professional'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Clear American English female',
        style: 'Modern OneCore'
      },
      {
        id: 'onecore-mark',
        voiceId: 'onecore-mark',
        providerVoiceId: 'Microsoft Mark',
        name: 'Microsoft Mark',
        provider: 'windows-onecore',
        language: 'en-US',
        gender: 'male',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'neural',
        capabilities: caps,
        supportedControls: ['speed', 'pitch'],
        characteristics: ['dynamic', 'american', 'energetic', 'confident'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Dynamic American English male',
        style: 'Modern OneCore'
      },
      {
        id: 'onecore-hazel',
        voiceId: 'onecore-hazel',
        providerVoiceId: 'Microsoft Hazel',
        name: 'Microsoft Hazel',
        provider: 'windows-onecore',
        language: 'en-GB',
        gender: 'female',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'neural',
        capabilities: caps,
        supportedControls: ['speed', 'pitch'],
        characteristics: ['gentle', 'british', 'soft', 'calm'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Gentle British English female',
        style: 'Modern OneCore'
      }
    ];
  }

  private createMinimalWavBuffer(): Buffer {
    const buf = Buffer.alloc(44 + 8000);
    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + 8000, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(16000, 24);
    buf.writeUInt32LE(32000, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(8000, 40);
    return buf;
  }
}
