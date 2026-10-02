# Model Routing & Provider Abstraction

## Overview

MeghAI provides an intelligent, cost-optimized, and resilient multi-model routing layer across six major model ecosystems:

1. **Google Gemini** (Gemini 1.5 Flash / Pro, multimodal, low latency, structured JSON)
2. **OpenAI** (GPT-4o, reasoning, o-series)
3. **Anthropic Claude** (Claude 3.5 Sonnet, complex software engineering and deep analysis)
4. **DeepSeek** (DeepSeek-V3 / R1, high-efficiency reasoning and mathematics)
5. **xAI Grok** (Grok-2 / Beta, real-time facts)
6. **Local Ollama** (Llama 3, Mistral, Qwen, phi3, 100% offline and ₹0 / $0 token cost)

## Routing Architecture

```
User Prompt
    │
    ▼
Language Detection (Indic / Global / Code-Switched)
    │
    ▼
Complexity Classifier (Task Type, Risk Level, Cost Budget)
    │
    ├── Simple Fact / Local System Query ──► Local Ollama / Gemini 1.5 Flash
    ├── Multimodal Vision / Audio ─────────► Gemini 1.5 Pro / GPT-4o
    ├── Deep Coding / Refactoring ─────────► Claude 3.5 Sonnet / DeepSeek
    └── Offline Mode / Privacy First ──────► Local Ollama ($0 cost)
```

## Resilience and Fallback Chain

When any cloud provider encounters rate limiting (`HTTP 429`), network unavailability, or missing credentials, the model router executes automatic fallback:

1. Primary configured model (e.g. Gemini 1.5 Flash)
2. Secondary cloud model (e.g. DeepSeek or OpenAI)
3. Local offline fallback (`LOCAL_MODE` via Ollama or local deterministic processor)

No user operation is failed due to temporary internet disconnection.
