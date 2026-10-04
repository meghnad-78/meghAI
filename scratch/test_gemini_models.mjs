import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const credPath = path.join(os.homedir(), '.meghai', 'credentials.json');
let creds = {};
try {
  creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
} catch (e) {
  console.error('Failed to read creds:', e);
}

const geminiKey = creds.gemini;
console.log('Gemini key exists:', Boolean(geminiKey));

if (geminiKey) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
    const data = await res.json();
    if (data.models) {
      console.log('Available models count:', data.models.length);
      const flash = data.models.filter(m => m.name.includes('flash')).map(m => m.name.replace('models/', ''));
      console.log('Flash models:', flash);
    } else {
      console.log('API Response error:', data);
    }
  } catch (err) {
    console.error('Fetch error:', err.message);
  }
}
