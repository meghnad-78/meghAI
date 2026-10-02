import type { MemoryEntry, MemoryLayer } from '@meghai/shared-types';
import { MeghAIDatabase } from '@meghai/database';
/**
 * Multi-Layer Memory & Behavioral Learning Engine (Section 23, 24, 25)
 */
export declare class MemoryManager {
    private db;
    private candidates;
    constructor(db: MeghAIDatabase);
    proposeCandidate(input: Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt' | 'userApproved' | 'locked' | 'pinned'>): MemoryEntry;
    promoteToDurable(candidateId: string, userApproved?: boolean): Promise<MemoryEntry>;
    getMemories(type?: MemoryLayer): Promise<MemoryEntry[]>;
    listCandidates(): MemoryEntry[];
    lockMemory(id: string, locked: boolean): Promise<boolean>;
    updateMemory(id: string, newContent: string): Promise<boolean>;
    retrieveRelevant(query: string, limit?: number): Promise<MemoryEntry[]>;
}
//# sourceMappingURL=index.d.ts.map