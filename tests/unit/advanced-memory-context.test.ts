import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryManager, ContextEngine } from '@meghai/memory';
import { MeghAIDatabase } from '@meghai/database';
import { PermissionBroker } from '@meghai/permissions';
import path from 'path';
import os from 'os';

describe('Advanced Memory & Context Engine', () => {
  let db: MeghAIDatabase;
  let memoryManager: MemoryManager;
  let permissions: PermissionBroker;
  let contextEngine: ContextEngine;

  beforeEach(() => {
    const testDir = path.join(os.tmpdir(), `meghai-test-mem-${Date.now()}-${Math.random()}`);
    db = new MeghAIDatabase(testDir);
    memoryManager = new MemoryManager(db);
    permissions = new PermissionBroker();
    contextEngine = new ContextEngine(memoryManager, permissions);
  });

  it('proposes candidate memories with confidence and provenance, and promotes to durable', async () => {
    const candidate = memoryManager.proposeCandidate({
      content: 'User prefers dark mode and JetBrains Mono font',
      layer: 'PREFERENCE',
      provenance: 'Settings configuration dialog',
      confidence: 0.98,
      sensitivity: 'PERSONAL',
      tags: ['ui', 'editor']
    });

    expect(candidate.id).toContain('mem-cand-');
    expect(candidate.lifecycle).toBe('CANDIDATE');
    expect(memoryManager.listCandidates().length).toBe(1);

    // Promote to durable
    const durable = await memoryManager.promoteToDurable(candidate.id);
    expect(durable.id).toContain('mem-');
    expect(durable.lifecycle).toBe('DURABLE');
    expect(memoryManager.listCandidates().length).toBe(0);

    const retrieved = await memoryManager.retrieveRelevant('dark mode font');
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].content).toContain('JetBrains Mono');
  });

  it('enforces locked memory security against modifications', async () => {
    const candidate = memoryManager.proposeCandidate({
      content: 'Core user identity: Meghnad Saha',
      layer: 'SEMANTIC',
      provenance: 'User registration',
      confidence: 1.0
    });
    const durable = await memoryManager.promoteToDurable(candidate.id);

    // Lock memory
    await memoryManager.lockMemory(durable.id, true);

    // Attempt modification -> must throw
    await expect(
      memoryManager.updateMemory(durable.id, 'New identity')
    ).rejects.toThrow(/Memory is locked by user policy/);
  });

  it('assembles permission-aware context respecting scope grants', async () => {
    // 1. Without SCREEN permission, screenText is omitted
    const unprivilegedContext = await contextEngine.assembleContext({
      query: 'explain this code',
      activeWorkspace: 'MeghAI Core',
      rawSystemState: {
        activeApp: 'Code.exe',
        activeWindow: 'VS Code',
        screenText: 'CRITICAL_ERROR_STACK_TRACE'
      }
    });

    // By default, APPLICATIONS is granted, but SCREEN requires explicit permission
    expect(unprivilegedContext.activeApp).toBe('Code.exe');
    expect(unprivilegedContext.screenSummary).toBeUndefined(); // Gated by SCREEN scope!

    // 2. Grant SCREEN permission
    permissions.grant('SCREEN', 'ALLOWED');
    const privilegedContext = await contextEngine.assembleContext({
      query: 'explain this code',
      activeWorkspace: 'MeghAI Core',
      rawSystemState: {
        activeApp: 'Code.exe',
        activeWindow: 'VS Code',
        screenText: 'CRITICAL_ERROR_STACK_TRACE'
      }
    });

    expect(privilegedContext.screenSummary).toBe('CRITICAL_ERROR_STACK_TRACE');
    expect(privilegedContext.permissionsApplied).toContain('SCREEN');
  });
});
