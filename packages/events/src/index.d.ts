import type { EventType, MeghAIEvent } from '@meghai/shared-types';
export type EventHandler<T = unknown> = (event: MeghAIEvent<T>) => void;
/**
 * High-Performance Typed Event Bus & Action Timeline Engine (Section 105 & 134)
 */
export declare class EventBus {
    private handlers;
    private timeline;
    private maxTimelineSize;
    publish<T = unknown>(type: EventType, payload: T, correlationId?: string, source?: string): MeghAIEvent<T>;
    subscribe<T = unknown>(type: EventType | '*', handler: EventHandler<T>): () => void;
    getTimeline(limit?: number, correlationId?: string): MeghAIEvent[];
    clearTimeline(): void;
}
//# sourceMappingURL=index.d.ts.map