import { describe, it, expect } from 'vitest';
import { ObservabilityService } from '../../packages/observability/src/index';

describe('ObservabilityService', () => {
  it('tracks distributed trace spans and measures execution duration', async () => {
    const obs = new ObservabilityService();
    const span = obs.startSpan('tool_execution', 'trace_123');

    expect(span.spanId).toBeDefined();
    expect(span.traceId).toBe('trace_123');
    expect(span.status).toBe('OK');

    await new Promise(r => setTimeout(r, 20));
    const ended = obs.endSpan(span.spanId, 'OK');

    expect(ended.durationMs).toBeGreaterThanOrEqual(15);
    expect(ended.endTime).toBeDefined();
  });

  it('calculates ₹0 cost for local Ollama models and positive cost for cloud models', () => {
    const obs = new ObservabilityService();

    // 1. Local Ollama: zero cost
    const localRecord = obs.recordTokenUsage('ollama', 'ollama:llama3', 1000, 500);
    expect(localRecord.estimatedCostUSD).toBe(0);
    expect(localRecord.estimatedCostINR).toBe(0);
    expect(localRecord.totalTokens).toBe(1500);

    // 2. Cloud Gemini: low cost
    const cloudRecord = obs.recordTokenUsage('google', 'gemini-1.5-flash', 10000, 2000);
    expect(cloudRecord.estimatedCostUSD).toBeGreaterThan(0);
    expect(cloudRecord.estimatedCostINR).toBeGreaterThan(0);

    const metrics = obs.getMetrics();
    expect(metrics.totalTokensConsumed).toBe(13500);
  });

  it('records tool calls and verification outcomes', () => {
    const obs = new ObservabilityService();
    obs.recordToolCall(true);
    obs.recordToolCall(true);
    obs.recordToolCall(false);

    const metrics = obs.getMetrics();
    expect(metrics.totalToolCalls).toBe(3);
    expect(metrics.successfulVerifications).toBe(2);
    expect(metrics.failedVerifications).toBe(1);
  });

  it('redacts sensitive credentials in logs and error traces', () => {
    const obs = new ObservabilityService();
    const entry = obs.log('ERROR', 'Failed to authenticate with key AIzaSyDfakeApiKey1234567890abcdefghijkl');
    expect(entry.message).not.toContain('AIzaSyDfakeApiKey1234567890abcdefghijkl');
    expect(entry.message).toContain('[REDACTED_');
  });
});
