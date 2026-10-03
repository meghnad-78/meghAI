import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { MeghAIServer } from '../../apps/api/src/server.js';

describe('MeghAI Memory End-to-End Chat Integration', () => {
  let tempDir: string;
  let server: MeghAIServer;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `meghai-mem-chat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tempDir, { recursive: true });

    server = new MeghAIServer(tempDir);
    await server.start(0);

    // Mock local-ollama provider so the test runs fast and isolated without external daemon reliance
    server.modelRouter.registerProvider({
      id: 'local-ollama',
      name: 'Local Ollama Test Mock',
      isConfigured: () => true,
      getModels: () => [{
        id: 'llama3.2:latest',
        providerId: 'local-ollama',
        name: 'Llama 3.2 Mock',
        isLocal: true,
        costPer1kInputTokensUSD: 0,
        costPer1kOutputTokensUSD: 0,
        capabilities: {
          supportsText: true,
          supportsVision: false,
          supportsAudio: false,
          supportsFiles: true,
          supportsLongContext: false,
          supportsToolCalling: true,
          supportsStructuredOutput: true,
          supportsStreaming: true,
          supportsReasoning: false,
          supportsWebSearch: false,
          supportsEmbeddings: true,
          maxContextTokens: 131072
        }
      }],
      checkHealth: async () => ({ available: true, latencyMs: 5, isConfigured: true }),
      complete: async req => {
        const sysMsg = req.messages.find(m => m.role === 'system');
        const userMsg = req.messages.find(m => m.role === 'user');

        if (sysMsg && sysMsg.content.includes('Java')) {
          return {
            content: 'Your favorite programming language is Java.',
            providerId: 'local-ollama',
            modelId: 'llama3.2:latest',
            tokensUsed: { promptTokens: 30, completionTokens: 8, totalTokens: 38 },
            latencyMs: 5,
            finishReason: 'stop'
          };
        }

        if (sysMsg && sysMsg.content.includes('concise')) {
          return {
            content: 'You prefer concise responses.',
            providerId: 'local-ollama',
            modelId: 'llama3.2:latest',
            tokensUsed: { promptTokens: 30, completionTokens: 5, totalTokens: 35 },
            latencyMs: 5,
            finishReason: 'stop'
          };
        }

        return {
          content: `Standard response for: ${userMsg?.content}`,
          providerId: 'local-ollama',
          modelId: 'llama3.2:latest',
          tokensUsed: { promptTokens: 15, completionTokens: 10, totalTokens: 25 },
          latencyMs: 5,
          finishReason: 'stop'
        };
      }
    });
  });

  afterEach(async () => {
    await server.stop();
  });

  it('stores a memory through natural language and emits MEMORY_STORED event', async () => {
    const events: any[] = [];
    server.eventBus.subscribe('*', evt => events.push(evt));

    const res = await server.processUserRequest('Megh, remember that my favorite programming language is Java.');

    expect(res.status).toBe('COMPLETED');
    expect(res.reply).toContain("Got it. I've saved that your favorite programming language is Java.");

    // Check event bus
    const cmdDetected = events.find(e => e.type === 'MEMORY_COMMAND_DETECTED');
    expect(cmdDetected).toBeDefined();
    expect(cmdDetected.payload.action).toBe('STORE');

    const storedEvent = events.find(e => e.type === 'MEMORY_STORED');
    expect(storedEvent).toBeDefined();
    expect(storedEvent.payload.content).toContain('Java');

    // Verify in database
    const memories = await server.db.listMemories();
    expect(memories.some(m => m.content.includes('Java'))).toBe(true);
  });

  it('retrieves stored memory for relevant query, emits MEMORY_RETRIEVED, and injects into model context', async () => {
    // 1. Pre-seed memory in database
    await server.db.createMemory({
      id: 'mem-seed',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My favorite programming language is Java.',
      source: 'Direct User Command',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.95,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'User',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);

    const events: any[] = [];
    server.eventBus.subscribe('*', evt => events.push(evt));

    // 2. Query
    const res = await server.processUserRequest('What is my favorite programming language?');

    expect(res.status).toBe('COMPLETED');
    expect(res.reply).toContain('Java');

    // Verify Action Timeline events
    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('USER_INPUT_RECEIVED');
    expect(eventTypes).toContain('LANGUAGE_DETECTED');
    expect(eventTypes).toContain('INTENT_CLASSIFIED');
    expect(eventTypes).toContain('MEMORY_RETRIEVED');
    expect(eventTypes).toContain('MODEL_SELECTED');
    expect(eventTypes).toContain('MODEL_STARTED');
    expect(eventTypes).toContain('MODEL_COMPLETED');
    expect(eventTypes).toContain('TASK_COMPLETED');

    const memoryRetrievedEvent = events.find(e => e.type === 'MEMORY_RETRIEVED');
    expect(memoryRetrievedEvent.payload.count).toBeGreaterThanOrEqual(1);
  });

  it('does NOT emit MEMORY_RETRIEVED for generic unrelated queries', async () => {
    // Pre-seed unrelated memory
    await server.db.createMemory({
      id: 'mem-seed',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My favorite programming language is Java.',
      source: 'User',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.95,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'User',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);

    const events: any[] = [];
    server.eventBus.subscribe('*', evt => events.push(evt));

    await server.processUserRequest('What is 25 multiplied by 8?');

    const memoryRetrievedEvent = events.find(e => e.type === 'MEMORY_RETRIEVED');
    expect(memoryRetrievedEvent).toBeUndefined();
  });

  it('forgets a memory through natural language command and emits MEMORY_DELETED', async () => {
    // 1. Pre-seed memory
    await server.db.createMemory({
      id: 'mem-to-forget',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My favorite programming language is Java.',
      source: 'User',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.95,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'User',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);

    const events: any[] = [];
    server.eventBus.subscribe('*', evt => events.push(evt));

    // 2. Forget command
    const res = await server.processUserRequest('Forget that my favorite programming language is Java.');

    expect(res.status).toBe('COMPLETED');
    expect(res.reply).toContain("I've forgotten");

    const cmdDetected = events.find(e => e.type === 'MEMORY_COMMAND_DETECTED');
    expect(cmdDetected).toBeDefined();
    expect(cmdDetected.payload.action).toBe('FORGET');

    const deletedEvent = events.find(e => e.type === 'MEMORY_DELETED');
    expect(deletedEvent).toBeDefined();

    // Verify it is gone from store
    const memories = await server.db.listMemories();
    expect(memories.some(m => m.id === 'mem-to-forget')).toBe(false);
  });

  it('does NOT create a memory when user talks casually about memory ("I remember that...")', async () => {
    const events: any[] = [];
    server.eventBus.subscribe('*', evt => events.push(evt));

    const initialMemories = await server.db.listMemories();
    const res = await server.processUserRequest('I remember that Java is popular.');

    expect(res.status).toBe('COMPLETED');
    expect(events.some(e => e.type === 'MEMORY_COMMAND_DETECTED')).toBe(false);
    expect(events.some(e => e.type === 'MEMORY_STORED')).toBe(false);

    const updatedMemories = await server.db.listMemories();
    expect(updatedMemories.length).toBe(initialMemories.length);
  });

  it('prevents deleting locked memories via natural language and truthfully reports protection', async () => {
    await server.db.createMemory({
      id: 'mem-locked',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'Critical user identity information.',
      source: 'User',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 1.0,
      sensitivity: 'RESTRICTED',
      lifecycle: 'DURABLE',
      provenance: 'User',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: true,
      pinned: true
    } as any);

    const res = await server.processUserRequest('Forget critical user identity information.');
    expect(res.status).toBe('FAILED');
    expect(res.reply).toContain('locked by user policy');

    const mem = await server.db.getMemory('mem-locked');
    expect(mem).not.toBeNull();
  });
});

