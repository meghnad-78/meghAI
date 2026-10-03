import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import type { STTProvider, STTResult } from '@meghai/shared-types';

/**
 * Utility to write 16kHz mono 16-bit PCM buffer into a valid RIFF/WAVE file
 */
export function writePcmToWavFile(pcmData: Buffer, targetPath: string, sampleRate = 16000, numChannels = 1): void {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const subChunk2Size = pcmData.length;
  const chunkSize = 36 + subChunk2Size;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);             // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);              // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);    // NumChannels
  header.writeUInt32LE(sampleRate, 24);     // SampleRate
  header.writeUInt32LE(byteRate, 28);       // ByteRate
  header.writeUInt16LE(blockAlign, 32);     // BlockAlign
  header.writeUInt16LE(16, 34);             // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(subChunk2Size, 40);

  fs.writeFileSync(targetPath, Buffer.concat([header, pcmData]));
}

/**
 * Windows Native Local Speech Recognition Provider (Phase 11)
 * Built on Windows System.Speech.Recognition (Desktop SAPI) with DictationGrammar + Command choices.
 * 100% offline, $0/₹0, no cloud transmission.
 */
export class WindowsSpeechSTTProvider implements STTProvider {
  public readonly id = 'windows-system-speech';
  public readonly name = 'Windows Native Speech Recognition';

  public isAvailable(): boolean {
    return process.platform === 'win32';
  }

  public async transcribe(
    audioBuffer: Buffer,
    options: { culture?: string; sampleRate?: number } = {}
  ): Promise<STTResult> {
    if (process.platform !== 'win32') {
      return {
        text: '',
        confidence: 0,
        isFinal: true
      };
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return {
        text: '',
        confidence: 0,
        isFinal: true
      };
    }

    const scriptPath = this.resolveScriptPath('transcribe.ps1');
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`transcribe.ps1 not found at ${scriptPath}`);
    }

    // Determine if audio is already RIFF WAV or raw PCM
    const isWav = audioBuffer.length > 12 && audioBuffer.toString('ascii', 0, 4) === 'RIFF';
    const tempWavPath = path.join(os.tmpdir(), `meghai-stt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`);

    try {
      if (isWav) {
        await fsp.writeFile(tempWavPath, audioBuffer);
      } else {
        writePcmToWavFile(audioBuffer, tempWavPath, options.sampleRate ?? 16000, 1);
      }

      const culture = options.culture || 'en-US';

      const result = await new Promise<STTResult>((resolve, reject) => {
        const child = spawn('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy', 'Bypass',
          '-File', scriptPath,
          '-AudioPath', tempWavPath,
          '-Culture', culture
        ], { windowsHide: true });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', d => { stdout += d.toString(); });
        child.stderr.on('data', d => { stderr += d.toString(); });

        child.on('close', code => {
          if (code === 0 && stdout.trim()) {
            try {
              const parsed = JSON.parse(stdout.trim());
              resolve({
                text: (parsed.text || '').trim(),
                confidence: Number(parsed.confidence ?? 0),
                culture: parsed.culture || culture,
                isFinal: true
              });
              return;
            } catch {}
          }
          resolve({
            text: '',
            confidence: 0,
            culture,
            isFinal: true
          });
        });

        child.on('error', err => reject(err));
      });

      return result;
    } finally {
      if (fs.existsSync(tempWavPath)) {
        try { await fsp.unlink(tempWavPath); } catch {}
      }
    }
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

import { STTRouter } from './stt-router.js';

/**
 * Speech Recognition Service (Online-First)
 * Provider-agnostic coordinator for online and local speech transcription.
 * Uses STTRouter for intelligent language detection, keyterm biasing, and failover.
 */
export class SpeechRecognitionService {
  private router: STTRouter;

  constructor(customProviders?: STTProvider[]) {
    this.router = new STTRouter();
    if (customProviders) {
      for (const p of customProviders) {
        this.router.registerProvider(p);
      }
    }
  }

  public getRouter(): STTRouter {
    return this.router;
  }

  public getProvider(id: string): STTProvider | undefined {
    return this.router.getProvider(id);
  }

  public listProviders(): Array<{ id: string; name: string; isAvailable: boolean; isConfigured?: boolean }> {
    return this.router.listProviders().map(p => ({
      id: p.id,
      name: p.name,
      isAvailable: typeof p.isAvailable === 'function' ? !!p.isAvailable() : true,
      isConfigured: typeof p.isConfigured === 'function' ? p.isConfigured() : true
    }));
  }

  public async transcribe(
    audioBuffer: Buffer,
    options: { providerId?: string; culture?: string; language?: string; sampleRate?: number; keyterms?: string[] } = {}
  ): Promise<STTResult> {
    return this.router.transcribe(audioBuffer, options);
  }
}
