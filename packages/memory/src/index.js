import crypto from 'node:crypto';
/**
 * Multi-Layer Memory & Behavioral Learning Engine (Section 23, 24, 25)
 */
export class MemoryManager {
    db;
    candidates = new Map();
    constructor(db) {
        this.db = db;
    }
    proposeCandidate(input) {
        const now = new Date().toISOString();
        const candidate = {
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
    async promoteToDurable(candidateId, userApproved = true) {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) {
            throw new Error(`Candidate memory '${candidateId}' not found.`);
        }
        const durable = {
            ...candidate,
            id: `mem-${crypto.randomUUID()}`,
            userApproved,
            updatedAt: new Date().toISOString()
        };
        await this.db.createMemory(durable);
        this.candidates.delete(candidateId);
        return durable;
    }
    async getMemories(type) {
        return this.db.listMemories(type);
    }
    listCandidates() {
        return Array.from(this.candidates.values());
    }
    async lockMemory(id, locked) {
        const memories = await this.db.listMemories();
        const mem = memories.find(m => m.id === id);
        if (!mem)
            return false;
        mem.locked = locked;
        mem.updatedAt = new Date().toISOString();
        return true;
    }
    async updateMemory(id, newContent) {
        const memories = await this.db.listMemories();
        const mem = memories.find(m => m.id === id);
        if (!mem)
            return false;
        if (mem.locked) {
            throw new Error(`Cannot modify memory '${id}': Memory is locked by user policy.`);
        }
        mem.content = newContent;
        mem.updatedAt = new Date().toISOString();
        return true;
    }
    async retrieveRelevant(query, limit = 5) {
        const qLower = query.toLowerCase();
        const all = await this.db.listMemories();
        return all
            .filter(m => m.content.toLowerCase().includes(qLower) || m.entities.some((e) => e.toLowerCase().includes(qLower)))
            .slice(0, limit);
    }
}
//# sourceMappingURL=index.js.map