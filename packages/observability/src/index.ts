import crypto from 'node:crypto';
import { SecretRedactor } from '@meghai/security';

export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, any>;
  status: 'OK' | 'ERROR';
  errorMessage?: string;
}

export interface TokenUsageRecord {
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  estimatedCostINR: number;
  timestamp: string;
}

export interface TelemetryMetrics {
  totalRequests: number;
  totalToolCalls: number;
  successfulVerifications: number;
  failedVerifications: number;
  totalTokensConsumed: number;
  totalCostUSD: number;
  totalCostINR: number;
}

/**
 * Rates per 1M tokens (USD)
 */
const MODEL_PRICING_PER_MILLION: Record<string, { prompt: number; completion: number }> = {
  'gemini-1.5-flash': { prompt: 0.075, completion: 0.30 },
  'gemini-1.5-pro': { prompt: 1.25, completion: 5.00 },
  'gpt-4o': { prompt: 2.50, completion: 10.00 },
  'claude-3-5-sonnet': { prompt: 3.00, completion: 15.00 },
  'deepseek-chat': { prompt: 0.14, completion: 0.28 },
  'grok-beta': { prompt: 5.00, completion: 15.00 },
  'ollama': { prompt: 0.00, completion: 0.00 }, // Local model is always $0 / ₹0
  'local': { prompt: 0.00, completion: 0.00 },
};

const USD_TO_INR_RATE = 87.0;

export class ObservabilityService {
  private spans: Map<string, Span> = new Map();
  private tokenRecords: TokenUsageRecord[] = [];
  private metrics: TelemetryMetrics = {
    totalRequests: 0,
    totalToolCalls: 0,
    successfulVerifications: 0,
    failedVerifications: 0,
    totalTokensConsumed: 0,
    totalCostUSD: 0,
    totalCostINR: 0,
  };

  /**
   * Start a new distributed trace span
   */
  public startSpan(name: string, traceId?: string, parentSpanId?: string, attributes: Record<string, any> = {}): Span {
    const span: Span = {
      spanId: `span_${crypto.randomBytes(6).toString('hex')}`,
      traceId: traceId || `trace_${crypto.randomBytes(8).toString('hex')}`,
      parentSpanId,
      name,
      startTime: performance.now(),
      attributes: { ...attributes },
      status: 'OK',
    };
    this.spans.set(span.spanId, span);
    return span;
  }

  /**
   * End an active trace span
   */
  public endSpan(spanId: string, status: 'OK' | 'ERROR' = 'OK', errorMessage?: string): Span {
    const span = this.spans.get(spanId);
    if (!span) {
      throw new Error(`Span not found: ${spanId}`);
    }
    span.endTime = performance.now();
    span.durationMs = Number((span.endTime - span.startTime).toFixed(2));
    span.status = status;
    if (errorMessage) {
      span.errorMessage = SecretRedactor.redact(errorMessage);
    }
    return span;
  }

  /**
   * Record token usage & compute USD and INR cost
   */
  public recordTokenUsage(provider: string, model: string, promptTokens: number, completionTokens: number): TokenUsageRecord {
    const pricingKey = Object.keys(MODEL_PRICING_PER_MILLION).find(k => model.toLowerCase().includes(k)) || 'gemini-1.5-flash';
    const pricing = MODEL_PRICING_PER_MILLION[pricingKey];

    const promptCost = (promptTokens / 1_000_000) * pricing.prompt;
    const completionCost = (completionTokens / 1_000_000) * pricing.completion;
    const totalUSD = promptCost + completionCost;
    const totalINR = totalUSD * USD_TO_INR_RATE;

    const record: TokenUsageRecord = {
      model,
      provider,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      estimatedCostUSD: Number(totalUSD.toFixed(6)),
      estimatedCostINR: Number(totalINR.toFixed(4)),
      timestamp: new Date().toISOString(),
    };

    this.tokenRecords.push(record);
    this.metrics.totalTokensConsumed += record.totalTokens;
    this.metrics.totalCostUSD += record.estimatedCostUSD;
    this.metrics.totalCostINR += record.estimatedCostINR;

    return record;
  }

  public recordToolCall(verified: boolean) {
    this.metrics.totalToolCalls++;
    if (verified) {
      this.metrics.successfulVerifications++;
    } else {
      this.metrics.failedVerifications++;
    }
  }

  public getMetrics(): TelemetryMetrics {
    return { ...this.metrics };
  }

  public getTokenRecords(): TokenUsageRecord[] {
    return [...this.tokenRecords];
  }

  public log(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'AUDIT', message: string, metadata: Record<string, any> = {}) {
    const sanitizedMsg = SecretRedactor.redact(message);
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message: sanitizedMsg,
      metadata,
    };
    if (process.env.NODE_ENV !== 'test') {
      // Structured JSON logging
      console.log(JSON.stringify(entry));
    }
    return entry;
  }
}
