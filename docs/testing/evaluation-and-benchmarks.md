# Evaluation Framework & Benchmark Methodology

## Testing Architecture

MeghAI maintains a continuous testing and evaluation framework spanning three tiers:

1. **Unit Tests** (`tests/unit/`):
   - Input pipeline, language detection, intent parsing
   - 4-Tier risk engine & destructive command classification
   - Permission broker & grant matrix
   - Cryptographic verification engine & SHA-256 proofs
   - Kill switch activation & emergency abort
   - Secret redactor & prompt injection defense
   - Browser SSRF blocking & DOM extraction
   - Integrations draft-not-send & connector states
   - Observability spans, token accounting, and ₹0 tracking
   - UI design tokens and formatting

2. **Integration Tests** (`tests/integration/`):
   - Offline-first database persistence & audit logging
   - Multi-agent orchestrator executing DAG task plans
   - RAG pipeline chunking, ingestion, and hybrid retrieval
   - Personal knowledge graph entity creation & traversal
   - Voice catalog filtering & wake word detection

3. **End-to-End Vertical Slice** (`tests/e2e/`):
   - Full conversational prompt-to-verified-note execution slice

4. **Automated Evaluation Benchmark Suite** (`npm run benchmark`):
   - Evaluates Indic language detection accuracy across 7 languages
   - Evaluates prompt injection defense (100% threshold)
   - Evaluates risk classification across shell and file tools
   - Evaluates "No False Success" rule (100% threshold)

## Running Tests

```bash
# Run all Vitest suites
npm test

# Run benchmark evaluations
npm run benchmark

# Watch mode during development
npm run test:watch
```
