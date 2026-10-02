# MeghAI Technical Architecture Specification

## Overview
**MeghAI** is a Windows-First Personal AI Operating Layer. It operates as an omnipresent intelligence layer over the user's computer and digital life, unifying voice, text, screen awareness, local files, Windows automation, personal memory, and multi-model AI routing.

```
VOICE / TEXT / IMAGE / FILE / SCREEN / SYSTEM CONTEXT
        ↓
     CAPTURE
        ↓
    UNDERSTAND
        ↓
LANGUAGE DETECTION (En, Hi, Bn, Hr, Bh, Hinglish, Benglish)
        ↓
      INTENT
        ↓
ENTITY RESOLUTION
        ↓
     CONTEXT
        ↓
     MEMORY
        ↓
    KNOWLEDGE
        ↓
   RISK ASSESSMENT (LOW, MEDIUM, HIGH, CRITICAL)
        ↓
 PERMISSION BROKER (DENIED, ASK, ALLOWED, CONFIRMATION)
        ↓
  MODEL ROUTING (Gemini, Claude, GPT, DeepSeek, Grok, Perplexity, Local Ollama)
        ↓
     PLANNING
        ↓
MULTI-AGENT EXECUTION (Planner, Windows, Files, Research, Coding, Memory, Verifier)
        ↓
      TOOLS (Resource-locked execution pipeline)
        ↓
WINDOWS / WEB / APPS / SERVICES (Native Win32, UIA, PowerShell, Chromium)
        ↓
   VERIFICATION (Cryptographic hashes, DB check, API receipts -> Outcome Proof)
        ↓
    RESPONSE
        ↓
    TIMELINE (Real-time typed events & visual action history)
        ↓
 MEMORY / LEARNING
```

---

## Foundational Tenets
1. **The LLM is NOT the Operating System:** Models only propose actions; Orchestrator coordinates, Policy authorizes, Runtime executes, Verifier confirms.
2. **Untrusted Data Isolation:** External webpages, documents, and messages are untrusted data and can never override system prompts or permission policies.
3. **No False Success:** System status defaults to `UNVERIFIED` unless post-execution cryptographic, database, or API receipt validation succeeds.
4. **Kill Switch Authority:** "STOP MEGH" halts active tasks, streams, audio output, and tool subprocesses immediately.
5. **Anti-Overengineering Rule:** Simple requests (e.g., "Open Calculator") use the smallest safe execution path without invoking unnecessary multi-agent graphs or multi-model cascades.
