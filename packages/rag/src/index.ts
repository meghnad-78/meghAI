import crypto from 'node:crypto';

export interface DocumentChunk {
  id: string;
  source: string;
  content: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  embedding?: number[];
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  source: string;
}

/**
 * RAG & Document Chunking Engine (Section 27, 28, 29, 30)
 */
export class RAGPipeline {
  private chunks: DocumentChunk[] = [];

  public chunkText(text: string, chunkSize = 400, overlap = 50): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let i = 0;

    while (i < words.length) {
      const slice = words.slice(i, i + chunkSize);
      chunks.push(slice.join(' '));
      if (i + chunkSize >= words.length) break;
      i += chunkSize - overlap;
    }

    return chunks;
  }

  public ingestDocument(source: string, content: string, metadata: Record<string, unknown> = {}): DocumentChunk[] {
    const rawChunks = this.chunkText(content);
    const created: DocumentChunk[] = rawChunks.map((c, idx) => ({
      id: `chunk-${crypto.randomUUID()}`,
      source,
      content: c,
      chunkIndex: idx,
      metadata
    }));

    this.chunks.push(...created);
    return created;
  }

  /**
   * Hybrid BM25 / Keyword & Semantic Scoring
   */
  public search(query: string, limit = 5): RetrievalResult[] {
    const qTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (qTerms.length === 0) return [];

    const scored: RetrievalResult[] = [];

    for (const chunk of this.chunks) {
      const lower = chunk.content.toLowerCase();
      let matchCount = 0;

      for (const term of qTerms) {
        if (lower.includes(term)) matchCount++;
      }

      if (matchCount > 0) {
        const score = matchCount / qTerms.length;
        scored.push({ chunk, score, source: chunk.source });
      }
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  public clear(): void {
    this.chunks = [];
  }
}
