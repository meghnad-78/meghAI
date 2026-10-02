import { describe, it, expect } from 'vitest';
import { RAGPipeline } from '../../packages/rag/src/index';

describe('RAGPipeline Integration', () => {
  it('chunks documents with overlap and indexes them', () => {
    const rag = new RAGPipeline();
    const text = 'word '.repeat(500); // 500 words
    const chunks = rag.chunkText(text, 100, 20);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].split(' ').length).toBeLessThanOrEqual(101);
  });

  it('ingests documents and retrieves relevant chunks with ranked scores', () => {
    const rag = new RAGPipeline();
    rag.ingestDocument(
      'doc1.txt',
      'MeghAI is a Windows-first Personal AI Operating Layer designed for high performance and offline capability.'
    );
    rag.ingestDocument(
      'doc2.txt',
      'Python and TypeScript are great programming languages for building backend microservices.'
    );

    const results = rag.search('Windows personal operating layer');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toBe('doc1.txt');
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].chunk.content).toContain('Windows-first Personal AI');
  });

  it('returns empty array when no matches are found', () => {
    const rag = new RAGPipeline();
    rag.ingestDocument('doc.txt', 'The quick brown fox jumps over the lazy dog.');
    const results = rag.search('completely unrelated astrophysics topic');
    expect(results.length).toBe(0);
  });
});
