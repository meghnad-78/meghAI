import crypto from 'node:crypto';
/**
 * Multi-Layer Memory & Behavioral Learning Engine (Section 23, 24, 25 & Phase 1.8)
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
            id: `mem-cand-${crypto.randomUUID()}`,
            userId: input.userId || 'default-user',
            type: input.layer,
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
    async promoteToDurable(candidateId, userApproved = true) {
        const candidate = this.candidates.get(candidateId);
        if (!candidate) {
            throw new Error(`Candidate memory '${candidateId}' not found.`);
        }
        const durable = {
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
    async deleteMemory(id) {
        const mem = await this.db.getMemory(id);
        if (!mem)
            return false;
        if (mem.locked) {
            throw new Error(`Cannot delete memory '${id}': Memory is locked by user policy.`);
        }
        return this.db.deleteMemory(id);
    }
    async forgetMemory(target) {
        const relevant = await this.retrieveRelevant(target, { limit: 1, minScore: 0.1, maxSensitivity: 'RESTRICTED' });
        const match = relevant[0];
        if (!match) {
            return { success: false, deletedCount: 0 };
        }
        if (match.locked) {
            throw new Error(`Cannot delete memory '${match.id}': Memory is locked by user policy.`);
        }
        const deleted = await this.db.deleteMemory(match.id);
        return { success: deleted, deletedCount: deleted ? 1 : 0, memory: match };
    }
    /**
     * Multi-Factor Relevance Scoring & Policy Filter
     * Supports: semantic/synonym keywords, user scope, workspace scope, sensitivity tier, expiration, and deduplication.
     */
    async retrieveRelevant(query, optionsOrLimit = 5, legacyMaxSensitivity = 'PERSONAL') {
        const options = typeof optionsOrLimit === 'number'
            ? { limit: optionsOrLimit, maxSensitivity: legacyMaxSensitivity }
            : optionsOrLimit;
        const limit = options.limit ?? 5;
        const maxSensitivity = options.maxSensitivity ?? 'PERSONAL';
        const minScore = options.minScore ?? 0.25;
        const cleanedQuery = query.toLowerCase().replace(/[^\w\s]/g, ' ');
        const rawTokens = cleanedQuery.split(/\s+/).filter(t => t.length > 1);
        const STOP_WORDS = new Set([
            'a', 'an', 'the', 'in', 'on', 'at', 'of', 'for', 'to', 'from', 'by', 'with', 'about', 'as',
            'into', 'like', 'through', 'after', 'over', 'between', 'out', 'against', 'during', 'without',
            'before', 'under', 'around', 'among', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should',
            'may', 'might', 'must', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
            'your', 'yours', 'yourself', 'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they',
            'them', 'their', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'how',
            'why', 'when', 'where', 'tell', 'know', 'remember'
        ]);
        const SYNONYM_MAP = {
            prefer: ['preference', 'preferred', 'favorite', 'favourite', 'like', 'likes'],
            preference: ['prefer', 'preferred', 'favorite', 'favourite', 'like', 'likes'],
            favorite: ['favourite', 'prefer', 'preference', 'best', 'top'],
            favourite: ['favorite', 'prefer', 'preference', 'best', 'top'],
            language: ['lang', 'programming', 'code'],
            programming: ['coding', 'language', 'code', 'software'],
            coding: ['programming', 'language', 'code'],
            style: ['manner', 'mode', 'response', 'concise', 'tone', 'brief'],
            response: ['responses', 'answers', 'style', 'reply', 'replies', 'concise'],
            responses: ['response', 'answers', 'style', 'reply', 'replies', 'concise'],
            concise: ['short', 'brief', 'responses', 'style', 'succinct']
        };
        const queryTerms = rawTokens.filter(t => !STOP_WORDS.has(t));
        if (queryTerms.length === 0 && rawTokens.length > 0) {
            queryTerms.push(...rawTokens);
        }
        const SENSITIVITY_RANK = {
            PUBLIC: 0,
            PERSONAL: 1,
            CONFIDENTIAL: 2,
            RESTRICTED: 3
        };
        const maxSensitivityLevel = SENSITIVITY_RANK[maxSensitivity] ?? 1;
        const allMemories = await this.db.listMemories();
        const now = Date.now();
        const scored = [];
        for (const mem of allMemories) {
            // 1. Guard against malformed records
            if (!mem || !mem.content || typeof mem.content !== 'string' || !mem.content.trim()) {
                continue;
            }
            // 2. Expiration check
            if (mem.expiresAt) {
                const expiry = new Date(mem.expiresAt).getTime();
                if (!isNaN(expiry) && expiry < now) {
                    continue;
                }
            }
            // 3. User scope filtering
            if (options.userId && mem.userId && mem.userId !== 'default-user' && mem.userId !== options.userId) {
                continue;
            }
            // 4. Sensitivity filtering
            const memSensitivity = mem.sensitivity || 'PERSONAL';
            const memLevel = SENSITIVITY_RANK[memSensitivity] ?? 1;
            if (memLevel > maxSensitivityLevel) {
                continue;
            }
            // 5. Keyword & semantic matching
            const memLower = mem.content.toLowerCase().replace(/[^\w\s]/g, ' ');
            const memTokens = new Set(memLower.split(/\s+/).filter(t => t.length > 1));
            let matchedCount = 0;
            for (const qTerm of queryTerms) {
                if (memTokens.has(qTerm) || memLower.includes(qTerm)) {
                    matchedCount++;
                    continue;
                }
                const synonyms = SYNONYM_MAP[qTerm] || [];
                for (const syn of synonyms) {
                    if (memTokens.has(syn) || memLower.includes(syn)) {
                        matchedCount++;
                        break;
                    }
                }
            }
            if (matchedCount === 0) {
                continue;
            }
            const matchRatio = matchedCount / (queryTerms.length || 1);
            const confidence = mem.confidence ?? 0.85;
            const importance = mem.importance || 1;
            let workspaceBoost = 0;
            if (options.workspaceId && mem.workspaceId === options.workspaceId) {
                workspaceBoost = 0.2;
            }
            const score = (matchRatio * 0.8 + workspaceBoost) * confidence * Math.min(1.5, importance);
            if (score >= minScore) {
                scored.push({ memory: mem, score });
            }
        }
        // Deduplicate identical content and sort by score descending
        const seenContent = new Set();
        const uniqueScored = [];
        scored.sort((a, b) => b.score - a.score);
        for (const item of scored) {
            const normalizedContent = item.memory.content.trim().toLowerCase();
            if (!seenContent.has(normalizedContent)) {
                seenContent.add(normalizedContent);
                uniqueScored.push(item);
            }
        }
        return uniqueScored.slice(0, limit).map(item => item.memory);
    }
}
/**
 * Context Engine (Section 20 & Phase 1.9)
 * Assembles selective, permission-aware system context with structured memory formatting
 */
export class ContextEngine {
    memoryManager;
    permissionBroker;
    constructor(memoryManager, permissionBroker) {
        this.memoryManager = memoryManager;
        this.permissionBroker = permissionBroker;
    }
    async assembleContext(options) {
        const permissionsApplied = [];
        // 1. App & Window Context (requires APPLICATIONS scope)
        let activeApp;
        let activeWindow;
        if (options.rawSystemState?.activeApp || options.rawSystemState?.activeWindow) {
            const isAllowed = this.permissionBroker ? this.permissionBroker.evaluate('APPLICATIONS').granted : true;
            if (isAllowed) {
                activeApp = options.rawSystemState?.activeApp;
                activeWindow = options.rawSystemState?.activeWindow;
                permissionsApplied.push('APPLICATIONS');
            }
        }
        // 2. Screen Context (requires SCREEN scope)
        let screenSummary;
        if (options.rawSystemState?.screenText) {
            const isAllowed = this.permissionBroker ? this.permissionBroker.evaluate('SCREEN').granted : true;
            if (isAllowed) {
                screenSummary = options.rawSystemState.screenText.slice(0, 1000);
                permissionsApplied.push('SCREEN');
            }
        }
        // 3. Relevant Memories with structured formatting
        const relevantMemories = await this.memoryManager.retrieveRelevant(options.query, {
            limit: 4,
            workspaceId: options.activeWorkspace
        });
        const recalled = relevantMemories.map(m => ({
            content: m.content,
            layer: m.type,
            confidence: m.confidence ?? 0.9
        }));
        const formattedMemoryContext = recalled.length > 0
            ? `RELEVANT USER MEMORY:\n${recalled.map(m => `- ${m.content}`).join('\n')}`
            : '';
        // 4. Token estimation
        const totalChars = (activeApp?.length || 0) +
            (activeWindow?.length || 0) +
            (screenSummary?.length || 0) +
            (options.activeWorkspace?.length || 0) +
            (options.currentTaskGoal?.length || 0) +
            formattedMemoryContext.length;
        const tokenEstimate = Math.ceil(totalChars / 4);
        return {
            activeApp,
            activeWindow,
            screenSummary,
            activeWorkspace: options.activeWorkspace,
            currentTaskGoal: options.currentTaskGoal,
            recalledMemories: recalled,
            formattedMemoryContext,
            knowledgeSnippets: [],
            recentActions: (options.recentActions || []).slice(-5),
            tokenEstimate,
            permissionsApplied
        };
    }
}
//# sourceMappingURL=index.js.map