import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { MeghAIDatabase } from '../../packages/database/src/index.js';

describe('MeghAIDatabase Offline-First Integration', () => {
  let dbDir: string;
  let db: MeghAIDatabase;

  beforeEach(async () => {
    dbDir = path.join(os.tmpdir(), `meghai_db_test_${Date.now()}_${Math.random()}`);
    db = new MeghAIDatabase(dbDir);
    await db.init();
  });

  afterEach(async () => {
    try {
      await fs.rm(dbDir, { recursive: true, force: true });
    } catch {}
  });

  it('creates and lists personal notes with persistence', async () => {
    const note = await db.createNote({
      title: 'Architectural Blueprint',
      content: 'MeghAI Monorepo with strict domain boundaries and offline capability.',
      tags: ['architecture', 'p0']
    });

    expect(note.id).toBeDefined();
    expect(note.title).toBe('Architectural Blueprint');

    const fetched = await db.getNote(note.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Architectural Blueprint');

    const list = await db.listNotes({ tag: 'architecture' });
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe(note.id);
  });

  it('creates, filters, and manages personal tasks', async () => {
    const task = await db.createTask({
      title: 'Setup Windows Agent IPC',
      priority: 'HIGH',
      status: 'QUEUED'
    });

    expect(task.id).toBeDefined();
    expect(task.priority).toBe('HIGH');

    const queuedTasks = await db.listTasks('QUEUED');
    expect(queuedTasks.some(t => t.id === task.id)).toBe(true);
  });

  it('records audit logs with timestamp and status', async () => {
    await db.logAudit('USER_LOGIN', 'user1', 'session-123', 'SUCCESS');
    const logs = await db.listAuditLogs(10);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]?.action).toBe('USER_LOGIN');
  });
});
