import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import { LocalOllamaProvider } from '@meghai/model-router';

describe('LocalOllamaProvider (Offline LLM Adapter)', () => {
  let mockServer: http.Server | undefined;

  afterEach(async () => {
    if (mockServer) {
      await new Promise<void>(resolve => mockServer!.close(() => resolve()));
      mockServer = undefined;
    }
  });

  const createMockOllama = (handler: http.RequestListener): Promise<string> => {
    return new Promise(resolve => {
      mockServer = http.createServer(handler);
      mockServer.listen(0, '127.0.0.1', () => {
        const addr = mockServer!.address() as any;
        resolve(`http://127.0.0.1:${addr.port}`);
      });
    });
  };

  it('successfully completes chat request using native /api/chat with genuine model text and token accounting', async () => {
    const host = await createMockOllama((req, res) => {
      if (req.url === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
          const parsed = JSON.parse(body);
          expect(parsed.model).toBe('llama3.2:latest');
          expect(parsed.messages).toHaveLength(1);
          expect(parsed.messages[0].content).toBe('What is 25 multiplied by 8?');
          expect(parsed.stream).toBe(false);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            model: 'llama3.2:latest',
            created_at: '2026-10-02T18:00:00Z',
            message: {
              role: 'assistant',
              content: '25 multiplied by 8 is 200.'
            },
            done: true,
            prompt_eval_count: 14,
            eval_count: 9
          }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const provider = new LocalOllamaProvider(host, 'llama3.2:latest');
    const response = await provider.complete({
      messages: [{ role: 'user', content: 'What is 25 multiplied by 8?' }]
    });

    expect(response.content).toBe('25 multiplied by 8 is 200.');
    expect(response.providerId).toBe('local-ollama');
    expect(response.modelId).toBe('llama3.2:latest');
    expect(response.tokensUsed?.promptTokens).toBe(14);
    expect(response.tokensUsed?.completionTokens).toBe(9);
    expect(response.tokensUsed?.totalTokens).toBe(23);
    expect(response.finishReason).toBe('stop');
    expect(response.latencyMs).toBeGreaterThanOrEqual(0);

    // CRITICAL: Must NEVER return the placeholder fallback string
    expect(response.content).not.toContain('[MeghAI Local Offline Intelligence]');
  });

  it('falls back to /api/generate if /api/chat returns 404 (legacy Ollama daemon)', async () => {
    const host = await createMockOllama((req, res) => {
      if (req.url === '/api/chat') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 page not found');
        return;
      }
      if (req.url === '/api/generate') {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            response: 'Legacy generation response',
            prompt_eval_count: 5,
            eval_count: 10
          }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const provider = new LocalOllamaProvider(host, 'llama3.2:latest');
    const response = await provider.complete({
      messages: [{ role: 'user', content: 'Hello' }]
    });

    expect(response.content).toBe('Legacy generation response');
    expect(response.tokensUsed?.totalTokens).toBe(15);
    expect(response.content).not.toContain('[MeghAI Local Offline Intelligence]');
  });

  it('throws LOCAL_MODEL_NOT_FOUND when model is missing from daemon', async () => {
    const host = await createMockOllama((req, res) => {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "model 'non-existent-model' not found, try pulling it first" }));
    });

    const provider = new LocalOllamaProvider(host, 'non-existent-model');
    await expect(provider.complete({
      messages: [{ role: 'user', content: 'Hello' }]
    })).rejects.toThrow(/LOCAL_MODEL_NOT_FOUND/);
  });

  it('throws LOCAL_MODEL_EMPTY when Ollama returns an empty string', async () => {
    const host = await createMockOllama((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: { role: 'assistant', content: '   ' },
        prompt_eval_count: 0,
        eval_count: 0
      }));
    });

    const provider = new LocalOllamaProvider(host, 'llama3.2:latest');
    await expect(provider.complete({
      messages: [{ role: 'user', content: 'Hello' }]
    })).rejects.toThrow(/LOCAL_MODEL_EMPTY/);
  });

  it('throws LOCAL_MODEL_UNAVAILABLE when daemon connection is refused', async () => {
    // Pick an unused local port
    const provider = new LocalOllamaProvider('http://127.0.0.1:59999', 'llama3.2:latest');
    await expect(provider.complete({
      messages: [{ role: 'user', content: 'Hello' }]
    })).rejects.toThrow(/LOCAL_MODEL_UNAVAILABLE/);
  });

  it('verifies provider health check when online vs offline', async () => {
    const host = await createMockOllama((req, res) => {
      if (req.url === '/api/tags') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ models: [{ name: 'llama3.2:latest' }] }));
        return;
      }
      res.writeHead(404);
      res.end();
    });

    const onlineProvider = new LocalOllamaProvider(host);
    const healthOnline = await onlineProvider.checkHealth();
    expect(healthOnline.available).toBe(true);
    expect(healthOnline.isConfigured).toBe(true);

    const offlineProvider = new LocalOllamaProvider('http://127.0.0.1:59999');
    const healthOffline = await offlineProvider.checkHealth();
    expect(healthOffline.available).toBe(false);
    expect(healthOffline.message).toBeDefined();
  });
});
