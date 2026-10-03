/**
 * MeghAI Audio Preprocessor & Quality Validator
 * Validates, measures, and conditions 16kHz mono 16-bit PCM audio frames
 * for transmission to online cloud STT engines while preserving natural speech.
 */

export interface AudioQualityReport {
  sampleRate: number;
  channels: number;
  durationMs: number;
  rms: number;
  peak: number;
  clippingRatio: number;
  snrEstimateDb: number;
  isValid: boolean;
  validationError?: string;
}

export function validateAudioParameters(
  sampleRate: number,
  channels: number,
  bitDepth = 16
): { valid: boolean; reason?: string } {
  if (sampleRate !== 16000 && sampleRate !== 44100 && sampleRate !== 48000) {
    return { valid: false, reason: `Unsupported sample rate: ${sampleRate}Hz. Expected 16000Hz standard.` };
  }
  if (channels !== 1) {
    return { valid: false, reason: `Expected mono audio (1 channel), received ${channels} channels.` };
  }
  if (bitDepth !== 16) {
    return { valid: false, reason: `Expected 16-bit signed PCM, received ${bitDepth}-bit.` };
  }
  return { valid: true };
}

export function analyzeAudioQuality(
  pcmData: Buffer,
  sampleRate = 16000,
  channels = 1
): AudioQualityReport {
  const bytesPerSample = 2;
  const numSamples = Math.floor(pcmData.length / bytesPerSample);
  const durationMs = Math.round((numSamples / sampleRate) * 1000);

  if (numSamples === 0) {
    return {
      sampleRate,
      channels,
      durationMs: 0,
      rms: 0,
      peak: 0,
      clippingRatio: 0,
      snrEstimateDb: 0,
      isValid: false,
      validationError: 'Empty audio buffer (0 bytes).'
    };
  }

  let sumSquares = 0;
  let peak = 0;
  let clippedSamples = 0;

  for (let i = 0; i < numSamples; i++) {
    const val = pcmData.readInt16LE(i * 2);
    const absVal = Math.abs(val);
    sumSquares += val * val;
    if (absVal > peak) peak = absVal;
    if (absVal >= 32700) clippedSamples++; // Near saturation in 16-bit PCM
  }

  const rms = Math.sqrt(sumSquares / numSamples);
  const clippingRatio = clippedSamples / numSamples;
  // Estimate SNR relative to quantization / noise floor
  const snrEstimateDb = rms > 0 ? Math.min(60, Math.max(0, 20 * Math.log10(rms / 50))) : 0;

  return {
    sampleRate,
    channels,
    durationMs,
    rms: Math.round(rms),
    peak,
    clippingRatio: Number(clippingRatio.toFixed(4)),
    snrEstimateDb: Number(snrEstimateDb.toFixed(1)),
    isValid: numSamples >= 1600 // At least 100ms of audio
  };
}

/**
 * Trims leading/trailing dead silence while strictly preserving speech phonemes.
 * Dead silence is defined as chunks with RMS below 80, keeping a 150ms buffer.
 */
export function trimSilencePadding(
  pcmData: Buffer,
  sampleRate = 16000
): Buffer {
  const bytesPerSample = 2;
  const frameSamples = Math.floor(sampleRate * 0.05); // 50ms frames
  const frameBytes = frameSamples * bytesPerSample;

  if (pcmData.length < frameBytes * 3) {
    return pcmData;
  }

  const numFrames = Math.floor(pcmData.length / frameBytes);
  const threshold = 120; // Silence threshold

  let startFrame = 0;
  while (startFrame < numFrames) {
    let sum = 0;
    const offset = startFrame * frameBytes;
    for (let i = 0; i < frameSamples; i++) {
      const v = pcmData.readInt16LE(offset + i * 2);
      sum += v * v;
    }
    const rms = Math.sqrt(sum / frameSamples);
    if (rms > threshold) break;
    startFrame++;
  }

  let endFrame = numFrames - 1;
  while (endFrame > startFrame) {
    let sum = 0;
    const offset = endFrame * frameBytes;
    for (let i = 0; i < frameSamples; i++) {
      const v = pcmData.readInt16LE(offset + i * 2);
      sum += v * v;
    }
    const rms = Math.sqrt(sum / frameSamples);
    if (rms > threshold) break;
    endFrame--;
  }

  // Preserve 100ms padding on each side so consonants/vowels are never clipped
  const padFrames = 2; // 100ms
  const actualStart = Math.max(0, startFrame - padFrames) * frameBytes;
  const actualEnd = Math.min(pcmData.length, (endFrame + 1 + padFrames) * frameBytes);

  return pcmData.subarray(actualStart, actualEnd);
}

/**
 * Creates a valid in-memory RIFF/WAVE header and returns a complete WAV Buffer.
 */
export function writePcmToWavBuffer(
  pcmData: Buffer,
  sampleRate = 16000,
  numChannels = 1
): Buffer {
  // If already a valid RIFF WAVE buffer, return as is
  if (pcmData.length >= 44 && pcmData.toString('ascii', 0, 4) === 'RIFF') {
    return pcmData;
  }

  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const subChunk2Size = pcmData.length;
  const chunkSize = 36 + subChunk2Size;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);             // Subchunk1Size
  header.writeUInt16LE(1, 20);              // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);    // NumChannels
  header.writeUInt32LE(sampleRate, 24);     // SampleRate
  header.writeUInt32LE(byteRate, 28);       // ByteRate
  header.writeUInt16LE(blockAlign, 32);     // BlockAlign
  header.writeUInt16LE(16, 34);             // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(subChunk2Size, 40);

  return Buffer.concat([header, pcmData]);
}
