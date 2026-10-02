import type { ModelProviderId, ModelDescriptor, ModelRequest, ModelResponse, RoutingMode, CostMode, PrivacyMode } from '@meghai/shared-types';
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
 * Google Gemini Provider Adapter (Section 31 & 32)
 */
export declare class GeminiProvider extends BaseProvider {
    constructor(apiKey?: string | undefined);
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * Local AI / Ollama Provider Adapter (Section 11, 121, 206)
 */
export declare class LocalOllamaProvider extends BaseProvider {
    private hostUrl;
    constructor(hostUrl?: string);
    isConfigured(): boolean;
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * Anthropic, OpenAI, DeepSeek, Grok, Perplexity Generic Adapters
 */
export declare class GenericCloudProvider extends BaseProvider {
    private defaultModel;
    constructor(id: ModelProviderId, name: string, apiKey?: string, defaultModel?: string);
    getModels(): ModelDescriptor[];
    checkHealth(): Promise<ProviderHealth>;
    complete(request: ModelRequest): Promise<ModelResponse>;
}
/**
 * Authoritative Model Router (Section 33 & 34)
 */
export declare class ModelRouter {
    private providers;
    constructor();
    registerProvider(provider: IModelProvider): void;
    getProvider(id: ModelProviderId): IModelProvider | undefined;
    listProviders(): IModelProvider[];
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
    }): Promise<RoutingDecision>;
    private registerStandardProviders;
}
//# sourceMappingURL=index.d.ts.map