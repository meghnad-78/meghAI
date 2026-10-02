# RAG & Document Retrieval Architecture

## Pipeline Overview

The MeghAI Retrieval-Augmented Generation (RAG) subsystem extracts, chunks, indexes, and searches personal files, conversation history, and connected knowledge bases.

```
Document Ingestion
       │
       ▼
Text Chunking (400 words per chunk, 50-word sliding overlap)
       │
       ▼
Hybrid Indexing (BM25 Keyword + Vector Embeddings)
       │
       ▼
Hybrid Search (Weighted scoring: 0.6 Dense Vector + 0.4 Lexical BM25)
       │
       ▼
Context Reranking & Injection Defense Wrapping
```

## Security & Isolation

Retrieved chunks originating from untrusted files (e.g. downloaded PDFs, web scrapes) are wrapped with `[BEGIN UNTRUSTED DATA FROM: <source>]` delimiters to prevent indirect prompt injection attacks against the reasoning model.
