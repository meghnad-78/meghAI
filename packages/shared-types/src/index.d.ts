/**
 * MeghAI Canonical Shared Types
 * Master Specification Domain Contracts
 */
export type AIState = 'SLEEPING' | 'READY' | 'LISTENING' | 'TRANSCRIBING' | 'UNDERSTANDING' | 'RETRIEVING' | 'PLANNING' | 'ROUTING' | 'EXECUTING' | 'VERIFYING' | 'RESPONDING' | 'SPEAKING' | 'WAITING_FOR_CONFIRMATION' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type TaskState = 'QUEUED' | 'PLANNING' | 'RUNNING' | 'WAITING' | 'WAITING_FOR_PERMISSION' | 'WAITING_FOR_CONFIRMATION' | 'RETRYING' | 'VERIFYING' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'FAILED' | 'CANCELLED' | 'UNVERIFIED';
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
export type PermissionScope = 'MICROPHONE' | 'CAMERA' | 'SCREEN' | 'FILESYSTEM' | 'BROWSER' | 'APPLICATIONS' | 'CLIPBOARD' | 'POWERSHELL' | 'CMD' | 'EMAIL' | 'CALENDAR' | 'MESSAGING' | 'CONTACTS' | 'NOTIFICATIONS' | 'CLOUD_PROVIDERS' | 'KNOWLEDGE_SOURCES';
export type PermissionMode = 'DENIED' | 'ASK' | 'ALLOWED' | 'ALLOWED_WITH_CONFIRMATION' | 'LOCAL_ONLY' | 'SELECTED_FOLDERS' | 'SELECTED_APPS';
export interface PermissionGrant {
    id: string;
    scope: PermissionScope;
    mode: PermissionMode;
    allowedTargets?: string[];
    deniedTargets?: string[];
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
}
export type ModalityType = 'TEXT' | 'VOICE' | 'IMAGE' | 'SCREENSHOT' | 'FILE' | 'AUDIO' | 'VIDEO' | 'CURRENT_SCREEN' | 'CLIPBOARD';
export interface InputContent {
    id: string;
    type: ModalityType;
    mimeType: string;
    source: 'USER_INPUT' | 'WAKE_WORD' | 'CLIPBOARD' | 'FILE_DROP' | 'SCREEN_CAPTURE';
    text?: string;
    binaryReference?: string;
    metadata?: Record<string, unknown>;
    language?: string;
    timestamp: string;
    privacyScope: 'LOCAL_ONLY' | 'CLOUD_ALLOWED';
}
export type IntentFamily = 'CHAT' | 'QUESTION' | 'EXPLANATION' | 'GENERATION' | 'SEARCH' | 'DEEP_RESEARCH' | 'FACT_CHECK' | 'COMPARISON' | 'FILE_SEARCH' | 'FILE_OPERATION' | 'COMMUNICATION' | 'CALENDAR' | 'REMINDER' | 'NOTE' | 'TASK' | 'SYSTEM_CONTROL' | 'APPLICATION_CONTROL' | 'BROWSER_AUTOMATION' | 'SCREEN_ANALYSIS' | 'CODE_TASK' | 'DATA_ANALYSIS' | 'MEMORY_OPERATION' | 'ROUTINE_OPERATION' | 'SETTINGS' | 'MULTI_STEP_AGENT_TASK' | 'HYBRID_TASK' | 'OTHER';
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
export type ModelProviderId = 'gemini' | 'openai' | 'anthropic' | 'deepseek' | 'grok' | 'perplexity' | 'local-ollama';
export type RoutingMode = 'AUTO' | 'FAST' | 'BALANCED' | 'QUALITY' | 'PRIVATE' | 'LOCAL_ONLY' | 'MULTI_MODEL';
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
    fallbackOccurred?: boolean;
    fallbackReason?: string;
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
export type ToolCategory = 'WINDOWS' | 'FILES' | 'BROWSER' | 'WEB' | 'EMAIL' | 'MESSAGING' | 'CALENDAR' | 'NOTES' | 'TASKS' | 'SYSTEM' | 'CODE' | 'DATABASE' | 'MEMORY' | 'KNOWLEDGE' | 'RAG' | 'VISION' | 'VOICE';
export type VerificationStrategy = 'FILE_HASH_AND_EXISTS' | 'PROCESS_RUNNING' | 'WINDOW_ACTIVE' | 'DATABASE_RECORD' | 'API_CONFIRMATION' | 'HTTP_STATUS' | 'NONE';
export interface ToolDefinition {
    name: string;
    version: string;
    description: string;
    category: ToolCategory;
    inputSchema: Record<string, unknown>;
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
export type MemoryLayer = 'SHORT_TERM' | 'EPISODIC' | 'SEMANTIC' | 'PREFERENCE' | 'PROCEDURAL' | 'ROUTINE' | 'PROJECT' | 'TASK_CONTINUITY' | 'CANDIDATE';
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
export type EventType = 'USER_INPUT_RECEIVED' | 'WAKE_DETECTED' | 'MIC_STARTING' | 'MIC_READY' | 'MIC_LISTENING' | 'MIC_LEVEL' | 'MIC_STOPPING' | 'MIC_OFF' | 'MIC_ERROR' | 'MIC_DEVICE_UNAVAILABLE' | 'VAD_SPEECH_STARTED' | 'VAD_SPEECH_ENDED' | 'VOICE_INPUT_STATE_CHANGED' | 'VOICE_COMMAND_RECEIVED' | 'VOICE_TRANSCRIBING' | 'TRANSCRIPT_PARTIAL' | 'TRANSCRIPT_FINAL' | 'STT_STARTED' | 'STT_COMPLETED' | 'TTS_REQUESTED' | 'TTS_STARTED' | 'TTS_AUDIO_READY' | 'AUDIO_PLAYBACK_STARTED' | 'SPEAKING' | 'AUDIO_PLAYBACK_COMPLETED' | 'TTS_COMPLETED' | 'TTS_FAILED' | 'AUDIO_PLAYBACK_FAILED' | 'TTS_INTERRUPTED' | 'AUDIO_CUE_STARTED' | 'AUDIO_CUE_COMPLETED' | 'AUDIO_STATE_CHANGED' | 'VOICE_ERROR' | 'INTERRUPTED' | 'LANGUAGE_DETECTED' | 'INTENT_CLASSIFIED' | 'CONTEXT_RETRIEVED' | 'MEMORY_RETRIEVED' | 'PLAN_CREATED' | 'MODEL_SELECTED' | 'MODEL_STARTED' | 'MODEL_CHUNK' | 'MODEL_FALLBACK' | 'MODEL_COMPLETED' | 'TOOL_REQUESTED' | 'TOOL_APPROVAL_REQUIRED' | 'TOOL_STARTED' | 'TOOL_COMPLETED' | 'VERIFICATION_STARTED' | 'VERIFICATION_COMPLETED' | 'TASK_COMPLETED' | 'TASK_FAILED' | 'TASK_CANCELLED' | 'KILL_SWITCH_ACTIVATED' | 'MEMORY_COMMAND_DETECTED' | 'MEMORY_CANDIDATE_CREATED' | 'MEMORY_PROMOTED' | 'MEMORY_STORED' | 'MEMORY_DELETED' | 'ROUTINE_TRIGGERED' | 'AI_STATE_CHANGED';
export interface MeghAIEvent<T = unknown> {
    id: string;
    type: EventType;
    timestamp: string;
    payload: T;
    correlationId?: string;
    source: string;
}
export type PersonalityMode = 'PROFESSIONAL' | 'WARM' | 'FUTURISTIC_COMPANION' | 'CALM_ASSISTANT';
export type VoiceProviderId = 'windows-sapi' | 'windows-onecore' | 'google-cloud' | 'elevenlabs' | 'openai' | 'local-offline' | 'local' | 'google';
export interface VoiceCapability {
    speedSupport: boolean;
    pitchSupport: boolean;
    emotionSupport: boolean;
    styleSupport: boolean;
    streamingSupport: boolean;
}
export interface VoiceProfile {
    id: string;
    name: string;
    displayName?: string;
    provider: VoiceProviderId;
    providerVoiceId?: string;
    language: string;
    locale?: string;
    accent?: string;
    gender: 'female' | 'male' | 'neutral';
    description?: string;
    style?: string;
    tone?: string;
    naturalness?: 'standard' | 'neural' | 'studio' | 'generative';
    capabilities?: VoiceCapability;
    sampleAudioUrl?: string;
    supportsPreview?: boolean;
    supportsStreaming?: boolean;
    requiresApiKey?: boolean;
    isAvailable: boolean;
    available?: boolean;
    availabilityReason?: string;
}
export type AutoSpeakMode = 'OFF' | 'ON' | 'ASK';
export interface VoiceSettings {
    selectedVoiceId: string;
    selectedProvider?: VoiceProviderId;
    speechRate: number;
    pitch: number;
    volume: number;
    personalityMode: PersonalityMode;
    autoSpeak: AutoSpeakMode;
}
export interface TTSOptions {
    voiceId?: string;
    speechRate?: number;
    pitch?: number;
    volume?: number;
    outputFormat?: 'wav' | 'mp3';
}
export interface TTSSynthesisResult {
    audioFilePath?: string;
    audioBuffer?: Buffer;
    audioBase64?: string;
    durationMs?: number;
    format: 'wav' | 'mp3';
    sampleRate?: number;
    voiceId: string;
    spokenText: string;
}
export interface TTSProvider {
    readonly id: string;
    readonly name: string;
    listVoices(): Promise<VoiceProfile[]>;
    synthesize(text: string, options?: TTSOptions): Promise<TTSSynthesisResult>;
    isAvailable(): Promise<boolean>;
}
export type AudioOutputState = 'IDLE' | 'PLAYING_CUE' | 'PLAYING_TTS' | 'STOPPING' | 'ERROR';
export type AudioCueType = 'startup' | 'listening' | 'thinking' | 'answer_ready' | 'interrupt';
export interface AudioPlaybackStatus {
    isPlaying: boolean;
    state?: AudioOutputState;
    currentVoiceId?: string;
    currentText?: string;
    activeCue?: AudioCueType;
    startTime?: number;
    error?: string;
}
export type MicrophoneState = 'MIC_OFF' | 'MIC_READY' | 'MIC_STARTING' | 'MIC_LISTENING' | 'MIC_ERROR' | 'MIC_DEVICE_UNAVAILABLE' | 'MIC_STOPPING';
export interface AudioFrame {
    timestamp: number;
    sampleRate: number;
    channels: number;
    format: 'pcm_s16le';
    sequenceNumber: number;
    durationMs: number;
    data: Buffer;
    rms: number;
    peak: number;
    normalizedLevel: number;
}
export interface AudioCaptureDiagnostics {
    sampleRate: number;
    channels: number;
    format: string;
    frameCount: number;
    totalBytes: number;
    currentRms: number;
    peakLevel: number;
    normalizedLevel: number;
    streamDurationMs: number;
    activeDevice: string;
    isLive: boolean;
    state: MicrophoneState;
}
export type VADState = 'SILENCE' | 'SPEECH';
export interface VADFrameResult {
    isSpeech: boolean;
    state: VADState;
    speechDurationMs: number;
    silenceDurationMs: number;
    rms: number;
    threshold: number;
}
export type VoiceInputState = 'IDLE' | 'PASSIVE_WAKE_LISTENING' | 'WAKE_CONFIRMED' | 'COMMAND_CAPTURE' | 'TRANSCRIBING' | 'PROCESSING' | 'SPEAKING' | 'ERROR';
export type OnlineSystemStatus = 'ONLINE' | 'ONLINE_DEGRADED' | 'CONNECTING' | 'DEGRADED' | 'PROVIDER_ERROR' | 'NO_CREDENTIALS' | 'RATE_LIMITED' | 'NETWORK_UNAVAILABLE';
export type STTQualityMode = 'REALTIME' | 'BALANCED' | 'HIGH_ACCURACY';
export interface STTWordTiming {
    word: string;
    startMs: number;
    endMs: number;
    confidence?: number;
}
export interface STTResult {
    text: string;
    confidence: number;
    culture?: string;
    language?: string;
    detectedLanguage?: string;
    languageMetadata?: {
        code: string;
        name?: string;
        isCodeSwitched?: boolean;
        confidence?: number;
    };
    timestamps?: STTWordTiming[];
    durationMs?: number;
    providerId?: string;
    modelId?: string;
    isFinal: boolean;
    rawText?: string;
    interpretedText?: string;
}
export interface STTCapabilities {
    supportsRealtime: boolean;
    supportsKeytermBiasing: boolean;
    supportsLanguageDetection: boolean;
    supportsCodeSwitching: boolean;
    supportedAudioEncodings: string[];
    languages: string[];
    models: string[];
}
export interface STTOptions {
    culture?: string;
    language?: string;
    sampleRate?: number;
    keyterms?: string[];
    qualityMode?: STTQualityMode;
    enableCodeSwitching?: boolean;
    stream?: boolean;
    providerId?: string;
    modelId?: string;
}
export interface STTProviderHealth {
    available: boolean;
    latencyMs: number;
    isConfigured: boolean;
    message?: string;
    lastChecked?: string;
}
export interface STTProvider {
    readonly id: string;
    readonly name: string;
    initialize?(): Promise<void>;
    transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<STTResult>;
    transcribeRealtime?(audioStream: AsyncIterable<Buffer>, onPartial: (partial: STTResult) => void, options?: STTOptions): Promise<STTResult>;
    getLanguages?(): string[];
    getCapabilities?(): STTCapabilities;
    healthCheck?(): Promise<STTProviderHealth>;
    isAvailable(): Promise<boolean> | boolean;
    isConfigured?(): boolean;
}
export interface STTRoutingDecision {
    selectedProvider: string;
    modelId?: string;
    reason: string;
    qualityMode: STTQualityMode;
    fallbackChain: string[];
    language?: string;
    keytermsApplied?: string[];
}
export interface WakeWordResult {
    detected: boolean;
    phrase?: string;
    confidence?: number;
    rawText?: string;
}
export interface RoutineEntry {
    id: string;
    name: string;
    description: string;
    triggerType: 'SCHEDULE' | 'MANUAL' | 'SYSTEM_EVENT';
    scheduleCron?: string;
    actions: string[];
    isEnabled: boolean;
    lastRunAt?: string;
    nextRunAt?: string;
}
export interface DailyBrief {
    id: string;
    timestamp: string;
    greeting: string;
    pendingTasks: TaskEntry[];
    upcomingEvents: Array<{
        title: string;
        time: string;
        location?: string;
    }>;
    systemHealth: {
        status: 'HEALTHY' | 'WARNING' | 'ERROR';
        details: string;
    };
    recommendedActions: string[];
    verificationStatus: 'VERIFIED' | 'UNVERIFIED';
}
export interface CostSummary {
    totalTokensUsed: number;
    totalCostUsd: number;
    totalCostInr: number;
    localOperationsCount: number;
    cloudOperationsCount: number;
    zeroCostSavingsInr: number;
}
//# sourceMappingURL=index.d.ts.map