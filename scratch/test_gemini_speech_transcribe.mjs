import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const credPath = path.join(os.homedir(), '.meghai', 'credentials.json');
const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
const key = creds.gemini;

console.log('Generating spoken WAV via PowerShell WinRT OneCore TTS...');
const tempWav = path.join(os.tmpdir(), `test-speech-${Date.now()}.wav`);
const psScript = `
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToWaveFile('${tempWav.replace(/\\/g, '\\\\')}')
$synth.Speak('Hey Megh, what is twenty five times four?')
$synth.Dispose()
`;

await new Promise((resolve, reject) => {
  const p = spawn('powershell.exe', ['-NoProfile', '-Command', psScript]);
  p.on('close', resolve);
  p.on('error', reject);
});

console.log('Generated WAV:', tempWav, 'exists:', fs.existsSync(tempWav));
const audioBuffer = fs.readFileSync(tempWav);
console.log('Audio bytes:', audioBuffer.length);

const base64Audio = audioBuffer.toString('base64');

console.log('Sending audio to gemini-3.5-flash-lite for transcription...');
const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${key}`;
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
        { inlineData: { mimeType: 'audio/wav', data: base64Audio } }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.0
    }
  })
});

console.log('HTTP status:', res.status, res.statusText);
const body = await res.json();
console.log('Gemini response:', JSON.stringify(body, null, 2));

try { fs.unlinkSync(tempWav); } catch {}
