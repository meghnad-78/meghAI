import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ModelRouter, normalizeProviderId } from '../../packages/model-router/src/index.js';
import { ModelSettingsManager, saveStoredModelSettings, loadStoredModelSettings } from '../../packages/config/src/index.js';
import type { IModelProvider, ModelRequest } from '../../packages/model-router/src/index.js';

describe('Model Selection Flow, Explicit Routing & Persistence (REQ-041)', () => {
  let tempDir: string;
  let testSettingsPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meghai-model-test-'));
    testSettingsPath = path.join(tempDir, 'model-settings.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('1. Canonical Provider IDs & Normalization', () => {
    it('normalizes various aliases to canonical IDs', () => {
      expect(normalizeProviderId('local-ollama')).toBe('local-ollama');
      expect(normalizeProviderId('ollama')).toBe('local-ollama');
      expect(normalizeProviderId('local')).toBe('local-ollama');
      expect(normalizeProviderId('localollama')).toBe('local-ollama');
      expect(normalizeProviderId('local-ollama-model')).toBe('local-ollama');

      expect(normalizeProviderId('gemini')).toBe('gemini');
      expect(normalizeProviderId('google')).toBe('gemini');

      expect(normalizeProviderId('openai')).toBe('openai');
      expect(normalizeProviderId('anthropic')).toBe('anthropic');
      expect(normalizeProviderId('claude')).toBe('anthropic');
      expect(normalizeProviderId('deepseek')).toBe('deepseek');
      expect(normalizeProviderId('perplexity')).toBe('perplexity');
      expect(normalizeProviderId('auto')).toBe('auto');
      expect(normalizeProviderId(undefined)).toBeUndefined();
    });
  });

  describe('2. Explicit Provider vs AUTO Routing Rules', () => {
    it('routes explicit local-ollama to LocalOllamaProvider with zero fallback to Gemini or OpenAI', async () => {
      const router = new ModelRouter();

      const geminiSpy = vi.fn().mockRejectedValue(new Error('Gemini quota error'));
      const openaiSpy = vi.fn().mockRejectedValue(new Error('OpenAI credit error'));
      const ollamaSpy = vi.fn().mockResolvedValue({
        content: 'Ollama local response',
        providerId: 'local-ollama',
        modelId: 'llama3.2:latest',
        latencyMs: 150
      });

      router.registerProvider({
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: () => true,
        getModels: () => [{ id: 'gemini-3.8-flash', providerId: 'gemini', name: 'Gemini', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 20, isConfigured: true }),
        complete: geminiSpy
      } as any);

      router.registerProvider({
        id: 'openai',
        name: 'OpenAI',
        isConfigured: () => true,
        getModels: () => [{ id: 'gpt-4o-mini', providerId: 'openai', name: 'OpenAI', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 30, isConfigured: true }),
        complete: openaiSpy
      } as any);

      router.registerProvider({
        id: 'local-ollama',
        name: 'Local Ollama',
        isConfigured: () => true,
        getModels: () => [{ id: 'llama3.2:latest', providerId: 'local-ollama', name: 'Llama 3.2', isLocal: true, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 10, isConfigured: true }),
        complete: ollamaSpy
      } as any);

      const decision = await router.route({
        messages: [{ role: 'user', content: 'Hello' }],
        providerId: 'local-ollama'
      }, { allowExplicitFallback: false });

      expect(decision.selectedProvider).toBe('local-ollama');
      expect(decision.fallbackChain).toEqual([]);

      const response = await router.completeWithFallback({
        messages: [{ role: 'user', content: 'Hello' }],
        providerId: 'local-ollama'
      }, { allowExplicitFallback: false });

      expect(ollamaSpy).toHaveBeenCalledTimes(1);
      expect(geminiSpy).not.toHaveBeenCalled();
      expect(openaiSpy).not.toHaveBeenCalled();
      expect(response.actualProvider).toBe('local-ollama');
      expect(response.requestedProvider).toBe('local-ollama');
      expect(response.fallbackOccurred).toBe(false);
      expect(response.content).toBe('Ollama local response');
    });

    it('when explicit local-ollama fails, throws Ollama failure and NEVER calls Gemini or OpenAI', async () => {
      const router = new ModelRouter();

      const geminiSpy = vi.fn().mockResolvedValue({ content: 'Gemini leak', providerId: 'gemini', modelId: 'flash' });
      const openaiSpy = vi.fn().mockResolvedValue({ content: 'OpenAI leak', providerId: 'openai', modelId: 'gpt-4o' });
      const ollamaSpy = vi.fn().mockRejectedValue(new Error('Local Ollama daemon connection refused on :11434'));

      router.registerProvider({
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: () => true,
        getModels: () => [{ id: 'gemini-3.8-flash', providerId: 'gemini', name: 'Gemini', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 20, isConfigured: true }),
        complete: geminiSpy
      } as any);

      router.registerProvider({
        id: 'openai',
        name: 'OpenAI',
        isConfigured: () => true,
        getModels: () => [{ id: 'gpt-4o-mini', providerId: 'openai', name: 'OpenAI', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 30, isConfigured: true }),
        complete: openaiSpy
      } as any);

      router.registerProvider({
        id: 'local-ollama',
        name: 'Local Ollama',
        isConfigured: () => true,
        getModels: () => [{ id: 'llama3.2:latest', providerId: 'local-ollama', name: 'Llama 3.2', isLocal: true, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 10, isConfigured: true }),
        complete: ollamaSpy
      } as any);

      await expect(router.completeWithFallback({
        messages: [{ role: 'user', content: 'Hello' }],
        providerId: 'local-ollama'
      }, { allowExplicitFallback: false })).rejects.toThrow('Local Ollama daemon connection refused on :11434');

      expect(ollamaSpy).toHaveBeenCalledTimes(1);
      expect(geminiSpy).not.toHaveBeenCalled();
      expect(openaiSpy).not.toHaveBeenCalled();
    });

    it('routes explicit openai to OpenAI only without attempting Gemini first', async () => {
      const router = new ModelRouter();

      const geminiSpy = vi.fn();
      const openaiSpy = vi.fn().mockResolvedValue({
        content: 'OpenAI direct response',
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        latencyMs: 120
      });

      router.registerProvider({
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: () => true,
        getModels: () => [{ id: 'gemini-3.8-flash', providerId: 'gemini', name: 'Gemini', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 20, isConfigured: true }),
        complete: geminiSpy
      } as any);

      router.registerProvider({
        id: 'openai',
        name: 'OpenAI',
        isConfigured: () => true,
        getModels: () => [{ id: 'gpt-4o-mini', providerId: 'openai', name: 'OpenAI', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 30, isConfigured: true }),
        complete: openaiSpy
      } as any);

      const res = await router.completeWithFallback({
        messages: [{ role: 'user', content: 'Hello' }],
        providerId: 'openai'
      }, { allowExplicitFallback: false });

      expect(openaiSpy).toHaveBeenCalledTimes(1);
      expect(geminiSpy).not.toHaveBeenCalled();
      expect(res.actualProvider).toBe('openai');
      expect(res.requestedProvider).toBe('openai');
    });

    it('routes explicit gemini to Gemini only without attempting OpenAI first', async () => {
      const router = new ModelRouter();

      const openaiSpy = vi.fn();
      const geminiSpy = vi.fn().mockResolvedValue({
        content: 'Gemini direct response',
        providerId: 'gemini',
        modelId: 'gemini-3.8-flash',
        latencyMs: 90
      });

      router.registerProvider({
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: () => true,
        getModels: () => [{ id: 'gemini-3.8-flash', providerId: 'gemini', name: 'Gemini', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 20, isConfigured: true }),
        complete: geminiSpy
      } as any);

      router.registerProvider({
        id: 'openai',
        name: 'OpenAI',
        isConfigured: () => true,
        getModels: () => [{ id: 'gpt-4o-mini', providerId: 'openai', name: 'OpenAI', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 30, isConfigured: true }),
        complete: openaiSpy
      } as any);

      const res = await router.completeWithFallback({
        messages: [{ role: 'user', content: 'Hello' }],
        providerId: 'gemini'
      }, { allowExplicitFallback: false });

      expect(geminiSpy).toHaveBeenCalledTimes(1);
      expect(openaiSpy).not.toHaveBeenCalled();
      expect(res.actualProvider).toBe('gemini');
      expect(res.requestedProvider).toBe('gemini');
    });

    it('AUTO mode uses multi-provider routing and fallback chain when primary fails', async () => {
      const router = new ModelRouter();

      const geminiSpy = vi.fn().mockRejectedValue(new Error('Gemini 429 quota exhausted'));
      const openaiSpy = vi.fn().mockResolvedValue({
        content: 'OpenAI fallback response in AUTO mode',
        providerId: 'openai',
        modelId: 'gpt-4o-mini',
        latencyMs: 110
      });

      router.registerProvider({
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: () => true,
        getModels: () => [{ id: 'gemini-3.8-flash', providerId: 'gemini', name: 'Gemini', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 20, isConfigured: true }),
        complete: geminiSpy
      } as any);

      router.registerProvider({
        id: 'openai',
        name: 'OpenAI',
        isConfigured: () => true,
        getModels: () => [{ id: 'gpt-4o-mini', providerId: 'openai', name: 'OpenAI', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 30, isConfigured: true }),
        complete: openaiSpy
      } as any);

      const res = await router.completeWithFallback({
        messages: [{ role: 'user', content: 'Hello' }],
        providerId: undefined
      });

      expect(geminiSpy).toHaveBeenCalledTimes(1);
      expect(openaiSpy).toHaveBeenCalledTimes(1);
      expect(res.fallbackOccurred).toBe(true);
      expect(res.actualProvider).toBe('openai');
      expect(res.requestedProvider).toBe('auto');
    });
  });

  describe('3. Model Settings Persistence & Restart Survival', () => {
    it('persists selectedProvider and selectedModel to disk and reloads accurately', () => {
      const mgr1 = new ModelSettingsManager(testSettingsPath);
      expect(mgr1.getSettings().selectedProvider).toBe('auto');

      mgr1.updateSettings({
        selectedProvider: 'local-ollama',
        selectedModel: 'llama3.2:latest',
        allowExplicitFallback: false
      });

      // Verify file exists on disk
      expect(fs.existsSync(testSettingsPath)).toBe(true);

      // Create new instance representing application restart
      const mgr2 = new ModelSettingsManager(testSettingsPath);
      const reloaded = mgr2.getSettings();

      expect(reloaded.selectedProvider).toBe('local-ollama');
      expect(reloaded.selectedModel).toBe('llama3.2:latest');
      expect(reloaded.allowExplicitFallback).toBe(false);
    });

    it('survives updates to OpenAI and Gemini selections', () => {
      saveStoredModelSettings({ selectedProvider: 'openai', selectedModel: 'gpt-4o' }, testSettingsPath);
      let loaded = loadStoredModelSettings(testSettingsPath);
      expect(loaded.selectedProvider).toBe('openai');
      expect(loaded.selectedModel).toBe('gpt-4o');

      saveStoredModelSettings({ selectedProvider: 'gemini', selectedModel: 'gemini-3.8-flash' }, testSettingsPath);
      loaded = loadStoredModelSettings(testSettingsPath);
      expect(loaded.selectedProvider).toBe('gemini');
      expect(loaded.selectedModel).toBe('gemini-3.8-flash');
    });

    it('immediately reflects external disk updates without process restart', () => {
      const mgr = new ModelSettingsManager(testSettingsPath);
      expect(mgr.getSettings().selectedProvider).toBe('auto');

      // External write to disk
      fs.writeFileSync(testSettingsPath, JSON.stringify({
        selectedProvider: 'local-ollama',
        selectedModel: 'llama3.2:latest',
        allowExplicitFallback: false
      }));

      // In-flight read immediately picks up disk change
      const fresh = mgr.getSettings();
      expect(fresh.selectedProvider).toBe('local-ollama');
      expect(fresh.selectedModel).toBe('llama3.2:latest');
    });
  });

  describe('4. Real UI Typed & Voice Pipeline Integration Flow', () => {
    it('reproduces real UI typed flow: sends explicit local-ollama with zero cloud cascade', async () => {
      const settingsMgr = new ModelSettingsManager(testSettingsPath);
      settingsMgr.updateSettings({ selectedProvider: 'local-ollama', selectedModel: 'llama3.2:latest' });

      const router = new ModelRouter();
      const geminiSpy = vi.fn().mockRejectedValue(new Error('HTTP 429 quota exhausted'));
      const openaiSpy = vi.fn().mockRejectedValue(new Error('HTTP 429 insufficient quota'));
      const ollamaSpy = vi.fn().mockResolvedValue({
        content: 'Ollama typed answer',
        providerId: 'local-ollama',
        modelId: 'llama3.2:latest',
        latencyMs: 120
      });

      router.registerProvider({
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: () => true,
        getModels: () => [{ id: 'gemini-3.8-flash', providerId: 'gemini', name: 'Gemini', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 20, isConfigured: true }),
        complete: geminiSpy
      } as any);

      router.registerProvider({
        id: 'openai',
        name: 'OpenAI',
        isConfigured: () => true,
        getModels: () => [{ id: 'gpt-4o-mini', providerId: 'openai', name: 'OpenAI', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 30, isConfigured: true }),
        complete: openaiSpy
      } as any);

      router.registerProvider({
        id: 'local-ollama',
        name: 'Local Ollama',
        isConfigured: () => true,
        getModels: () => [{ id: 'llama3.2:latest', providerId: 'local-ollama', name: 'Llama 3.2', isLocal: true, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 10, isConfigured: true }),
        complete: ollamaSpy
      } as any);

      // UI Composer submits with providerId: 'local-ollama'
      const uiPayload = {
        text: 'Hello',
        providerId: settingsMgr.getSettings().selectedProvider,
        modelId: settingsMgr.getSettings().selectedModel
      };

      const canonical = normalizeProviderId(uiPayload.providerId);
      const explicitProvider = canonical && canonical !== 'auto' ? canonical : undefined;

      const decision = await router.route({
        messages: [{ role: 'user', content: uiPayload.text }],
        providerId: explicitProvider,
        modelId: uiPayload.modelId
      }, { allowExplicitFallback: false });

      expect(decision.selectedProvider).toBe('local-ollama');
      expect(decision.fallbackChain).toEqual([]);

      const result = await router.completeWithFallback({
        messages: [{ role: 'user', content: uiPayload.text }],
        providerId: explicitProvider,
        modelId: uiPayload.modelId
      }, { allowExplicitFallback: false });

      expect(ollamaSpy).toHaveBeenCalledTimes(1);
      expect(geminiSpy).not.toHaveBeenCalled();
      expect(openaiSpy).not.toHaveBeenCalled();
      expect(result.actualProvider).toBe('local-ollama');
      expect(result.requestedProvider).toBe('local-ollama');
      expect(result.fallbackOccurred).toBe(false);
    });

    it('reproduces real voice flow: onCommand dynamically resolves local-ollama with zero cloud cascade', async () => {
      const settingsMgr = new ModelSettingsManager(testSettingsPath);
      settingsMgr.updateSettings({ selectedProvider: 'local-ollama', selectedModel: 'llama3.2:latest' });

      const router = new ModelRouter();
      const geminiSpy = vi.fn().mockRejectedValue(new Error('HTTP 429 quota exhausted'));
      const openaiSpy = vi.fn().mockRejectedValue(new Error('HTTP 429 insufficient quota'));
      const ollamaSpy = vi.fn().mockResolvedValue({
        content: 'I am doing well, thank you!',
        providerId: 'local-ollama',
        modelId: 'llama3.2:latest',
        latencyMs: 140
      });

      router.registerProvider({
        id: 'gemini',
        name: 'Google Gemini',
        isConfigured: () => true,
        getModels: () => [{ id: 'gemini-3.8-flash', providerId: 'gemini', name: 'Gemini', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 20, isConfigured: true }),
        complete: geminiSpy
      } as any);

      router.registerProvider({
        id: 'openai',
        name: 'OpenAI',
        isConfigured: () => true,
        getModels: () => [{ id: 'gpt-4o-mini', providerId: 'openai', name: 'OpenAI', isLocal: false, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 30, isConfigured: true }),
        complete: openaiSpy
      } as any);

      router.registerProvider({
        id: 'local-ollama',
        name: 'Local Ollama',
        isConfigured: () => true,
        getModels: () => [{ id: 'llama3.2:latest', providerId: 'local-ollama', name: 'Llama 3.2', isLocal: true, costPer1kInputTokensUSD: 0, costPer1kOutputTokensUSD: 0, capabilities: {} as any }],
        checkHealth: async () => ({ available: true, latencyMs: 10, isConfigured: true }),
        complete: ollamaSpy
      } as any);

      // Voice command arrives at onCommand:
      // Reads current settings dynamically:
      const currentModelSettings = settingsMgr.getSettings();
      expect(currentModelSettings.selectedProvider).toBe('local-ollama');

      const voiceMeta = {
        voiceSessionId: 'vs-test-123',
        commandId: 'cmd-test-456',
        source: 'VOICE' as const,
        providerId: currentModelSettings.selectedProvider,
        modelId: currentModelSettings.selectedModel
      };

      const canonical = normalizeProviderId(voiceMeta.providerId);
      const explicitProvider = canonical && canonical !== 'auto' ? canonical : undefined;

      const decision = await router.route({
        messages: [{ role: 'user', content: 'How are you?' }],
        providerId: explicitProvider,
        modelId: voiceMeta.modelId
      }, { allowExplicitFallback: false });

      expect(decision.selectedProvider).toBe('local-ollama');
      expect(decision.fallbackChain).toEqual([]);

      const result = await router.completeWithFallback({
        messages: [{ role: 'user', content: 'How are you?' }],
        providerId: explicitProvider,
        modelId: voiceMeta.modelId
      }, { allowExplicitFallback: false });

      expect(ollamaSpy).toHaveBeenCalledTimes(1);
      expect(geminiSpy).not.toHaveBeenCalled();
      expect(openaiSpy).not.toHaveBeenCalled();
      expect(result.actualProvider).toBe('local-ollama');
      expect(result.requestedProvider).toBe('local-ollama');
      expect(result.fallbackOccurred).toBe(false);
      expect(result.content).toBe('I am doing well, thank you!');
    });
  });
});
