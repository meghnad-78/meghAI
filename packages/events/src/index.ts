import crypto from 'node:crypto';
import type { EventType, MeghAIEvent } from '@meghai/shared-types';

export type EventHandler<T = unknown> = (event: MeghAIEvent<T>) => void;

/**
 * High-Performance Typed Event Bus & Action Timeline Engine (Section 105 & 134)
 */
export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private timeline: MeghAIEvent[] = [];
  private maxTimelineSize = 1000;

  public publish<T = unknown>(
    type: EventType,
    payload: T,
    correlationId?: string,
    source = 'SYSTEM'
  ): MeghAIEvent<T> {
    const event: MeghAIEvent<T> = {
      id: `evt-${crypto.randomUUID()}`,
      type,
      timestamp: new Date().toISOString(),
      payload,
      correlationId,
      source
    };

    // Store in timeline
    this.timeline.push(event as MeghAIEvent);
    if (this.timeline.length > this.maxTimelineSize) {
      this.timeline.shift();
    }

    // Direct type listeners
    const listeners = this.handlers.get(type);
    if (listeners) {
      for (const fn of listeners) {
        try {
          fn(event as MeghAIEvent);
        } catch (err) {
          console.error(`[EventBus] Handler error for ${type}:`, err);
        }
      }
    }

    // Wildcard listeners
    const wildcard = this.handlers.get('*');
    if (wildcard) {
      for (const fn of wildcard) {
        try {
          fn(event as MeghAIEvent);
        } catch (err) {
          console.error(`[EventBus] Wildcard handler error:`, err);
        }
      }
    }

    return event;
  }

  public subscribe<T = unknown>(
    type: EventType | '*',
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const set = this.handlers.get(type)!;
    set.add(handler as EventHandler);

    return () => {
      set.delete(handler as EventHandler);
    };
  }

  public getTimeline(limit = 100, correlationId?: string): MeghAIEvent[] {
    let result = this.timeline;
    if (correlationId) {
      result = result.filter(e => e.correlationId === correlationId);
    }
    return result.slice(-limit).reverse();
  }

  public clearTimeline(): void {
    this.timeline = [];
  }
}
