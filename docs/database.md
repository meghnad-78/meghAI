# MeghAI Database & Storage Architecture (Section 11, 121, 131)

## 1. Overview
MeghAI employs a hybrid data architecture:
1. **Primary Production Engine:** PostgreSQL with `pgvector` extension for full relational schema and embedding vector index.
2. **Offline-First Local Engine:** Zero-config embedded repository storing state in `%LOCALAPPDATA%/MeghAI/data/meghai_store.json`, providing instant startup, resilience against missing daemons, and transactional safety.

## 2. Core Relational Entities
- `notes`: Personal notes with tags, markdown content, and project associations.
- `tasks`: Actionable user tasks with due dates, priority, and formal task states.
- `memories`: Multi-layer memory entries (Short-term, Episodic, Semantic, Preference, Procedural, Routine, Project).
- `conversations` & `messages`: Threaded multi-turn conversational history with correlation IDs.
- `audit_logs`: Immutable security audit logs with timestamps, actors, targets, and outcome statuses.

## 3. Vector Similarity
Vector similarity queries use cosine distance across embedding vectors for RAG and semantic memory retrieval.
