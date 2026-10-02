/**
 * MeghAI Canonical Shared Types
 * Master Specification Domain Contracts
 */

// ---------------------------------------------------------------------------
// 1. AI State Machine (Section 42)
// ---------------------------------------------------------------------------
export type AIState =
  | 'SLEEPING'
  | 'READY'
  | 'LISTENING'
  | 'TRANSCRIBING'
  | 'UNDERSTANDING'
  | 'RETRIEVING'
  | 'PLANNING'
  | 'ROUTING'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'RESPONDING'
  | 'WAITING_FOR_CONFIRMATION'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// ---------------------------------------------------------------------------
// 2. Task State Machine (Section 41)
// ---------------------------------------------------------------------------
export type TaskState =
  | 'QUEUED'
  | 'PLANNING'
  | 'RUNNING'
  | 'WAITING'
  | 'WAITING_FOR_PERMISSION'
  | 'WAITING_FOR_CONFIRMATION'
  | 'RETRYING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'PARTIALLY_COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNVERIFIED';

// ---------------------------------------------------------------------------
// 3. Risk Engine (Section 58)
// ---------------------------------------------------------------------------
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskAssessment {
  level: RiskLevel;
  reasons: string[];
  requiresConfirmation: boolean;
  isDestructive: boolean;
  isExternalCommunication: boolean;
  impactScope: string;
  rollbackPossible: boolean;
}

// ---------------------------------------------------------------------------
// 4. Permissions (Section 57)
// ---------------------------------------------------------------------------
export type PermissionScope =
  | 'MICROPHONE'
  | 'CAMERA'
  | 'SCREEN'
  | 'FILESYSTEM'
  | 'BROWSER'
  | 'APPLICATIONS'
  | 'CLIPBOARD'
  | 'POWERSHELL'
  | 'CMD'
  | 'EMAIL'
  | 'CALENDAR'
  | 'MESSAGING'
  | 'CONTACTS'
  | 'NOTIFICATIONS'
  | 'CLOUD_PROVIDERS'
  | 'KNOWLEDGE_SOURCES';

export type PermissionMode =
  | 'DENIED'
  | 'ASK'
  | 'ALLOWED'
  | 'ALLOWED_WITH_CONFIRMATION'
  | 'LOCAL_ONLY'
  | 'SELECTED_FOLDERS'
  | 'SELECTED_APPS';

export interface PermissionGrant {
  id: string;
  scope: PermissionScope;
  mode: PermissionMode;
  allowedTargets?: string[]; // e.g. allowed folder paths or app names
  deniedTargets?: string[];
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 5. Input Pipeline & Multimodal Content (Section 14 & 15)
// ---------------------------------------------------------------------------
export type ModalityType =
  | 'TEXT'
  | 'VOICE'
  | 'IMAGE'
  | 'SCREENSHOT'
  | 'FILE'
  | 'AUDIO'
  | 'VIDEO'
  | 'CURRENT_SCREEN'
  | 'CLIPBOARD';

export interface InputContent {
  id: string;
  type: ModalityType;
  mimeType: string;
  source: 'USER_INPUT' | 'WAKE_WORD' | 'CLIPBOARD' | 'FILE_DROP' | 'SCREEN_CAPTURE';
  text?: string;
  binaryReference?: string; // Path or buffer reference
  metadata?: Record<string, unknown>;
  language?: string; // Detected language (en, hi, bn, hr, bh, etc.)
  timestamp: string;
  privacyScope: 'LOCAL_ONLY' | 'CLOUD_ALLOWED';
}

// ---------------------------------------------------------------------------
// 6. Intent & Entities (Section 18 & 19)
// ---------------------------------------------------------------------------
export type IntentFamily =
  | 'CHAT'
  | 'QUESTION'
  | 'EXPLANATION'
  | 'GENERATION'
  | 'SEARCH'
  | 'DEEP_RESEARCH'
  | 'FACT_CHECK'
  | 'COMPARISON'
  | 'FILE_SEARCH'
  | 'FILE_OPERATION'
  | 'COMMUNICATION'
  | 'CALENDAR'
  | 'REMINDER'
  | 'NOTE'
  | 'TASK'
  | 'SYSTEM_CONTROL'
  | 'APPLICATION_CONTROL'
  | 'BROWSER_AUTOMATION'
  | 'SCREEN_ANALYSIS'
  | 'CODE_TASK'
  | 'DATA_ANALYSIS'
  | 'MEMORY_OPERATION'
  | 'ROUTINE_OPERATION'
  | 'SETTINGS'
  | 'MULTI_STEP_AGENT_TASK'
  | 'HYBRID_TASK'
  | 'OTHER';

export interface Entity {
  id: string;
  type: 'PERSON' | 'FILE' | 'FOLDER' | 'PROJECT' | 'APPLICATION' | 'WEBSITE' | 'TASK' | 'EVENT' | 'MESSAGE' | 'EMAIL' | 'DATE_TIME' | 'GENERIC';
  value: string;
  normalizedValue?: string;
  confidence: number;
  aliases?: string[];
  metadata?: Record<string, unknown>;
}

export interface IntentClassification {
  primaryIntent: IntentFamily;
  secondaryIntents?: IntentFamily[];
  confidence: number;
  entities: Entity[];
  ambiguousEntities: string[];
  isCompound: boolean;
  requiresClarification: boolean;
  clarificationPrompt?: string;
}

// ---------------------------------------------------------------------------
// 7. Model Providers & Router (Section 31 - 36)
// ---------------------------------------------------------------------------
export type ModelProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'grok'
  | 'perplexity'
  | 'local-ollama';

export type RoutingMode =
  | 'AUTO'
  | 'FAST'
  | 'BALANCED'
  | 'QUALITY'
  | 'PRIVATE'
  | 'LOCAL_ONLY'
  | 'MULTI_MODEL';

export type CostMode = 'FREE_FIRST' | 'BALANCED' | 'QUALITY_FIRST' | 'CUSTOM';
export type PrivacyMode = 'LOCAL_ONLY' | 'PRIVATE' | 'BALANCED' | 'CLOUD_ENABLED';

export interface ModelCapability {
  supportsText: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsFiles: boolean;
  supportsLongContext: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsStreaming: boolean;
  supportsReasoning: boolean;
  supportsWebSearch: boolean;
  supportsEmbeddings: boolean;
  maxContextTokens: number;
}

export interface ModelDescriptor {
  id: string;
  providerId: ModelProviderId;
  name: string;
  capabilities: ModelCapability;
  isLocal: boolean;
  costPer1kInputTokensUSD: number;
  costPer1kOutputTokensUSD: number;
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface ModelRequest {
  modelId?: string;
  providerId?: ModelProviderId;
  messages: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  stream?: boolean;
  privacyScope?: PrivacyMode;
}

export interface ModelResponse {
  content: string;
  providerId: ModelProviderId;
  modelId: string;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  latencyMs: number;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
}

export interface ModelStreamChunk {
  delta: string;
  toolCallDelta?: {
    id?: string;
    name?: string;
    argumentsDelta?: string;
  };
  done: boolean;
}

// ---------------------------------------------------------------------------
// 8. Tool Registry & Runtime (Section 43 & 44)
// ---------------------------------------------------------------------------
export type ToolCategory =
  | 'WINDOWS'
  | 'FILES'
  | 'BROWSER'
  | 'WEB'
  | 'EMAIL'
  | 'MESSAGING'
  | 'CALENDAR'
  | 'NOTES'
  | 'TASKS'
  | 'SYSTEM'
  | 'CODE'
  | 'DATABASE'
  | 'MEMORY'
  | 'KNOWLEDGE'
  | 'RAG'
  | 'VISION'
  | 'VOICE';

export type VerificationStrategy =
  | 'FILE_HASH_AND_EXISTS'
  | 'PROCESS_RUNNING'
  | 'WINDOW_ACTIVE'
  | 'DATABASE_RECORD'
  | 'API_CONFIRMATION'
  | 'HTTP_STATUS'
  | 'NONE';

export interface ToolDefinition {
  name: string;
  version: string;
  description: string;
  category: ToolCategory;
  inputSchema: Record<string, unknown>; // JSON Schema
  outputSchema?: Record<string, unknown>;
  requiredPermissions: PermissionScope[];
  riskLevel: RiskLevel;
  allowedAgents: string[];
  timeoutMs: number;
  verificationStrategy: VerificationStrategy;
  rollbackStrategy?: 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE';
}

export interface ToolCallRequest {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  agentId?: string;
  taskId?: string;
  userConfirmed?: boolean;
}

export interface ToolExecutionResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  output?: unknown;
  error?: string;
  executionTimeMs: number;
  verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
  verificationDetails?: string;
  rollbackData?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 9. Memory System (Section 23, 24, 25)
// ---------------------------------------------------------------------------
export type MemoryLayer =
  | 'SHORT_TERM'
  | 'EPISODIC'
  | 'SEMANTIC'
  | 'PREFERENCE'
  | 'PROCEDURAL'
  | 'ROUTINE'
  | 'PROJECT'
  | 'TASK_CONTINUITY'
  | 'CANDIDATE';

export interface MemoryEntry {
  id: string;
  userId: string;
  type: MemoryLayer;
  content: string;
  source: string;
  confidence: number;
  importance: number;
  sensitivity: 'PUBLIC' | 'PERSONAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  expiration?: string | null;
  userApproved: boolean;
  locked: boolean;
  pinned: boolean;
  provenance: string;
  embeddingReference?: string;
  entities: string[];
}

// ---------------------------------------------------------------------------
// 10. Notes, Tasks & Workspaces (Section 81, 90, 91)
// ---------------------------------------------------------------------------
export interface NoteEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  projectId?: string;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export interface TaskEntry {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskState;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate?: string;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceEntry {
  id: string;
  userId: string;
  name: string;
  objective: string;
  context: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 11. Event Architecture (Section 134)
// ---------------------------------------------------------------------------
export type EventType =
  | 'USER_INPUT_RECEIVED'
  | 'WAKE_DETECTED'
  | 'STT_STARTED'
  | 'STT_COMPLETED'
  | 'LANGUAGE_DETECTED'
  | 'INTENT_CLASSIFIED'
  | 'CONTEXT_RETRIEVED'
  | 'MEMORY_RETRIEVED'
  | 'PLAN_CREATED'
  | 'MODEL_SELECTED'
  | 'MODEL_STARTED'
  | 'MODEL_CHUNK'
  | 'MODEL_COMPLETED'
  | 'TOOL_REQUESTED'
  | 'TOOL_APPROVAL_REQUIRED'
  | 'TOOL_STARTED'
  | 'TOOL_COMPLETED'
  | 'VERIFICATION_STARTED'
  | 'VERIFICATION_COMPLETED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'TASK_CANCELLED'
  | 'KILL_SWITCH_ACTIVATED'
  | 'MEMORY_CANDIDATE_CREATED'
  | 'MEMORY_PROMOTED'
  | 'ROUTINE_TRIGGERED'
  | 'AI_STATE_CHANGED';

export interface MeghAIEvent<T = unknown> {
  id: string;
  type: EventType;
  timestamp: string;
  payload: T;
  correlationId?: string;
  source: string;
}

// ---------------------------------------------------------------------------
// 12. Personality & Voice (Section 69, 70, 98)
// ---------------------------------------------------------------------------
export type PersonalityMode =
  | 'PROFESSIONAL'
  | 'WARM'
  | 'FUTURISTIC_COMPANION'
  | 'CALM_ASSISTANT';

export interface VoiceProfile {
  id: string;
  name: string;
  provider: 'local' | 'elevenlabs' | 'google' | 'azure' | 'openai';
  language: string;
  accent?: string;
  gender: 'female' | 'male' | 'neutral';
  sampleAudioUrl?: string;
  isAvailable: boolean;
}
