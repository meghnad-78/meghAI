import crypto from 'node:crypto';
import type { MemoryEntry, MemoryLayer } from '@meghai/shared-types';
import { MeghAIDatabase } from '@meghai/database';

/**
 * Multi-Layer Memory & Behavioral Learning Engine (Section 23, 24, 25)
 */
export class MemoryManager {
  private candidates: Map<string, MemoryEntry> = new Map();

  constructor(private db: MeghAIDatabase) {}

  public proposeCandidate(
    input: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'userApproved' | 'locked' | 'pinned'>
  ): MemoryEntry {
    const now = new Date().toISOString();
    const candidate: MemoryEntry = {
      ...input,
      id: `mem-cand-${crypto.randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      userApproved: false,
      locked: false,
      pinned: false
    };
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  public async promoteToDurable(candidateId: string, userApproved = true): Promise<MemoryEntry> {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) {
      throw new Error(`Candidate memory '${candidateId}' not found.`);
    }

    const durable: MemoryEntry = {
      ...candidate,
      id: `mem-${crypto.randomUUID()}`,
      userApproved,
      updatedAt: new Date().toISOString()
    };

    await this.db.createMemory(durable);
    this.candidates.delete(candidateId);
    return durable;
  }

  public async getMemories(type?: MemoryLayer): Promise<MemoryEntry[]> {
    return this.db.listMemories(type);
  }

  public listCandidates(): MemoryEntry[] {
    return Array.from(this.candidates.values());
  }

  public async lockMemory(id: string, locked: boolean): Promise<boolean> {
    const memories = await this.db.listMemories();
    const mem = memories.find(m => m.id === id);
    if (!mem) return false;
    mem.locked = locked;
    mem.updatedAt = new Date().toISOString();
    return true;
  }

  public async updateMemory(id: string, newContent: string): Promise<boolean> {
    const memories = await this.db.listMemories();
    const mem = memories.find(m => m.id === id);
    if (!mem) return false;
    if (mem.locked) {
      throw new Error(`Cannot modify memory '${id}': Memory is locked by user policy.`);
    }
    mem.content = newContent;
    mem.updatedAt = new Date().toISOString();
    return true;
  }

  public async retrieveRelevant(query: string, limit = 5): Promise<MemoryEntry[]> {
    const qLower = query.toLowerCase();
    const all = await this.db.listMemories();
    return all
      .filter(m => m.content.toLowerCase().includes(qLower) || m.entities.some((e: string) => e.toLowerCase().includes(qLower)))
      .slice(0, limit);
  }
}
