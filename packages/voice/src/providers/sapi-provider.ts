import { spawn } from 'node:child_process';
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
 * Windows SAPI / System.Speech TTS Provider
 * Enumerates and synthesizes classic installed Windows desktop voices.
 */
export class WindowsSapiTTSProvider implements TTSProvider {
  public readonly id = 'windows-sapi';
  public readonly name = 'Windows SAPI (System.Speech)';

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
Add-Type -AssemblyName System.Speech;
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$synth.GetInstalledVoices() | ForEach-Object {
  [PSCustomObject]@{
    Name = $_.VoiceInfo.Name;
    Culture = $_.VoiceInfo.Culture.Name;
    Gender = $_.VoiceInfo.Gender.ToString();
    Description = $_.VoiceInfo.Description;
    Enabled = $_.Enabled
  }
} | ConvertTo-Json -Compress;
$synth.Dispose();
`;
      const output = await this.runPowerShell(psCommand);
      const trimmed = output.trim();
      if (!trimmed) {
        this.cachedVoices = this.getStandardFallbackVoices();
        return this.cachedVoices;
      }

      const parsed = JSON.parse(trimmed);
      const rawList = Array.isArray(parsed) ? parsed : [parsed];

      const discovered: VoiceProfile[] = rawList
        .filter((item: any) => item && item.Enabled !== false)
        .map((item: any) => {
          const rawName: string = item.Name || 'Microsoft Voice';
          const genderStr = (item.Gender || 'neutral').toLowerCase();
          const gender = genderStr === 'female' ? 'female' : genderStr === 'male' ? 'male' : 'neutral';
          const culture: string = item.Culture || 'en-US';

          let shortId = 'local-' + rawName.toLowerCase()
            .replace(/microsoft\s*/i, '')
            .replace(/\s*desktop/i, '')
            .replace(/[^a-z0-9]/g, '-')
            .replace(/^-+|-+$/g, '');
          if (!shortId || shortId === 'local-') {
            shortId = `local-${Date.now()}`;
          }

          return {
            id: shortId,
            voiceId: shortId,
            providerVoiceId: rawName,
            name: rawName,
            provider: 'local',
            language: culture,
            gender,
            isAvailable: true,
            available: true,
            requiresApiKey: false,
            naturalness: 'standard',
            capabilities: {
              speedSupport: true,
              pitchSupport: false,
              emotionSupport: false,
              styleSupport: false,
              streamingSupport: false
            },
            supportedControls: ['speed'],
            characteristics: ['classic', 'desktop', 'clear'],
            supportsPreview: true,
            supportsStreaming: false,
            tone: 'Clear desktop speech',
            style: 'System standard'
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
        (targetId.startsWith('local-') && v.id.endsWith(targetId.replace('local-', '')))
      );
      if (match) selectedVoice = match;
    }

    const rate = options.speechRate ?? 1.0;
    let sapiRate = 0;
    if (rate > 1.0) {
      sapiRate = Math.min(10, Math.round((rate - 1.0) * 10));
    } else if (rate < 1.0) {
      sapiRate = Math.max(-10, Math.round((rate - 1.0) * 20));
    }

    const vol = options.volume ?? 1.0;
    const sapiVolume = Math.max(0, Math.min(100, Math.round(vol * 100)));

    const tempWavPath = path.join(
      os.tmpdir(),
      `meghai-tts-sapi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.wav`
    );

    if (process.platform === 'win32') {
      const escapedWavPath = tempWavPath.replace(/'/g, "''");
      const escapedText = cleanText.replace(/'/g, "''");
      const escapedVoiceName = selectedVoice.name.replace(/'/g, "''");

      const psCommand = `
Add-Type -AssemblyName System.Speech;
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
try {
  $synth.SelectVoice('${escapedVoiceName}');
} catch {}
$synth.Rate = ${sapiRate};
$synth.Volume = ${sapiVolume};
$synth.SetOutputToWaveFile('${escapedWavPath}');
$synth.Speak('${escapedText}');
$synth.Dispose();
`;
      await this.runPowerShell(psCommand);
    } else {
      const mockWav = this.createMinimalWavBuffer();
      await fsp.writeFile(tempWavPath, mockWav);
    }

    if (!fs.existsSync(tempWavPath)) {
      throw new Error(`SAPI synthesis failed: output file '${tempWavPath}' was not created.`);
    }

    const audioBuffer = await fsp.readFile(tempWavPath);
    const audioBase64 = audioBuffer.toString('base64');
    const durationMs = Math.round((audioBuffer.length / 44100) * 1000) || 1000;

    return {
      audioFilePath: tempWavPath,
      audioBuffer,
      audioBase64,
      durationMs,
      format: 'wav',
      sampleRate: 22050,
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
          reject(new Error(`PowerShell SAPI execution failed (code ${code}): ${stderr || stdout}`));
        }
      });

      child.on('error', err => reject(err));
    });
  }

  private getStandardFallbackVoices(): VoiceProfile[] {
    return [
      {
        id: 'local-david',
        voiceId: 'local-david',
        providerVoiceId: 'Microsoft David Desktop',
        name: 'Microsoft David Desktop',
        provider: 'local',
        language: 'en-US',
        gender: 'male',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'standard',
        capabilities: {
          speedSupport: true,
          pitchSupport: false,
          emotionSupport: false,
          styleSupport: false,
          streamingSupport: false
        },
        supportedControls: ['speed'],
        characteristics: ['classic', 'authoritative', 'american', 'desktop'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Crisp American male',
        style: 'System desktop'
      },
      {
        id: 'local-hazel',
        voiceId: 'local-hazel',
        providerVoiceId: 'Microsoft Hazel Desktop',
        name: 'Microsoft Hazel Desktop',
        provider: 'local',
        language: 'en-GB',
        gender: 'female',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'standard',
        capabilities: {
          speedSupport: true,
          pitchSupport: false,
          emotionSupport: false,
          styleSupport: false,
          streamingSupport: false
        },
        supportedControls: ['speed'],
        characteristics: ['classic', 'articulate', 'british', 'desktop'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Articulate British female',
        style: 'System desktop'
      },
      {
        id: 'local-zira',
        voiceId: 'local-zira',
        providerVoiceId: 'Microsoft Zira Desktop',
        name: 'Microsoft Zira Desktop',
        provider: 'local',
        language: 'en-US',
        gender: 'female',
        isAvailable: true,
        available: true,
        requiresApiKey: false,
        naturalness: 'standard',
        capabilities: {
          speedSupport: true,
          pitchSupport: false,
          emotionSupport: false,
          styleSupport: false,
          streamingSupport: false
        },
        supportedControls: ['speed'],
        characteristics: ['classic', 'clear', 'american', 'desktop'],
        supportsPreview: true,
        supportsStreaming: false,
        tone: 'Natural American female',
        style: 'System desktop'
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
    buf.writeUInt32LE(22050, 24);
    buf.writeUInt32LE(44100, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write('data', 36);
    buf.writeUInt32LE(8000, 40);
    return buf;
  }
}
