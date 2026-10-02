# MeghAI Implementation Ledger

## Architecture Ledger & Milestone Log

### Date: 2026-10-02
**Lead Architect:** Principal AI Product Architect & Systems Engineer  
**Target Platform:** Windows 11 (Desktop First) + Web Companion Dashboard

---

### Milestone Progress Ledger

| Milestone | Scope | Target Capabilities | Status | Verification Gate |
|---|---|---|---|---|
| **Phase 0** | Functional Foundation | Monorepo setup, shared types, database layer, secure IPC, event system, input pipeline, risk engine, permission broker, tool registry, verifier, kill switch, windows agent, AI core particle UI, first vertical slice (Notes / Files) | **COMPLETED & VERIFIED** | 31/31 unit, integration, and e2e tests passing |
| **Phase 1** | Model Router, Agents, RAG & Voice | Multi-provider adapters (Gemini, Claude, OpenAI, DeepSeek, Grok, Perplexity, Local Ollama), planner DAG, multi-agent orchestrator, RAG pipeline, knowledge graph, voice catalog (100+ voices), wake word detector | **COMPLETED & VERIFIED** | 52/52 tests passing; benchmark evaluation score 100% |
| **Phase 2** | Browser, Integrations & Observability | Isolated browser engine, SSRF defense, Google/Microsoft connectors (Draft-Not-Send enforced), request tracing, token accounting ($0 / ₹0 tracking), shared UI tokens | **COMPLETED & VERIFIED** | Browser, Integrations, Observability unit tests passing |
| **Phase 3** | Infrastructure & Operations | Docker compose (pgvector, Redis, Ollama), Windows Service scripts, Prometheus metrics, benchmark suite, companion web interface | **COMPLETED & VERIFIED** | Clean build across workspaces; live background daemons running |

---

### Monorepo Structure Registry

#### Apps (`apps/*`)
1. `apps/api`: Fastify REST + SSE server (`http://localhost:4820`)
2. `apps/desktop`: Vite + React 18 futuristic desktop interface (`http://localhost:3000`)
3. `apps/windows-agent`: Privileged Win32 native automation service (`http://localhost:4821`)
4. `apps/web`: Web companion interface for local network control (`http://localhost:3001`)

#### Packages (`packages/*`)
1. `@meghai/shared-types`: Canonical domain models, AI states, risk tiers, and permissions.
2. `@meghai/security`: HMAC IPC auth, secret redactor, path traversal guard, and prompt injection defense.
3. `@meghai/permissions`: Authoritative 16-scope, 7-mode permission broker.
4. `@meghai/risk-engine`: 4-tier risk classification engine and action preview card generator.
5. `@meghai/verification`: SHA-256 cryptographic file verifier, DB record checks, and API receipts.
6. `@meghai/tool-registry`: Schemas for notes, files, system info, Windows apps, and PowerShell.
7. `@meghai/tool-runtime`: 11-step execution pipeline with resource locking.
8. `@meghai/database`: Offline-first persistent embedded database with audit logging.
9. `@meghai/events`: Event bus with action timeline persistence and SSE broadcasting.
10. `@meghai/ai-core`: Indic language detector (7 languages), entity resolver, and intent classifier.
11. `@meghai/model-router`: Provider abstraction across 6 model ecosystems with offline fallback.
12. `@meghai/memory`: Multi-layer memory manager (Working, Episodic, Semantic, Procedural, Preference).
13. `@meghai/windows`: Win32 active window detection, app spawning, and PowerShell execution.
14. `@meghai/config`: Typed configuration loader.
15. `@meghai/planner`: Directed Acyclic Graph (DAG) task planner.
16. `@meghai/agents`: Specialist agents (`FilesAgent`, `WindowsAgentWrapper`, `ResearchAgent`, `VerifierAgent`) and orchestrator.
17. `@meghai/voice`: Wake word detector ("Hey Megh" / "Megh") and unified 100+ voice catalog.
18. `@meghai/vision`: Multimodal visual inspector and base64 payloads.
19. `@meghai/rag`: RAG document chunking, hybrid BM25 and vector search.
20. `@meghai/knowledge-graph`: Personal knowledge graph with typed entities and directional edges.
21. `@meghai/browser`: Chromium/HTTP safe scraper with SSRF defense and prompt injection fencing.
22. `@meghai/integrations`: Connectors for Gmail, Outlook, Google Calendar, WhatsApp, and Google Drive.
23. `@meghai/observability`: Request tracing, token accounting, and ₹0-first cost tracking.
24. `@meghai/evaluation`: Benchmark suite testing languages, injection defense, risk, and no-false-success.
25. `@meghai/ui`: Shared futuristic design tokens, themes, and formatting helpers.

#### Infrastructure (`infrastructure/*`)
- `infrastructure/docker/docker-compose.yml`: PostgreSQL 16 + pgvector, Redis, Ollama.
- `infrastructure/database/schema.sql`: Full enterprise relational & vector schema.
- `infrastructure/deployment/windows-service.ps1`: Auto-start Windows background service deployment.
- `infrastructure/monitoring/prometheus.yml`: Prometheus metrics scraping.

#### Scripts (`scripts/*`)
- `scripts/setup.ps1`: Windows initialization and directory verification.
- `scripts/start-all.ps1`: Full stack launcher.
- `scripts/clean.ps1`: Artifact and cache cleaner.
- `scripts/migrate.ts`: Database migration and verification.
- `scripts/benchmark.ts`: Automated evaluation benchmark runner.

---

### Architecture Decision Records (ADRs)
- `docs/adr/001-monorepo-package-management.md` - NPM Workspaces, TypeScript 5.8 ESM, Domain Boundaries
- `docs/adr/002-desktop-shell-windows-agent.md` - Electron Shell + Native Windows Agent + Secure Local IPC
- `docs/adr/003-database-storage-strategy.md` - Hybrid PostgreSQL/pgvector with Zero-Config Embedded SQLite/PGlite Local Fallback
- `docs/adr/004-safety-permissions-risk.md` - 4-Tier Risk Engine, Strict Capability-Scoped Tools, Immutable Verification
- `docs/adr/005-model-provider-abstraction.md` - Multi-Provider BYOK Adapter Architecture with Dynamic Capability Matrix

---

### Non-Negotiable Operational Principles
1. **The LLM is NOT the Operating System:** Models only propose; Orchestrator coordinates, Policy authorizes, Runtime executes, Verifier confirms.
2. **Untrusted Data Isolation:** Web content, files, and messages are untrusted data; prompt-injection defenses prevent overriding system policy.
3. **No False Success:** System status defaults to `UNVERIFIED` unless post-execution cryptographic or API state validation succeeds.
4. **Kill Switch Authority:** "STOP MEGH" halts all agent tasks, model streams, audio output, and tool subprocesses immediately.
5. **Draft is NOT Send:** Creating messages and dispatching them are distinct actions requiring separate approval.
