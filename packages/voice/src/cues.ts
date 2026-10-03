import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { AudioCueType } from '@meghai/shared-types';

/**
 * Creates a standard 44-byte RIFF WAV buffer from Float32Array PCM samples (-1.0 to 1.0)
 */
export function createWavBuffer(samples: Float32Array, sampleRate = 22050): Buffer {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate (SampleRate * 1 * 16/8)
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Write 16-bit signed PCM samples
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

/**
 * Audio Cue Synthesizer & Cache (Part 10)
 * Generates local, offline, deterministic mathematical PCM WAV audio cues.
 */
export class AudioCueService {
  private static cueBuffers = new Map<AudioCueType, Buffer>();
  private static cueFilePaths = new Map<AudioCueType, string>();

  /**
   * Generates or retrieves cached WAV buffer for a cue
   */
  public static getCueBuffer(cue: AudioCueType): Buffer {
    let cached = this.cueBuffers.get(cue);
    if (!cached) {
      cached = this.generateCue(cue);
      this.cueBuffers.set(cue, cached);
    }
    return cached;
  }

  /**
   * Generates or retrieves cached temporary WAV file path for Windows playback
   */
  public static async getCueFilePath(cue: AudioCueType): Promise<string> {
    const existing = this.cueFilePaths.get(cue);
    if (existing && fs.existsSync(existing)) {
      return existing;
    }

    const buf = this.getCueBuffer(cue);
    const tmpPath = path.join(os.tmpdir(), `meghai-cue-${cue}.wav`);
    await fsp.writeFile(tmpPath, buf);
    this.cueFilePaths.set(cue, tmpPath);
    return tmpPath;
  }

  /**
   * Procedural audio cue generation with pure mathematical waveforms
   */
  private static generateCue(cue: AudioCueType): Buffer {
    const sampleRate = 22050;

    switch (cue) {
      case 'startup': {
        // Futuristic two-tone swell: C5 (523Hz) -> G5 (784Hz) with octave shimmer, 380ms
        const duration = 0.38;
        const totalSamples = Math.floor(sampleRate * duration);
        const samples = new Float32Array(totalSamples);

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          // Pitch progression: 523Hz to 784Hz
          const freq = 523.25 + (783.99 - 523.25) * Math.min(1, t / 0.18);
          // Attack / Decay envelope
          const attack = Math.min(1, t / 0.03);
          const decay = Math.max(0, 1 - (t - 0.1) / (duration - 0.1));
          const env = attack * (t < 0.1 ? 1 : Math.pow(decay, 1.8));

          // Tone + gentle shimmer harmonics
          const s1 = Math.sin(2 * Math.PI * freq * t);
          const s2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.25;
          const s3 = Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.15;
          samples[i] = (s1 + s2 + s3) * 0.45 * env;
        }
        return createWavBuffer(samples, sampleRate);
      }

      case 'listening': {
        // Subtle rising pip: D5 (587Hz) -> A5 (880Hz), 150ms
        const duration = 0.15;
        const totalSamples = Math.floor(sampleRate * duration);
        const samples = new Float32Array(totalSamples);

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          const freq = 587.33 + (880.0 - 587.33) * (t / duration);
          const env = Math.sin((t / duration) * Math.PI); // Half sine bell
          samples[i] = Math.sin(2 * Math.PI * freq * t) * 0.35 * Math.pow(env, 0.7);
        }
        return createWavBuffer(samples, sampleRate);
      }

      case 'thinking': {
        // Soft rhythmic ambient pulse loop: 220Hz + 440Hz warm harmonic, 600ms seamless loop
        const duration = 0.6;
        const totalSamples = Math.floor(sampleRate * duration);
        const samples = new Float32Array(totalSamples);

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          // Smooth pulsating window
          const pulse = (1 - Math.cos((2 * Math.PI * t) / duration)) / 2;
          const tone1 = Math.sin(2 * Math.PI * 220 * t);
          const tone2 = Math.sin(2 * Math.PI * 440 * t) * 0.3;
          samples[i] = (tone1 + tone2) * 0.18 * pulse; // Quiet, ambient level
        }
        return createWavBuffer(samples, sampleRate);
      }

      case 'answer_ready': {
        // Soft crystalline chime: G5 (784Hz) -> C6 (1046.5Hz), 220ms
        const duration = 0.22;
        const totalSamples = Math.floor(sampleRate * duration);
        const samples = new Float32Array(totalSamples);

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          const f1 = 783.99;
          const f2 = 1046.5;
          const attack = Math.min(1, t / 0.015);
          const decay = Math.exp(-t * 12);
          const env = attack * decay;

          const s1 = Math.sin(2 * Math.PI * f1 * t) * 0.4;
          const s2 = Math.sin(2 * Math.PI * f2 * t) * 0.35;
          samples[i] = (s1 + s2) * env;
        }
        return createWavBuffer(samples, sampleRate);
      }

      case 'interrupt': {
        // Descending cutoff note: 440Hz -> 220Hz, 110ms
        const duration = 0.11;
        const totalSamples = Math.floor(sampleRate * duration);
        const samples = new Float32Array(totalSamples);

        for (let i = 0; i < totalSamples; i++) {
          const t = i / sampleRate;
          const freq = 440 - (440 - 220) * (t / duration);
          const env = Math.max(0, 1 - (t / duration));
          samples[i] = Math.sin(2 * Math.PI * freq * t) * 0.25 * env;
        }
        return createWavBuffer(samples, sampleRate);
      }
    }
  }
}
