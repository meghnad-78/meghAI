# ADR 001: Monorepo Architecture & Package Management

## Status
Accepted

## Context
MeghAI is a complex personal AI operating layer with multiple interdependent modules:
- Desktop UI (Electron / React)
- Privileged Windows Agent (Native Win32 / UIA / PowerShell)
- AI Core & Model Router (Multi-provider orchestration)
- Tool Runtime, Security & Permission Broker
- Database & Memory Engine
- Voice & Vision subsystems

To prevent circular dependencies, ensure type safety, and allow independent testability, we need a modular repository architecture with strict domain boundaries.

## Decision
1. Use **npm workspaces** with TypeScript across `/apps/*` and `/packages/*`.
2. Packages will export clean ESM modules with explicit entrypoints (`index.ts`).
3. Domain boundaries are strictly enforced:
   - `packages/shared-types`: Canonical data contracts, event schemas, task states, risk levels.
   - `packages/security`: Cryptographic tokens, IPC verification, secret redaction, sanitization.
   - `packages/permissions`: Authoritative permission broker.
   - `packages/risk-engine`: 4-tier risk classification and evaluation.
   - `packages/tool-registry` & `tool-runtime`: Validated tool definitions and resource-locked execution.
   - `packages/verification`: Post-execution verification engine.
   - `packages/model-router`: Provider abstraction and dynamic routing.
   - `packages/database`: Storage repository supporting Postgres/pgvector and embedded local database.
4. No package may directly bypass the security or permission layers to execute tools.

## Consequences
- Fast builds, clear type contracts across frontend and backend.
- Prevents spaghetti dependencies; modules can be unit-tested in isolation without mocking entire OS subsystems.
