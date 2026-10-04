import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const credPath = path.join(os.homedir(), '.meghai', 'credentials.json');
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
const key = creds.gemini;

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

const sampleRate = 16000;
const pcm = Buffer.alloc(sampleRate * 2); // 1s
const wav = Buffer.concat([createWavHeader(pcm.length, sampleRate), pcm]);
const base64Audio = wav.toString('base64');

const candidateModels = [
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
];

for (const model of candidateModels) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: 'Transcribe this audio: output json {"transcript": "..."}' },
            { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
          ]
        }]
      })
    });
    console.log(`Model [${model}]: status=${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`✓ Model [${model}] SUCCESS:`, data.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 100));
      break;
    } else {
      const err = await res.text();
      console.log(`✗ Model [${model}] error:`, err.slice(0, 150));
    }
  } catch (e) {
    console.log(`Model [${model}] fetch error:`, e.message);
  }
}
