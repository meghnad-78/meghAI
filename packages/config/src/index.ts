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
    ollamaHost: string;
  };
}

export function loadConfig(): MeghAIConfig {
  const localAppData = process.env['LOCALAPPDATA'] || process.env['USERPROFILE'] || '.';
  const defaultStorage = path.join(localAppData, 'MeghAI', 'data');

  return {
    env: (process.env['NODE_ENV'] as any) || 'development',
    apiPort: parseInt(process.env['PORT'] || '4820', 10),
    agentPort: parseInt(process.env['AGENT_PORT'] || '4821', 10),
    desktopPort: parseInt(process.env['DESKTOP_PORT'] || '3000', 10),
    storageDir: process.env['MEGHAI_STORAGE_DIR'] || defaultStorage,
    privacyMode: (process.env['MEGHAI_PRIVACY_MODE'] as PrivacyMode) || 'BALANCED',
    costMode: (process.env['MEGHAI_COST_MODE'] as CostMode) || 'FREE_FIRST',
    providers: {
      geminiApiKey: process.env['GEMINI_API_KEY'],
      openaiApiKey: process.env['OPENAI_API_KEY'],
      anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
      deepseekApiKey: process.env['DEEPSEEK_API_KEY'],
      grokApiKey: process.env['XAI_API_KEY'],
      perplexityApiKey: process.env['PERPLEXITY_API_KEY'],
      ollamaHost: process.env['OLLAMA_HOST'] || 'http://127.0.0.1:11434'
    }
  };
}
