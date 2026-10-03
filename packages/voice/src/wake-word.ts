import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import type { AudioFrame, WakeWordResult, EventType } from '@meghai/shared-types';
import { writePcmToWavFile } from './stt.js';

export interface AcousticWakeWordOptions {
  debounceTimeMs?: number;   // Minimum ms between consecutive wake detections (default: 2000ms)
  confidenceThreshold?: number; // Minimum confidence to accept (default: 0.55)
  onWakeDetected?: (result: WakeWordResult) => void;
  eventBus?: { publish: (type: EventType, payload: any, correlationId?: string) => void };
}

/**
 * Real Acoustic Wake Word Detector (Phase 8 & 9)
 * Detects "Hey Megh" and "Megh" from real acoustic microphone PCM frames using native Windows speech grammar.
 * Zero text/regex matching, zero cloud audio streaming, strictly debounced with loop prevention.
 */
export class AcousticWakeWordDetector {
  private isProcessing = false;
  private lastTriggerTime = 0;
  private readonly debounceTimeMs: number;
  private readonly confidenceThreshold: number;
  private readonly onWakeDetected?: (result: WakeWordResult) => void;
  private readonly eventBus?: { publish: (type: EventType, payload: any, correlationId?: string) => void };

  constructor(options: AcousticWakeWordOptions = {}) {
    this.debounceTimeMs = options.debounceTimeMs ?? 2000;
    this.confidenceThreshold = options.confidenceThreshold ?? 0.55;
    this.onWakeDetected = options.onWakeDetected;
    this.eventBus = options.eventBus;
  }

  /**
   * Check whether an audio PCM buffer contains "Hey Megh" or "Megh"
   */
  public async detectWakePhrase(pcmAudioBuffer: Buffer): Promise<WakeWordResult> {
    const now = Date.now();
    if (now - this.lastTriggerTime < this.debounceTimeMs) {
      return { detected: false };
    }

    if (this.isProcessing) {
      return { detected: false };
    }

    if (process.platform !== 'win32') {
      return { detected: false };
    }

    // Must be at least 200ms of audio (6,400 bytes at 16kHz 16-bit mono)
    if (pcmAudioBuffer.length < 6400) {
      return { detected: false };
    }

    const scriptPath = this.resolveScriptPath('detect-wake.ps1');
    if (!fs.existsSync(scriptPath)) {
      return { detected: false };
    }

    this.isProcessing = true;
    const tempWavPath = path.join(os.tmpdir(), `meghai-wake-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`);

    try {
      const isWav = pcmAudioBuffer.length > 12 && pcmAudioBuffer.toString('ascii', 0, 4) === 'RIFF';
      if (isWav) {
        await fsp.writeFile(tempWavPath, pcmAudioBuffer);
      } else {
        writePcmToWavFile(pcmAudioBuffer, tempWavPath, 16000, 1);
      }

      const result = await new Promise<WakeWordResult>((resolve) => {
        const child = spawn('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy', 'Bypass',
          '-File', scriptPath,
          '-AudioPath', tempWavPath
        ], { windowsHide: true });

        let stdout = '';
        child.stdout.on('data', d => { stdout += d.toString(); });
        child.on('close', code => {
          if (code === 0 && stdout.trim()) {
            try {
              const parsed = JSON.parse(stdout.trim());
              if (parsed.detected && Number(parsed.confidence ?? 0) >= this.confidenceThreshold) {
                resolve({
                  detected: true,
                  phrase: parsed.phrase || 'Hey Megh',
                  confidence: Number(parsed.confidence),
                  rawText: parsed.rawText
                });
                return;
              }
            } catch {}
          }
          resolve({ detected: false });
        });
        child.on('error', () => resolve({ detected: false }));
      });

      if (result.detected) {
        this.lastTriggerTime = Date.now();
        this.onWakeDetected?.(result);
        this.eventBus?.publish('WAKE_DETECTED', {
          phrase: result.phrase,
          confidence: result.confidence,
          timestamp: this.lastTriggerTime
        });
      }

      return result;
    } finally {
      this.isProcessing = false;
      if (fs.existsSync(tempWavPath)) {
        try { await fsp.unlink(tempWavPath); } catch {}
      }
    }
  }

  public reset(): void {
    this.isProcessing = false;
    this.lastTriggerTime = 0;
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

/**
 * Text-based wake pattern helper (backward-compatibility for typed input & commands)
 */
export class WakeWordDetector {
  private static readonly PATTERNS = [
    /\bhey megh\b/i,
    /\bmegh\b/i
  ];

  public static isWakeTrigger(transcript: string): { isTriggered: boolean; cleanedText: string } {
    const trimmed = transcript.trim();
    for (const pattern of this.PATTERNS) {
      if (pattern.test(trimmed)) {
        const cleaned = trimmed.replace(pattern, '').replace(/^[,:\s]+/, '').trim();
        return { isTriggered: true, cleanedText: cleaned };
      }
    }
    return { isTriggered: false, cleanedText: trimmed };
  }
}

/**
 * Deterministically strips wake phrase prefixes ("Hey Megh", "Megh", "Hey Mag", etc.)
 * from transcripts while preserving the user's actual command (Section 12).
 */
export function stripWakePhrase(rawText: string): { cleaned: string; raw: string; wakeStripped: boolean } {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return { cleaned: '', raw: '', wakeStripped: false };
  const wakeRegex = /^(?:(?:hey|hi|hello|ok|okay)\s+)?(?:megh|meg|mag|meghai)\b[\s,:\.\?!-]*/i;
  const match = trimmed.match(wakeRegex);
  if (match) {
    const stripped = trimmed.slice(match[0].length).trim();
    return { cleaned: stripped, raw: trimmed, wakeStripped: true };
  }
  return { cleaned: trimmed, raw: trimmed, wakeStripped: false };
}

