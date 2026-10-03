import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { PersonalityManager, BUILTIN_PERSONALITIES } from '../../packages/ai-core/src/personality.js';
import type { PersonalityId } from '../../packages/shared-types/src/index.js';

describe('MeghAI AI Personality Engine & System Prompt Composer', () => {
  let tempDir: string;
  let manager: PersonalityManager;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `meghai-personality-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    await fs.mkdir(tempDir, { recursive: true });
    manager = new PersonalityManager(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Built-in Personality Profiles Catalog', () => {
    it('contains exactly 12 distinct, fully-specified personality profiles', () => {
      const profiles = manager.listProfiles();
      expect(profiles).toHaveLength(12);

      const expectedIds: PersonalityId[] = [
        'professional',
        'warm',
        'futuristic',
        'calm',
        'coding_partner',
        'research_analyst',
        'study_coach',
        'executive_assistant',
        'creative_partner',
        'motivator',
        'minimalist',
        'technical_expert'
      ];

      for (const expectedId of expectedIds) {
        const found = profiles.find(p => p.id === expectedId);
        expect(found, `Expected profile '${expectedId}' to exist`).toBeDefined();
        expect(found?.name).toBeTruthy();
        expect(found?.description).toBeTruthy();
        expect(found?.tone).toBeTruthy();
        expect(found?.verbosity).toBeTruthy();
        expect(found?.visualStyle).toBeTruthy();
        expect(found?.systemInstruction).toBeTruthy();
      }
    });

    it('defaults to futuristic companion profile', () => {
      const active = manager.getActiveProfile();
      expect(active.id).toBe('futuristic');
    });
  });

  describe('Profile Selection & Disk Persistence', () => {
    it('switches active profile via setPersonality', () => {
      const updated = manager.setPersonality('coding_partner');
      expect(updated.id).toBe('coding_partner');
      expect(manager.getActiveProfile().id).toBe('coding_partner');
      expect(manager.getActivePersonalityId()).toBe('coding_partner');
    });

    it('persists selected profile to disk and reloads across manager instances', () => {
      manager.setPersonality('calm');

      // Create new instance pointing to same storage
      const newManager = new PersonalityManager(tempDir);
      expect(newManager.getActiveProfile().id).toBe('calm');
      expect(newManager.getActiveProfile().name).toBe('Calm Assistant');
    });

    it('throws error when selecting an unknown personality id', () => {
      expect(() => manager.setPersonality('non_existent')).toThrow(/Unknown personality ID/);
    });
  });

  describe('Prompt Composition & Safety Invariance', () => {
    it('builds system prompt injecting profile instructions', () => {
      manager.setPersonality('minimalist');
      const prompt = manager.buildSystemPrompt();

      expect(prompt).toContain('MINIMALIST mode');
      expect(prompt).toContain('Maximum information density');
    });

    it('formats persistent memory context cleanly when provided', () => {
      const memoryText = 'User prefers TypeScript over JavaScript.\nUser works on Windows 11.';
      const prompt = manager.buildSystemPrompt(memoryText);

      expect(prompt).toContain('Verified user persistent memories:');
      expect(prompt).toContain('User prefers TypeScript over JavaScript.');
      expect(prompt).toContain('User works on Windows 11.');
    });

    it('preserves user custom instructions when configured', () => {
      manager.setCustomInstructions('Always answer in metric units.');
      const prompt = manager.buildSystemPrompt();

      expect(prompt).toContain('Additional user instruction: Always answer in metric units.');
    });

    it('preserves distinct instruction sets for each of the 12 profiles', () => {
      for (const profile of BUILTIN_PERSONALITIES) {
        manager.setPersonality(profile.id);
        const prompt = manager.buildSystemPrompt();
        expect(prompt).toContain(profile.systemInstruction);
      }
    });
  });
});
