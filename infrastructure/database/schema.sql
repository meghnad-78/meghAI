-- =========================================================================
-- MEGHAI OPERATING LAYER - POSTGRESQL + PGVECTOR ENTERPRISE SCHEMA
-- Designed for Windows-First Personal AI Operating System
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    preferred_language VARCHAR(20) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    session_status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Messages Table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    model VARCHAR(100),
    language VARCHAR(20),
    is_untrusted BOOLEAN DEFAULT FALSE,
    trust_level VARCHAR(50) DEFAULT 'USER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Multi-Layer Memory & Vector Store (Section 21 - 25)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    layer VARCHAR(50) NOT NULL CHECK (layer IN ('WORKING', 'EPISODIC', 'SEMANTIC', 'PROCEDURAL', 'PREFERENCE')),
    key VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    confidence NUMERIC(4, 3) DEFAULT 1.0,
    is_locked BOOLEAN DEFAULT FALSE,
    access_count INTEGER DEFAULT 0,
    embedding vector(1536), -- Compatible with OpenAI / Gemini embeddings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_memories_layer_key ON memories (layer, key);

-- 5. Personal Knowledge Graph (Nodes & Edges) (Section 26)
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    node_type VARCHAR(50) NOT NULL,
    label VARCHAR(255) NOT NULL,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_node_id UUID REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    to_node_id UUID REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    relationship VARCHAR(100) NOT NULL,
    weight NUMERIC(4, 3) DEFAULT 1.0,
    properties JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_knowledge_edges_from ON knowledge_edges(from_node_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_edges_to ON knowledge_edges(to_node_id);

-- 6. Action Timeline & Immutable Audit Ledger (Section 62 & 142)
CREATE TABLE IF NOT EXISTS action_timeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    state VARCHAR(50) NOT NULL CHECK (state IN ('QUEUED', 'RUNNING', 'AWAITING_CONFIRMATION', 'COMPLETED', 'VERIFIED', 'FAILED', 'BLOCKED')),
    arguments JSONB DEFAULT '{}'::jsonb,
    result JSONB DEFAULT '{}'::jsonb,
    verification_proof TEXT,
    is_reversible BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_timeline_state ON action_timeline (state);
CREATE INDEX IF NOT EXISTS idx_timeline_created_at ON action_timeline (created_at DESC);

-- 7. Authoritative Permission Scopes & Grants (Section 56 & 57)
CREATE TABLE IF NOT EXISTS permission_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    scope VARCHAR(100) NOT NULL,
    mode VARCHAR(50) NOT NULL CHECK (mode IN ('ALWAYS_ALLOW', 'ASK_EVERY_TIME', 'SESSION_ONLY', 'NEVER_ALLOW')),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);
