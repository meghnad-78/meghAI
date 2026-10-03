import type { ModelProviderId, ModelDescriptor, ModelRequest, ModelResponse, RoutingMode, CostMode, PrivacyMode } from '@meghai/shared-types';
export type TaskComplexity = 'FAST' | 'NORMAL' | 'DEEP' | 'MULTI_MODEL';
export interface ProviderHealth {
    available: boolean;
    latencyMs: number;
    message?: string;
    isConfigured: boolean;
}
export interface IModelProvider {
    id: ModelProviderId;
    name: string;
    isConfigured(): boolean;
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
export interface RoutingDecision {
    selectedProvider: ModelProviderId;
    selectedModel: string;
    routingReason: string;
    fallbackChain: Array<{
        providerId: ModelProviderId;
        modelId: string;
    }>;
    executionMode: 'SINGLE_MODEL' | 'MULTI_MODEL';
    complexity: TaskComplexity;
}
export interface MultiModelExecutionStep {
    role: 'PLANNER' | 'RESEARCH' | 'REASONING' | 'VERIFIER' | 'SYNTHESIZER';
    providerId: ModelProviderId;
    modelId: string;
    inputPrompt: string;
    output: string;
    latencyMs: number;
    success: boolean;
    fallbackUsed: boolean;
    estimatedCostUSD: number;
    tokensUsed?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface MultiModelExecutionResult {
    taskId: string;
    goal: string;
    complexity: TaskComplexity;
    finalSynthesis: string;
    totalLatencyMs: number;
    totalCostUSD: number;
    steps: MultiModelExecutionStep[];
    success: boolean;
}
/**
 * Base Abstract Provider
 */
export declare abstract class BaseProvider implements IModelProvider {
    id: ModelProviderId;
    name: string;
    protected apiKey?: string | undefined;
    constructor(id: ModelProviderId, name: string, apiKey?: string | undefined);
    isConfigured(): boolean;
    abstract getModels(): ModelDescriptor[];
    abstract checkHealth(): Promise<ProviderHealth>;
    abstract complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * Google Gemini Provider Adapter
 */
export declare class GeminiProvider extends BaseProvider {
    constructor(apiKey?: string | undefined);
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * OpenAI Provider Adapter
 */
export declare class OpenAIProvider extends BaseProvider {
    constructor(apiKey?: string | undefined);
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * Anthropic Claude Provider Adapter
 */
export declare class AnthropicProvider extends BaseProvider {
    constructor(apiKey?: string | undefined);
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * DeepSeek Provider Adapter
 */
export declare class DeepSeekProvider extends BaseProvider {
    constructor(apiKey?: string | undefined);
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * Local AI / Ollama Provider Adapter (100% Offline, $0 / ₹0)
 */
export declare class LocalOllamaProvider extends BaseProvider {
    private hostUrl;
    private defaultModel;
    constructor(hostUrl?: string, defaultModel?: string);
    isConfigured(): boolean;
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * Generic Cloud Provider for Grok & Perplexity
 */
export declare class GenericCloudProvider extends BaseProvider {
    private defaultModel;
    constructor(id: ModelProviderId, name: string, apiKey?: string, defaultModel?: string);
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * Multi-Model Execution Engine (Section 33 & 34)
 * Executes pipeline of specialized models (Planner -> Specialist Reasoning -> Verifier -> Synthesizer)
 */
export declare class MultiModelExecutionEngine {
    private router;
    constructor(router: ModelRouter);
    executePipeline(goal: string, steps: Array<{
        role: 'PLANNER' | 'RESEARCH' | 'REASONING' | 'VERIFIER' | 'SYNTHESIZER';
        prompt: string;
        preferredProvider?: ModelProviderId;
    }>): Promise<MultiModelExecutionResult>;
}
/**
 * Authoritative Model Router (Section 33 & 34)
 */
export declare class ModelRouter {
    private providers;
    private executionEngine;
    constructor();
    registerProvider(provider: IModelProvider): void;
    getProvider(id: ModelProviderId): IModelProvider | undefined;
    listProviders(): IModelProvider[];
    getExecutionEngine(): MultiModelExecutionEngine;
    /**
     * Evaluates request requirements and returns optimal routing decision.
     */
    route(request: ModelRequest, options?: {
        routingMode?: RoutingMode;
        costMode?: CostMode;
        privacyMode?: PrivacyMode;
        requiresVision?: boolean;
        requiresLongContext?: boolean;
        requiresWebSearch?: boolean;
        requiresReasoning?: boolean;
    }): Promise<RoutingDecision>;
    private registerStandardProviders;
}
//# sourceMappingURL=index.d.ts.map