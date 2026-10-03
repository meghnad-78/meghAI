import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { MeghAIServer } from '../../apps/api/src/server.js';

describe('MeghAI Phase 2 API Server Endpoints & Orchestration', () => {
  let server: MeghAIServer;
  let testPort: number;
  let tempDir: string;
  let baseUrl: string;

  beforeAll(async () => {
    tempDir = path.join(os.tmpdir(), `meghai-phase2-test-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    server = new MeghAIServer(tempDir);
    testPort = await server.start(0); // 0 lets OS assign an ephemeral available port
    baseUrl = `http://localhost:${testPort}`;
  });

  afterAll(async () => {
    await server.stop();
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  });

  it('GET /api/v1/health should report server status and version', async () => {
    const res = await fetch(`${baseUrl}/api/v1/health`);
    const data = await res.json() as any;
    expect(res.status).toBe(200);
    expect(data.status).toBe('HEALTHY');
    expect(data.version).toBe('0.1.0');
  });

  it('GET and POST /api/v1/memory should create candidates, promote to durable, and lock memories', async () => {
    // 1. Propose candidate memory
    const postRes = await fetch(`${baseUrl}/api/v1/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'User prefers dark mode and concise responses.',
        layer: 'PREFERENCE',
        provenance: 'User settings dialogue'
      })
    });
    expect(postRes.status).toBe(201);
    const candidate = await postRes.json() as any;
    expect(candidate.id).toBeDefined();
    expect(candidate.lifecycle).toBe('CANDIDATE');

    // 2. Promote to durable
    const promoteRes = await fetch(`${baseUrl}/api/v1/memory/promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidateId: candidate.id })
    });
    expect(promoteRes.status).toBe(200);
    const durable = await promoteRes.json() as any;
    expect(durable.lifecycle).toBe('DURABLE');

    // 3. Lock memory
    const lockRes = await fetch(`${baseUrl}/api/v1/memory/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: durable.id, locked: true })
    });
    expect(lockRes.status).toBe(200);
    const lockData = await lockRes.json() as any;
    expect(lockData.locked).toBe(true);

    // 4. Retrieve all memories
    const getRes = await fetch(`${baseUrl}/api/v1/memory`);
    const listData = await getRes.json() as any;
    expect(listData.memories.length).toBeGreaterThan(0);
  });

  it('GET and POST /api/v1/knowledge/graph should retrieve graph nodes and add entities', async () => {
    // 1. Get initial graph (seeded in constructor)
    const getRes = await fetch(`${baseUrl}/api/v1/knowledge/graph`);
    expect(getRes.status).toBe(200);
    const graph = await getRes.json() as any;
    expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
    expect(graph.edges.length).toBeGreaterThanOrEqual(2);

    // 2. Add new node
    const addRes = await fetch(`${baseUrl}/api/v1/knowledge/node`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'TOPIC',
        label: 'Agentic Operating Layer',
        properties: { domain: 'AI Systems' }
      })
    });
    expect(addRes.status).toBe(201);
    const node = await addRes.json() as any;
    expect(node.label).toBe('Agentic Operating Layer');
  });

  it('GET and POST /api/v1/voice/settings and /api/v1/voice/preview should manage voice parameters', async () => {
    // 1. Get catalog
    const catalogRes = await fetch(`${baseUrl}/api/v1/voice/catalog`);
    expect(catalogRes.status).toBe(200);
    const voices = await catalogRes.json() as any[];
    expect(voices.length).toBeGreaterThan(0);

    // 2. Update voice settings
    const updateRes = await fetch(`${baseUrl}/api/v1/voice/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        speechRate: 1.15,
        pitch: 1.0,
        personalityMode: 'WARM'
      })
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json() as any;
    expect(updated.speechRate).toBe(1.15);
    expect(updated.personalityMode).toBe('WARM');

    // 3. Preview voice
    const previewRes = await fetch(`${baseUrl}/api/v1/voice/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId: 'local-david', text: 'Voice testing.', play: false })
    });
    expect(previewRes.status).toBe(200);
    const previewData = await previewRes.json() as any;
    expect(previewData.status).toContain('SYNTHESIZED');
  }, 15000);

  it('GET /api/v1/routines and /api/v1/brief/daily should provide truthful scheduled routines', async () => {
    const routineRes = await fetch(`${baseUrl}/api/v1/routines`);
    expect(routineRes.status).toBe(200);
    const routineData = await routineRes.json() as any;
    expect(routineData.routines.length).toBeGreaterThanOrEqual(3);
    expect(routineData.budget).toBeDefined();

    const briefRes = await fetch(`${baseUrl}/api/v1/brief/daily`);
    expect(briefRes.status).toBe(200);
    const brief = await briefRes.json() as any;
    expect(brief.verificationStatus).toBe('VERIFIED');
    expect(brief.greeting).toBeDefined();
  });

  it('GET /api/v1/observability/stats and /api/v1/integrations should report metrics and connector statuses', async () => {
    const obsRes = await fetch(`${baseUrl}/api/v1/observability/stats`);
    expect(obsRes.status).toBe(200);
    const obsData = await obsRes.json() as any;
    expect(obsData.metrics).toBeDefined();

    const intRes = await fetch(`${baseUrl}/api/v1/integrations`);
    expect(intRes.status).toBe(200);
    const connectors = await intRes.json() as any[];
    expect(connectors.length).toBeGreaterThanOrEqual(5);
    expect(connectors.some(c => c.serviceId === 'gmail')).toBe(true);
  });

  it('POST /api/v1/input/process with "Megh, give me my daily brief" should return verified Daily Brief', async () => {
    const res = await fetch(`${baseUrl}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Megh, give me my daily brief' })
    });
    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.status).toBe('COMPLETED');
    expect(data.verificationStatus).toBe('VERIFIED');
    expect(data.reply).toContain('Action Items & Tasks:');
    expect(data.reply).toContain('Upcoming Schedule:');
    expect(data.reply).toContain('System Health:');
  });
});
