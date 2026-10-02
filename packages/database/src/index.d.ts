import type { NoteEntry, TaskEntry, MemoryEntry, ModelMessage } from '@meghai/shared-types';
export interface ConversationEntry {
    id: string;
    userId: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: Array<ModelMessage & {
        id: string;
        timestamp: string;
    }>;
}
export interface AuditLogEntry {
    id: string;
    timestamp: string;
    action: string;
    actor: string;
    target?: string;
    status: string;
    details?: Record<string, unknown>;
}
export interface DatabaseState {
    version: number;
    notes: NoteEntry[];
    tasks: TaskEntry[];
    memories: MemoryEntry[];
    conversations: ConversationEntry[];
    auditLogs: AuditLogEntry[];
}
export type CreateNoteInput = Omit<NoteEntry, 'id' | 'createdAt' | 'updatedAt' | 'isArchived' | 'userId'> & {
    id?: string;
    userId?: string;
};
export type CreateTaskInput = Omit<TaskEntry, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'status'> & {
    id?: string;
    userId?: string;
    status?: import('@meghai/shared-types').TaskState;
};
/**
 * MeghAI Embedded & Offline-First Database Repository (Section 11, 121, 131, 206)
 * Provides instant zero-config persistence, vector similarity, and relational CRUD.
 */
export declare class MeghAIDatabase {
    private dataDir;
    private dbFilePath;
    private state;
    private isLoaded;
    private writeLock;
    constructor(customStorageDir?: string);
    init(): Promise<void>;
    private persistState;
    createNote(note: CreateNoteInput): Promise<NoteEntry>;
    getNote(id: string): Promise<NoteEntry | null>;
    listNotes(filter?: {
        tag?: string;
        query?: string;
        isArchived?: boolean;
    }): Promise<NoteEntry[]>;
    updateNote(id: string, updates: Partial<Pick<NoteEntry, 'title' | 'content' | 'tags' | 'isArchived'>>): Promise<NoteEntry | null>;
    deleteNote(id: string): Promise<boolean>;
    createTask(task: CreateTaskInput): Promise<TaskEntry>;
    listTasks(status?: string): Promise<TaskEntry[]>;
    createMemory(entry: MemoryEntry): Promise<MemoryEntry>;
    listMemories(type?: string): Promise<MemoryEntry[]>;
    createConversation(title: string, userId?: string): Promise<ConversationEntry>;
    addMessage(conversationId: string, message: ModelMessage): Promise<ModelMessage & {
        id: string;
        timestamp: string;
    }>;
    getConversation(conversationId: string): Promise<ConversationEntry | null>;
    logAudit(action: string, actor: string, target?: string, status?: string, details?: Record<string, unknown>): Promise<void>;
    listAuditLogs(limit?: number): Promise<AuditLogEntry[]>;
}
//# sourceMappingURL=index.d.ts.map