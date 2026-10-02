# ADR 003: Database & Hybrid Storage Strategy

## Status
Accepted

## Context
Specification sections 11, 121, 131, and 206 state:
- Primary DB: PostgreSQL with pgvector for semantic retrieval.
- Offline-first: The system must support maximum practical offline operation, running without cloud dependencies or if external daemons are temporarily offline.
- No-cloud-credential start: MeghAI must still launch and provide local notes, reminders, files, and tasks.
- Error UX: Never show raw database connection errors (`ECONNREFUSED 5432`) to users; provide fallback.

In our current environment, an external PostgreSQL daemon is not active by default.

## Decision
Implement a **Database Adapter Architecture** in `packages/database`:
1. **Primary Production Driver:** PostgreSQL connection pool with `pgvector` extension for full relational schema and embedding vector index.
2. **Offline / Embedded Fallback Driver:** Embedded local SQLite/file-based repository using vector embeddings cosine similarity in memory/Wasm, storing state in `%LOCALAPPDATA%/MeghAI/data/meghai.db`.
3. A unified repository interface (`IDatabaseRepository`) so that services (Conversation, Tasks, Notes, Memories, Knowledge, Permissions) interact with the exact same domain methods regardless of whether Postgres or the local embedded engine is active.
4. Auto-migration system running schema updates on startup.

## Consequences
- Guaranteed zero-setup launch on any clean Windows machine.
- 100% offline capability for local notes, reminders, preferences, and file indexing.
- Seamless upgrade to external PostgreSQL + pgvector when configured in production or Docker.
