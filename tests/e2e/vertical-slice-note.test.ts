import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { MeghAIServer } from '../../apps/api/src/server.js';

describe('Phase 0 Complete Vertical Slice: "Megh, create a note" (Section 166 & 171)', () => {
  let server: MeghAIServer;
  let testStorageDir: string;
  let testPort: number;

  beforeAll(async () => {
    testStorageDir = path.join(os.tmpdir(), `meghai_vslice_${Date.now()}`);
    server = new MeghAIServer(testStorageDir);
    testPort = await server.start(4899);
  });

  afterAll(async () => {
    await server.stop();
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {}
  });

  it('executes full vertical slice: Natural Language Request -> Intent -> Permission -> Tool -> Database -> Verification -> Timeline', async () => {
    const rawUserInput = 'Megh, create a note titled Project Alpha with content Architecture finalized.';

    // 1. Process Request via Server
    const response = await server.processUserRequest(rawUserInput);

    // 2. Validate Outcome
    expect(response.status).toBe('COMPLETED');
    expect(response.verificationStatus).toBe('VERIFIED');
    expect(response.reply).toContain("Note 'Project Alpha' has been successfully created");

    // 3. Verify Database Persistence directly in storage
    const notes = await server.db.listNotes();
    const createdNote = notes.find(n => n.title === 'Project Alpha');
    expect(createdNote).toBeDefined();
    expect(createdNote?.content).toBe('Architecture finalized.');

    // 4. Verify Action Timeline Recorded All Events
    const correlationId = response.timelineCorrelationId as string;
    expect(correlationId).toBeDefined();

    const timeline = server.eventBus.getTimeline(20, correlationId);
    const eventTypes = timeline.map(e => e.type);

    expect(eventTypes).toContain('USER_INPUT_RECEIVED');
    expect(eventTypes).toContain('LANGUAGE_DETECTED');
    expect(eventTypes).toContain('INTENT_CLASSIFIED');
    expect(eventTypes).toContain('TOOL_REQUESTED');
    expect(eventTypes).toContain('VERIFICATION_STARTED');
    expect(eventTypes).toContain('VERIFICATION_COMPLETED');
    expect(eventTypes).toContain('TASK_COMPLETED');
  });

  it('processes application control with tool execution and verification', async () => {
    const response = await server.processUserRequest('Hey Megh, open Calculator');
    expect(response.status).toBe('COMPLETED');
    expect(response.reply).toContain("application 'calc'");
  });

  it('halts execution when Emergency Kill Switch is triggered', async () => {
    // Trigger kill switch
    await fetch(`http://localhost:${testPort}/api/v1/system/kill`, { method: 'POST' });

    // Subsequent tool executions must be cancelled
    const response = await server.processUserRequest('Megh, create a note titled Blocked Note with content fail');
    expect(response.status).toBe('FAILED');

    // Reset kill switch
    await fetch(`http://localhost:${testPort}/api/v1/system/reset-kill`, { method: 'POST' });
  });
});
