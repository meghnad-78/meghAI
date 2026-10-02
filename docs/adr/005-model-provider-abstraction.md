# ADR 005: Model Provider Abstraction & Dynamic Routing

## Status
Accepted

## Context
Specification Section 31 requires support for:
1. Google / Gemini
2. OpenAI / ChatGPT
3. Anthropic / Claude
4. DeepSeek
5. xAI / Grok
6. Perplexity
7. Local AI / Ollama

And Section 206 states:
*When no provider key is configured: MeghAI must still launch. Show: LOCAL MODE.*
The system must never fabricate model outputs or pretend a disconnected provider is working.

## Decision
1. Create a unified `IModelProvider` interface:
   - `id`: Unique identifier (`gemini`, `openai`, `anthropic`, `deepseek`, `grok`, `perplexity`, `local-ollama`)
   - `name`: Display name
   - `capabilities`: Matrix of supported features (text, vision, audio, tools, streaming, reasoning, long_context, embeddings)
   - `checkHealth()`: Checks API connectivity or local server health
   - `generateCompletion(request: ModelRequest): Promise<ModelResponse>`
   - `generateStream(request: ModelRequest): AsyncIterable<ModelStreamChunk>`
2. **Dynamic Model Router:**
   - Evaluates request requirements (modality, tokens, tool calling, privacy mode, cost mode).
   - Cost modes: `FREE_FIRST`, `BALANCED`, `QUALITY_FIRST`.
   - Privacy modes: `LOCAL_ONLY`, `PRIVATE`, `BALANCED`, `CLOUD_ENABLED`.
   - Fallback chain: If primary provider is rate-limited or unavailable, fall back to secondary compatible provider without violating privacy policy.
   - If no cloud keys exist and local model is offline, truthfully report `NOT_CONNECTED` or `LOCAL_ONLY`.

## Consequences
- Clean separation of provider logic.
- Adding a new model provider requires only an adapter conforming to `IModelProvider` and registration in the Provider Registry.
