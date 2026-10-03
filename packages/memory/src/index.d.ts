import type { MemoryEntry, MemoryLayer, PermissionScope } from '@meghai/shared-types';
import { MeghAIDatabase } from '@meghai/database';
import type { PermissionBroker } from '@meghai/permissions';
export type ExtendedMemoryLayer = 'SEMANTIC' | 'EPISODIC' | 'PREFERENCE' | 'PROCEDURAL' | 'PROJECT' | 'TASK_CONTINUITY';
export type MemorySensitivity = 'PUBLIC' | 'PERSONAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type MemoryLifecycle = 'WORKING' | 'CANDIDATE' | 'DURABLE' | 'ARCHIVED';
export interface EnrichedMemoryEntry extends MemoryEntry {
    layer: ExtendedMemoryLayer;
    confidence: number;
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
    recalledMemories: Array<{
        content: string;
        layer: string;
        confidence: number;
    }>;
    formattedMemoryContext: string;
    knowledgeSnippets: string[];
    recentActions: string[];
    tokenEstimate: number;
    permissionsApplied: PermissionScope[];
}
/**
 * Multi-Layer Memory & Behavioral Learning Engine (Section 23, 24, 25 & Phase 1.8)
 */
export declare class MemoryManager {
    private db;
    private candidates;
    constructor(db: MeghAIDatabase);
    proposeCandidate(input: {
        content: string;
        layer: ExtendedMemoryLayer;
        provenance: string;
        confidence?: number;
        sensitivity?: MemorySensitivity;
        entities?: string[];
        tags?: string[];
        userId?: string;
    }): EnrichedMemoryEntry;
    promoteToDurable(candidateId: string, userApproved?: boolean): Promise<EnrichedMemoryEntry>;
    getMemories(type?: MemoryLayer): Promise<MemoryEntry[]>;
    listCandidates(): EnrichedMemoryEntry[];
    lockMemory(id: string, locked: boolean): Promise<boolean>;
    updateMemory(id: string, newContent: string): Promise<boolean>;
    deleteMemory(id: string): Promise<boolean>;
    forgetMemory(target: string): Promise<{
        success: boolean;
        deletedCount: number;
        memory?: MemoryEntry;
    }>;
    /**
     * Multi-Factor Relevance Scoring & Policy Filter
     * Supports: semantic/synonym keywords, user scope, workspace scope, sensitivity tier, expiration, and deduplication.
     */
    retrieveRelevant(query: string, optionsOrLimit?: number | {
        limit?: number;
        maxSensitivity?: MemorySensitivity;
        userId?: string;
        workspaceId?: string;
        minScore?: number;
    }, legacyMaxSensitivity?: MemorySensitivity): Promise<MemoryEntry[]>;
}
/**
 * Context Engine (Section 20 & Phase 1.9)
 * Assembles selective, permission-aware system context with structured memory formatting
 */
export declare class ContextEngine {
    private memoryManager;
    private permissionBroker?;
    constructor(memoryManager: MemoryManager, permissionBroker?: PermissionBroker | undefined);
    assembleContext(options: {
        query: string;
        activeWorkspace?: string;
        currentTaskGoal?: string;
        rawSystemState?: {
            activeApp?: string;
            activeWindow?: string;
            screenText?: string;
        };
        recentActions?: string[];
    }): Promise<AssembledSystemContext>;
}
//# sourceMappingURL=index.d.ts.map