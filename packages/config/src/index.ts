import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { PrivacyMode, CostMode } from '@meghai/shared-types';

export interface MeghAIConfig {
  env: 'development' | 'test' | 'production';
  apiPort: number;
  agentPort: number;
  desktopPort: number;
  storageDir: string;
  privacyMode: PrivacyMode;
  costMode: CostMode;
  providers: {
    geminiApiKey?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    deepseekApiKey?: string;
    grokApiKey?: string;
    perplexityApiKey?: string;
    elevenlabsApiKey?: string;
    googleCloudApiKey?: string;
    ollamaHost: string;
    ollamaBaseUrl?: string;
    ollamaModel?: string;
  };
}

export interface ModelSettings {
  selectedProvider: string; // 'auto' | 'gemini' | 'openai' | 'local-ollama' | 'anthropic' | 'deepseek' | 'perplexity'
  selectedModel?: string;   // specific model ID e.g. 'llama3.2:latest', 'gemini-3.8-flash', 'gpt-4o-mini'
  allowExplicitFallback?: boolean; // default false
}

function getMeghAIDir(): string {
  const home = os.homedir();
  const meghaiDir = path.join(home, '.meghai');
  if (!fs.existsSync(meghaiDir)) {
    try {
      fs.mkdirSync(meghaiDir, { recursive: true });
    } catch {}
  }
  return meghaiDir;
}

function getCredentialsFilePath(): string {
  return path.join(getMeghAIDir(), 'credentials.json');
}

function getModelSettingsFilePath(): string {
  return path.join(getMeghAIDir(), 'model-settings.json');
}

export class ModelSettingsManager {
  private filePath: string;
  private settings: ModelSettings;

  constructor(customPath?: string) {
    this.filePath = customPath || getModelSettingsFilePath();
    this.settings = this.load();
  }

  public getSettings(): ModelSettings {
    this.settings = this.load();
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<ModelSettings>): ModelSettings {
    this.settings = this.load();
    this.settings = { ...this.settings, ...partial };
    this.save();
    return { ...this.settings };
  }

  private load(): ModelSettings {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          selectedProvider: parsed.selectedProvider || 'auto',
          selectedModel: parsed.selectedModel,
          allowExplicitFallback: Boolean(parsed.allowExplicitFallback)
        };
      } catch {}
    }
    return {
      selectedProvider: 'auto',
      selectedModel: undefined,
      allowExplicitFallback: false
    };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.settings, null, 2), 'utf-8');
    } catch {}
  }
}

export function loadStoredModelSettings(customPath?: string): ModelSettings {
  return new ModelSettingsManager(customPath).getSettings();
}

export function saveStoredModelSettings(settings: Partial<ModelSettings>, customPath?: string): ModelSettings {
  return new ModelSettingsManager(customPath).updateSettings(settings);
}

export function loadStoredCredentials(customPath?: string): Record<string, string> {
  const filePath = customPath || getCredentialsFilePath();
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function isTestOrDummyCredential(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return (
    trimmed.startsWith('sk-test-') ||
    trimmed.startsWith('test-') ||
    trimmed.includes('test-credential') ||
    trimmed === 'mock-key' ||
    trimmed === 'dummy'
  );
}

export function saveProviderCredential(providerId: string, apiKey: string, customPath?: string): void {
  const filePath = customPath || getCredentialsFilePath();
  const creds = loadStoredCredentials(filePath);
  creds[providerId] = apiKey.trim();
  fs.writeFileSync(filePath, JSON.stringify(creds, null, 2), 'utf-8');

  // Only hydrate process.env immediately for the real credentials file outside test mode
  if (!customPath && process.env['NODE_ENV'] !== 'test') {
    hydrateEnvWithKey(providerId, apiKey.trim(), true);
  }
}

export function removeProviderCredential(providerId: string, customPath?: string): void {
  const filePath = customPath || getCredentialsFilePath();
  const creds = loadStoredCredentials(filePath);
  if (creds[providerId]) {
    delete creds[providerId];
    fs.writeFileSync(filePath, JSON.stringify(creds, null, 2), 'utf-8');
  }

  if (!customPath) {
    const map: Record<string, string[]> = {
      gemini: ['GEMINI_API_KEY'],
      openai: ['OPENAI_API_KEY'],
      anthropic: ['ANTHROPIC_API_KEY'],
      deepseek: ['DEEPSEEK_API_KEY'],
      grok: ['XAI_API_KEY', 'GROK_API_KEY'],
      perplexity: ['PERPLEXITY_API_KEY'],
      elevenlabs: ['ELEVENLABS_API_KEY'],
      'google-cloud': ['GOOGLE_CLOUD_API_KEY', 'GOOGLE_TTS_API_KEY'],
      google: ['GOOGLE_CLOUD_API_KEY', 'GOOGLE_TTS_API_KEY']
    };
    const envVars = map[providerId.toLowerCase()] || [];
    for (const ev of envVars) {
      delete process.env[ev];
    }
  }
}

function hydrateEnvWithKey(providerId: string, key: string, force = false): void {
  // Never hydrate mock/dummy test fixtures into production environment
  if (process.env['NODE_ENV'] !== 'test' && isTestOrDummyCredential(key)) {
    return;
  }

  const map: Record<string, string[]> = {
    gemini: ['GEMINI_API_KEY'],
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    deepseek: ['DEEPSEEK_API_KEY'],
    grok: ['XAI_API_KEY', 'GROK_API_KEY'],
    perplexity: ['PERPLEXITY_API_KEY'],
    elevenlabs: ['ELEVENLABS_API_KEY'],
    'google-cloud': ['GOOGLE_CLOUD_API_KEY', 'GOOGLE_TTS_API_KEY', 'GEMINI_API_KEY'],
    google: ['GOOGLE_CLOUD_API_KEY', 'GOOGLE_TTS_API_KEY']
  };

  const envVars = map[providerId.toLowerCase()] || [];
  for (const ev of envVars) {
    if (force || !process.env[ev]) {
      process.env[ev] = key;
    }
  }
}

export function loadConfig(): MeghAIConfig {
  const localAppData = process.env['LOCALAPPDATA'] || process.env['USERPROFILE'] || '.';
  const defaultStorage = path.join(localAppData, 'MeghAI', 'data');

  // Hydrate environment from ~/.meghai/credentials.json if present (only when not in test mode)
  if (process.env['NODE_ENV'] !== 'test') {
    const stored = loadStoredCredentials();
    for (const [providerId, key] of Object.entries(stored)) {
      if (key && key.trim()) hydrateEnvWithKey(providerId, key.trim(), false);
    }
  }

  // Precedence rule for Gemini: GOOGLE_API_KEY takes precedence over GEMINI_API_KEY if both exist
  const stored = process.env['NODE_ENV'] !== 'test' ? loadStoredCredentials() : {};
  const resolvedGeminiKey =
    process.env['GOOGLE_API_KEY']?.trim() ||
    process.env['GEMINI_API_KEY']?.trim() ||
    stored['gemini']?.trim() ||
    stored['google']?.trim();

  return {
    env: (process.env['NODE_ENV'] as any) || 'development',
    apiPort: parseInt(process.env['PORT'] || '4820', 10),
    agentPort: parseInt(process.env['AGENT_PORT'] || '4821', 10),
    desktopPort: parseInt(process.env['DESKTOP_PORT'] || '3000', 10),
    storageDir: process.env['MEGHAI_STORAGE_DIR'] || defaultStorage,
    privacyMode: (process.env['MEGHAI_PRIVACY_MODE'] as PrivacyMode) || 'CLOUD_ENABLED',
    costMode: (process.env['MEGHAI_COST_MODE'] as CostMode) || 'BALANCED',
    providers: {
      geminiApiKey: isTestOrDummyCredential(resolvedGeminiKey) && process.env['NODE_ENV'] !== 'test' ? undefined : resolvedGeminiKey,
      openaiApiKey: isTestOrDummyCredential(process.env['OPENAI_API_KEY']) && process.env['NODE_ENV'] !== 'test' ? undefined : process.env['OPENAI_API_KEY'],
      anthropicApiKey: isTestOrDummyCredential(process.env['ANTHROPIC_API_KEY']) && process.env['NODE_ENV'] !== 'test' ? undefined : process.env['ANTHROPIC_API_KEY'],
      deepseekApiKey: isTestOrDummyCredential(process.env['DEEPSEEK_API_KEY']) && process.env['NODE_ENV'] !== 'test' ? undefined : process.env['DEEPSEEK_API_KEY'],
      grokApiKey: isTestOrDummyCredential(process.env['XAI_API_KEY'] || process.env['GROK_API_KEY']) && process.env['NODE_ENV'] !== 'test' ? undefined : (process.env['XAI_API_KEY'] || process.env['GROK_API_KEY']),
      perplexityApiKey: isTestOrDummyCredential(process.env['PERPLEXITY_API_KEY']) && process.env['NODE_ENV'] !== 'test' ? undefined : process.env['PERPLEXITY_API_KEY'],
      elevenlabsApiKey: isTestOrDummyCredential(process.env['ELEVENLABS_API_KEY']) && process.env['NODE_ENV'] !== 'test' ? undefined : process.env['ELEVENLABS_API_KEY'],
      googleCloudApiKey: isTestOrDummyCredential(process.env['GOOGLE_CLOUD_API_KEY'] || process.env['GOOGLE_TTS_API_KEY']) && process.env['NODE_ENV'] !== 'test' ? undefined : (process.env['GOOGLE_CLOUD_API_KEY'] || process.env['GOOGLE_TTS_API_KEY']),
      ollamaHost: process.env['OLLAMA_BASE_URL'] || process.env['OLLAMA_HOST'] || 'http://localhost:11434',
      ollamaBaseUrl: process.env['OLLAMA_BASE_URL'] || process.env['OLLAMA_HOST'] || 'http://localhost:11434',
      ollamaModel: process.env['OLLAMA_MODEL'] || 'llama3.2:latest'
    }
  };
}
