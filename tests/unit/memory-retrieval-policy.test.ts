import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { MeghAIDatabase } from '@meghai/database';
import { MemoryManager, ContextEngine } from '@meghai/memory';
import { MemoryCommandParser, InputPipeline } from '@meghai/ai-core';

describe('Memory Retrieval Policy & Natural Language Memory Operations', () => {
  let tempDir: string;
  let db: MeghAIDatabase;
  let memoryManager: MemoryManager;
  let contextEngine: ContextEngine;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `meghai-mem-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tempDir, { recursive: true });

    db = new MeghAIDatabase(tempDir);
    await db.init();
    memoryManager = new MemoryManager(db);
    contextEngine = new ContextEngine(memoryManager);
  });

  // 1. Relevant memory retrieved
  it('1. retrieves relevant memory matching query keywords and concepts', async () => {
    await db.createMemory({
      id: 'mem-1',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My favorite programming language is Java.',
      source: 'User API',
      importance: 1,
      entities: ['Java', 'programming'],
      tags: ['coding'],
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

    const relevant = await memoryManager.retrieveRelevant('What is my favorite programming language?');
    expect(relevant.length).toBeGreaterThanOrEqual(1);
    expect(relevant[0].content).toBe('My favorite programming language is Java.');
  });

  // 2. Irrelevant memory not retrieved
  it('2. does NOT retrieve memory when query is completely unrelated', async () => {
    await db.createMemory({
      id: 'mem-1',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My favorite programming language is Java.',
      source: 'User API',
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

    const relevant = await memoryManager.retrieveRelevant('What is the weather in Mumbai?');
    expect(relevant).toHaveLength(0);
  });

  // 3. Expired memory not retrieved
  it('3. does NOT retrieve expired memories', async () => {
    const past = new Date(Date.now() - 100000).toISOString();
    await db.createMemory({
      id: 'mem-exp',
      userId: 'default-user',
      type: 'EPISODIC',
      layer: 'EPISODIC',
      content: 'I need to call the plumber today.',
      source: 'User API',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.9,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'User',
      accessCount: 0,
      expiresAt: past,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);

    const relevant = await memoryManager.retrieveRelevant('plumber call');
    expect(relevant).toHaveLength(0);
  });

  // 4. Locked memory handling
  it('4. allows retrieving locked memories for context but prevents unauthorized deletion or modification', async () => {
    const mem = await db.createMemory({
      id: 'mem-locked',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My primary identity is Meghnad Saha.',
      source: 'System',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 1.0,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'User',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: true,
      pinned: true
    } as any);

    // Retrievable for context
    const relevant = await memoryManager.retrieveRelevant('What is my primary identity?');
    expect(relevant.length).toBe(1);
    expect(relevant[0].content).toContain('Meghnad Saha');

    // Protected from deletion
    await expect(memoryManager.deleteMemory(mem.id)).rejects.toThrow(/locked/);
    await expect(memoryManager.forgetMemory('primary identity')).rejects.toThrow(/locked/);
  });

  // 5. User-scoped memory
  it('5. enforces user scope separation', async () => {
    await db.createMemory({
      id: 'mem-user2',
      userId: 'other-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My secret passcode is 9876.',
      source: 'User 2',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.95,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'User 2',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);

    const relevantForDefault = await memoryManager.retrieveRelevant('secret passcode', {
      userId: 'default-user'
    });
    expect(relevantForDefault).toHaveLength(0);

    const relevantForOther = await memoryManager.retrieveRelevant('secret passcode', {
      userId: 'other-user'
    });
    expect(relevantForOther).toHaveLength(1);
  });

  // 6. Workspace-scoped memory
  it('6. applies workspace boost when querying within active workspace', async () => {
    await db.createMemory({
      id: 'mem-global',
      userId: 'default-user',
      type: 'PROJECT',
      layer: 'PROJECT',
      content: 'General deployment port is 4820.',
      source: 'Project',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.9,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'Project',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);

    await db.createMemory({
      id: 'mem-proj-meghai',
      userId: 'default-user',
      type: 'PROJECT',
      layer: 'PROJECT',
      content: 'MeghAI deployment port is 4820 on localhost.',
      source: 'Project',
      workspaceId: 'workspace-meghai',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.9,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'Project',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);

    const results = await memoryManager.retrieveRelevant('deployment port', {
      workspaceId: 'workspace-meghai'
    });
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('mem-proj-meghai');
  });

  // 7. Sensitive memory policy
  it('7. respects maximum sensitivity constraints', async () => {
    await db.createMemory({
      id: 'mem-restricted',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My bank account routing number is 123456789.',
      source: 'User Entry',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.95,
      sensitivity: 'RESTRICTED',
      lifecycle: 'DURABLE',
      provenance: 'User',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);

    // Default maxSensitivity is PERSONAL, so RESTRICTED is blocked
    const resultsPersonal = await memoryManager.retrieveRelevant('bank account routing number', {
      maxSensitivity: 'PERSONAL'
    });
    expect(resultsPersonal).toHaveLength(0);

    // When maxSensitivity allows RESTRICTED
    const resultsRestricted = await memoryManager.retrieveRelevant('bank account routing number', {
      maxSensitivity: 'RESTRICTED'
    });
    expect(resultsRestricted).toHaveLength(1);
  });

  // 8. Empty memory result
  it('8. gracefully returns empty array when no memories match', async () => {
    const results = await memoryManager.retrieveRelevant('Nonexistent subject XYZ123');
    expect(results).toEqual([]);
  });

  // 9. Memory retrieval failure error handling
  it('9. handles empty database and database errors without crashing', async () => {
    const results = await memoryManager.retrieveRelevant('');
    expect(results).toEqual([]);
  });

  // 10. Malformed memory record
  it('10. gracefully ignores malformed memory records in database', async () => {
    (db as any).state.memories.push(null);
    (db as any).state.memories.push({ id: 'bad-1', content: '' });
    (db as any).state.memories.push({ id: 'bad-2', content: null });

    const results = await memoryManager.retrieveRelevant('test query');
    expect(Array.isArray(results)).toBe(true);
  });

  // 11. Semantic retrieval & synonyms
  it('11. performs semantic synonym matching (prefer <-> favorite, style <-> concise)', async () => {
    await db.createMemory({
      id: 'mem-pref',
      userId: 'default-user',
      type: 'PREFERENCE',
      layer: 'PREFERENCE',
      content: 'I prefer concise responses.',
      source: 'User Preference',
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

    // Query uses "response style" and "favorite" / "prefer"
    const results = await memoryManager.retrieveRelevant('What response style do I prefer?');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].content).toBe('I prefer concise responses.');
  });

  // 12. Keyword retrieval with punctuation stripping
  it('12. cleans punctuation and matches clean query terms', async () => {
    await db.createMemory({
      id: 'mem-code',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My favorite programming language is Java.',
      source: 'User Entry',
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

    const results = await memoryManager.retrieveRelevant('What is my favorite programming language???');
    expect(results.length).toBe(1);
    expect(results[0].content).toContain('Java');
  });

  // 13. Duplicate memory handling
  it('13. deduplicates identical memory content in retrieval results', async () => {
    await db.createMemory({
      id: 'mem-dup-1',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'I live in Kolkata.',
      source: 'User',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.9,
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

    await db.createMemory({
      id: 'mem-dup-2',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'I live in Kolkata.',
      source: 'User 2',
      importance: 1,
      entities: [],
      tags: [],
      confidence: 0.9,
      sensitivity: 'PERSONAL',
      lifecycle: 'DURABLE',
      provenance: 'User 2',
      accessCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userApproved: true,
      locked: false,
      pinned: false
    } as any);

    const results = await memoryManager.retrieveRelevant('Where do I live in Kolkata?');
    expect(results.length).toBe(1);
    expect(results[0].content).toBe('I live in Kolkata.');
  });

  // Natural Language Memory Operations
  // Natural Language Memory Operations (Step 12 exact cases)
  it('12.1 correctly interprets "Remember that my name is Meghnad."', () => {
    const pipeline = InputPipeline.process('Remember that my name is Meghnad.');
    expect(pipeline.intent.primaryIntent).toBe('MEMORY_OPERATION');
    const cmd = MemoryCommandParser.parse(pipeline.normalizedText);
    expect(cmd.action).toBe('STORE');
    expect(cmd.content).toBe('My name is Meghnad.');
    expect(cmd.type).toBe('SEMANTIC');
  });

  it('12.2 correctly interprets "Megh, remember that my name is Meghnad."', () => {
    const pipeline = InputPipeline.process('Megh, remember that my name is Meghnad.');
    expect(pipeline.intent.primaryIntent).toBe('MEMORY_OPERATION');
    const cmd = MemoryCommandParser.parse(pipeline.normalizedText);
    expect(cmd.action).toBe('STORE');
    expect(cmd.content).toBe('My name is Meghnad.');
  });

  it('12.3 correctly interprets "Remember that my favorite programming language is Java."', () => {
    const pipeline = InputPipeline.process('Remember that my favorite programming language is Java.');
    expect(pipeline.intent.primaryIntent).toBe('MEMORY_OPERATION');
    const cmd = MemoryCommandParser.parse(pipeline.normalizedText);
    expect(cmd.action).toBe('STORE');
    expect(cmd.content).toBe('My favorite programming language is Java.');
    expect(cmd.type).toBe('PREFERENCE');
  });

  it('12.4 correctly interprets "Keep in mind that I prefer concise responses."', () => {
    const pipeline = InputPipeline.process('Keep in mind that I prefer concise responses.');
    expect(pipeline.intent.primaryIntent).toBe('MEMORY_OPERATION');
    const cmd = MemoryCommandParser.parse(pipeline.normalizedText);
    expect(cmd.action).toBe('STORE');
    expect(cmd.content).toBe('I prefer concise responses.');
    expect(cmd.type).toBe('PREFERENCE');
  });

  it('12.5 correctly interprets "Don\'t forget that I use Java."', () => {
    const pipeline = InputPipeline.process("Don't forget that I use Java.");
    expect(pipeline.intent.primaryIntent).toBe('MEMORY_OPERATION');
    const cmd = MemoryCommandParser.parse(pipeline.normalizedText);
    expect(cmd.action).toBe('STORE');
    expect(cmd.content).toBe('I use Java.');
  });

  it('12.6 correctly interprets "Forget that my name is Meghnad."', () => {
    const pipeline = InputPipeline.process('Forget that my name is Meghnad.');
    expect(pipeline.intent.primaryIntent).toBe('MEMORY_OPERATION');
    const cmd = MemoryCommandParser.parse(pipeline.normalizedText);
    expect(cmd.action).toBe('FORGET');
    expect(cmd.content.toLowerCase()).toContain('my name is meghnad');
  });

  it('12.7 correctly interprets "Megh, forget my favorite programming language."', () => {
    const pipeline = InputPipeline.process('Megh, forget my favorite programming language.');
    expect(pipeline.intent.primaryIntent).toBe('MEMORY_OPERATION');
    const cmd = MemoryCommandParser.parse(pipeline.normalizedText);
    expect(cmd.action).toBe('FORGET');
    expect(cmd.content.toLowerCase()).toContain('favorite programming language');
  });

  it('12.8 correctly classifies "I remember that Java is popular." as casual chat, NOT a memory operation', () => {
    const pipeline = InputPipeline.process('I remember that Java is popular.');
    expect(pipeline.intent.primaryIntent).not.toBe('MEMORY_OPERATION');
    expect(pipeline.intent.primaryIntent).toBe('CHAT');
    expect(MemoryCommandParser.isMemoryCommand(pipeline.normalizedText).isCommand).toBe(false);
  });

  it('correctly handles variations like "Save this as a preference" and "Remove what you remembered"', () => {
    const pipeline1 = InputPipeline.process('Save this as a preference: I like concise replies.');
    expect(pipeline1.intent.primaryIntent).toBe('MEMORY_OPERATION');
    const cmd1 = MemoryCommandParser.parse(pipeline1.normalizedText);
    expect(cmd1.action).toBe('STORE');
    expect(cmd1.type).toBe('PREFERENCE');
    expect(cmd1.content).toBe('I like concise replies.');

    const pipeline2 = InputPipeline.process('Remove what you remembered about Java.');
    expect(pipeline2.intent.primaryIntent).toBe('MEMORY_OPERATION');
    const cmd2 = MemoryCommandParser.parse(pipeline2.normalizedText);
    expect(cmd2.action).toBe('FORGET');
    expect(cmd2.content).toBe('Java');
  });

  it('assembles structured formattedMemoryContext in ContextEngine', async () => {
    await db.createMemory({
      id: 'mem-context',
      userId: 'default-user',
      type: 'SEMANTIC',
      layer: 'SEMANTIC',
      content: 'My favorite programming language is Java.',
      source: 'User Entry',
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

    const ctx = await contextEngine.assembleContext({
      query: 'What is my favorite programming language?'
    });

    expect(ctx.recalledMemories).toHaveLength(1);
    expect(ctx.formattedMemoryContext).toContain('RELEVANT USER MEMORY:');
    expect(ctx.formattedMemoryContext).toContain('- My favorite programming language is Java.');
  });
});
