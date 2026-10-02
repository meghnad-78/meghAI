import crypto from 'node:crypto';
import type { MemoryEntry, MemoryLayer, PermissionScope } from '@meghai/shared-types';
import { MeghAIDatabase } from '@meghai/database';
import type { PermissionBroker } from '@meghai/permissions';

export type ExtendedMemoryLayer =
  | 'SEMANTIC'
  | 'EPISODIC'
  | 'PREFERENCE'
  | 'PROCEDURAL'
  | 'PROJECT'
  | 'TASK_CONTINUITY';

export type MemorySensitivity = 'PUBLIC' | 'PERSONAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type MemoryLifecycle = 'WORKING' | 'CANDIDATE' | 'DURABLE' | 'ARCHIVED';

export interface EnrichedMemoryEntry extends MemoryEntry {
  layer: ExtendedMemoryLayer;
  confidence: number; // 0.0 to 1.0
  sensitivity: MemorySensitivity;
  lifecycle: MemoryLifecycle;
  provenance: string;
  tags?: string[];
  accessCount: number;
  lastAccessedAt?: string;
}

export interface AssembledSystemContext {
  activeApp?: string;
  activeWindow?: string;
  screenSummary?: string;
  activeWorkspace?: string;
  currentTaskGoal?: string;
  recalledMemories: Array<{ content: string; layer: string; confidence: number }>;
  knowledgeSnippets: string[];
  recentActions: string[];
  tokenEstimate: number;
  permissionsApplied: PermissionScope[];
}

/**
 * Multi-Layer Memory & Behavioral Learning Engine (Section 23, 24, 25 & Phase 1.8)
 */
export class MemoryManager {
  private candidates: Map<string, EnrichedMemoryEntry> = new Map();

  constructor(private db: MeghAIDatabase) {}

  public proposeCandidate(
    input: {
      content: string;
      layer: ExtendedMemoryLayer;
      provenance: string;
      confidence?: number;
      sensitivity?: MemorySensitivity;
      entities?: string[];
      tags?: string[];
      userId?: string;
    }
  ): EnrichedMemoryEntry {
    const now = new Date().toISOString();
    const candidate: EnrichedMemoryEntry = {
      id: `mem-cand-${crypto.randomUUID()}`,
      userId: input.userId || 'default-user',
      type: input.layer as any,
      layer: input.layer,
      content: input.content,
      source: input.provenance,
      importance: 1,
      entities: input.entities || [],
      tags: input.tags || [],
      confidence: input.confidence ?? 0.85,
      sensitivity: input.sensitivity || 'PERSONAL',
      lifecycle: 'CANDIDATE',
      provenance: input.provenance,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
      userApproved: false,
      locked: false,
      pinned: false
    };
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  public async promoteToDurable(candidateId: string, userApproved = true): Promise<EnrichedMemoryEntry> {
    const candidate = this.candidates.get(candidateId);
    if (!candidate) {
      throw new Error(`Candidate memory '${candidateId}' not found.`);
    }

    const durable: EnrichedMemoryEntry = {
      ...candidate,
      id: `mem-${crypto.randomUUID()}`,
      lifecycle: 'DURABLE',
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

  public listCandidates(): EnrichedMemoryEntry[] {
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

  /**
   * Relevance scoring: combines keyword match + confidence + access recency
   */
  public async retrieveRelevant(query: string, limit = 5, maxSensitivity: MemorySensitivity = 'PERSONAL'): Promise<MemoryEntry[]> {
    const qLower = query.toLowerCase();
    const terms = qLower.split(/\s+/).filter(t => t.length > 2);
    const all = await this.db.listMemories();

    const scored = all.map(m => {
      const lower = m.content.toLowerCase();
      let matchCount = 0;
      for (const t of terms) {
        if (lower.includes(t)) matchCount++;
      }
      const score = (matchCount / (terms.length || 1)) * ((m as any).confidence || 0.8);
      return { memory: m, score };
    });

    return scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.memory);
  }
}

/**
 * Context Engine (Section 20 & Phase 1.9)
 * Assembles selective, permission-aware system context
 */
export class ContextEngine {
  constructor(
    private memoryManager: MemoryManager,
    private permissionBroker?: PermissionBroker
  ) {}

  public async assembleContext(options: {
    query: string;
    activeWorkspace?: string;
    currentTaskGoal?: string;
    rawSystemState?: {
      activeApp?: string;
      activeWindow?: string;
      screenText?: string;
    };
    recentActions?: string[];
  }): Promise<AssembledSystemContext> {
    const permissionsApplied: PermissionScope[] = [];

    // 1. App & Window Context (requires APPLICATIONS scope)
    let activeApp: string | undefined;
    let activeWindow: string | undefined;
    if (options.rawSystemState?.activeApp || options.rawSystemState?.activeWindow) {
      const isAllowed = this.permissionBroker ? this.permissionBroker.evaluate('APPLICATIONS').granted : true;
      if (isAllowed) {
        activeApp = options.rawSystemState?.activeApp;
        activeWindow = options.rawSystemState?.activeWindow;
        permissionsApplied.push('APPLICATIONS');
      }
    }

    // 2. Screen Context (requires SCREEN scope)
    let screenSummary: string | undefined;
    if (options.rawSystemState?.screenText) {
      const isAllowed = this.permissionBroker ? this.permissionBroker.evaluate('SCREEN').granted : true;
      if (isAllowed) {
        screenSummary = options.rawSystemState.screenText.slice(0, 1000);
        permissionsApplied.push('SCREEN');
      }
    }

    // 3. Relevant Memories
    const relevantMemories = await this.memoryManager.retrieveRelevant(options.query, 4);
    const recalled = relevantMemories.map(m => ({
      content: m.content,
      layer: m.type,
      confidence: (m as any).confidence ?? 0.9
    }));

    // 4. Token estimation
    const totalChars =
      (activeApp?.length || 0) +
      (activeWindow?.length || 0) +
      (screenSummary?.length || 0) +
      (options.activeWorkspace?.length || 0) +
      (options.currentTaskGoal?.length || 0) +
      recalled.reduce((acc, m) => acc + m.content.length, 0);

    const tokenEstimate = Math.ceil(totalChars / 4);

    return {
      activeApp,
      activeWindow,
      screenSummary,
      activeWorkspace: options.activeWorkspace,
      currentTaskGoal: options.currentTaskGoal,
      recalledMemories: recalled,
      knowledgeSnippets: [],
      recentActions: (options.recentActions || []).slice(-5),
      tokenEstimate,
      permissionsApplied
    };
  }
}
