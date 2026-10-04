import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const credPath = path.join(os.homedir(), '.meghai', 'credentials.json');
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
const key = creds.gemini;

console.log('Testing Gemini STT directly with audio payload...');

// Create a minimal 1s PCM 16kHz mono WAV buffer
function createWavHeader(dataLength, sampleRate = 16000, numChannels = 1) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * 2, 28);
  header.writeUInt16LE(numChannels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

// Generate 1.5 seconds of a 440Hz sine wave as PCM
const sampleRate = 16000;
const durationSec = 1.5;
const numSamples = Math.floor(sampleRate * durationSec);
const pcm = Buffer.alloc(numSamples * 2);
for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const sample = Math.sin(2 * Math.PI * 440 * t) * 10000;
  pcm.writeInt16LE(Math.round(sample), i * 2);
}
const wav = Buffer.concat([createWavHeader(pcm.length, sampleRate), pcm]);
const base64Audio = wav.toString('base64');

console.log('Sending audio to gemini-3.8-flash:generateContent...');
const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`;
const prompt = `You are a speech-to-text transcriber for the personal AI MeghAI.
Transcribe the user's speech audio verbatim.
Output JSON format only: {"transcript": "...", "language": "...", "confidence": 0.95}`;

const res = await fetch(geminiUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        {
          inlineData: {
            mimeType: 'audio/wav',
            data: base64Audio
          }
        }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.0
    }
  })
});

console.log('HTTP status:', res.status, res.statusText);
const bodyText = await res.text();
console.log('Response body:', bodyText);
