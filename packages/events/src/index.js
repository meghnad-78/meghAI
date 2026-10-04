import crypto from 'node:crypto';
/**
 * High-Performance Typed Event Bus & Action Timeline Engine (Section 105 & 134)
 */
export class EventBus {
    handlers = new Map();
    timeline = [];
    maxTimelineSize = 1000;
    publish(type, payload, correlationId, source = 'SYSTEM') {
        const event = {
            id: `evt-${crypto.randomUUID()}`,
            type,
            timestamp: new Date().toISOString(),
            payload,
            correlationId,
            source
        };
        // Store in timeline
        this.timeline.push(event);
        if (this.timeline.length > this.maxTimelineSize) {
            this.timeline.shift();
        }
        // Direct type listeners
        const listeners = this.handlers.get(type);
        if (listeners) {
            for (const fn of listeners) {
                try {
                    fn(event);
                }
                catch (err) {
                    console.error(`[EventBus] Handler error for ${type}:`, err);
                }
            }
        }
        // Wildcard listeners
        const wildcard = this.handlers.get('*');
        if (wildcard) {
            for (const fn of wildcard) {
                try {
                    fn(event);
                }
                catch (err) {
                    console.error(`[EventBus] Wildcard handler error:`, err);
                }
            }
        }
        return event;
    }
    subscribe(type, handler) {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }
        const set = this.handlers.get(type);
        set.add(handler);
        return () => {
            set.delete(handler);
        };
    }
    getTimeline(limit = 100, correlationId) {
        let result = this.timeline;
        if (correlationId) {
            result = result.filter(e => e.correlationId === correlationId);
        }
        return result.slice(-limit).reverse();
    }
    clearTimeline() {
        this.timeline = [];
    }
}
//# sourceMappingURL=index.js.map