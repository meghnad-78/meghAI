import React from 'react';
import type { MeghAIEvent } from '@meghai/shared-types';

interface ActionTrailProps {
  events: MeghAIEvent[];
  isOpen: boolean;
  onToggle: () => void;
}

const EVENT_COLORS: Record<string, string> = {
  ACTION_PLAN_CREATED: '#4fa8b5',
  ACTION_STEP_STARTED: '#5c8fa8',
  ACTION_TOOL_STARTED: '#7a8ea3',
  ACTION_TOOL_COMPLETED: '#589e7c',
  ACTION_VERIFIED: '#589e7c',
  ACTION_PLAN_COMPLETED: '#4fa8b5',
  ACTION_PERMISSION_REQUESTED: '#c6994a',
  ACTION_PERMISSION_GRANTED: '#589e7c',
  TASK_COMPLETED: '#589e7c',
  TASK_FAILED: '#bf5049',
  KILLSWITCH_ACTIVATED: '#bf5049',
  KILLSWITCH_RESET: '#4fa8b5',
  MODEL_STARTED: '#7a8ea3',
  MODEL_COMPLETED: '#589e7c',
  WAKE_DETECTED: '#4fa8b5',
  MIC_LISTENING: '#5cb8c5',
  TRANSCRIPT_FINAL: '#c6994a'
};

const getEventColor = (type: string) => EVENT_COLORS[type] ?? '#3f4551';

const formatEventPayload = (event: MeghAIEvent): string => {
  const p = event.payload as Record<string, unknown> | undefined;
  if (!p) return '';
  // Show the most relevant field without exposing secrets
  if (p.reply && typeof p.reply === 'string') return `"${String(p.reply).slice(0, 80)}${String(p.reply).length > 80 ? '...' : ''}"`;
  if (p.toolId) return `tool:${p.toolId}`;
  if (p.text && typeof p.text === 'string') return `"${String(p.text).slice(0, 60)}..."`;
  if (p.provider) return `provider:${p.provider}`;
  if (p.state) return String(p.state);
  return '';
};

/**
 * ActionTrail — compact inline strip at the bottom of the console.
 * Replaces the side drawer with a minimal collapsible event stream.
 * Shows only the 20 most recent relevant events.
 */
export const ActionTrail: React.FC<ActionTrailProps> = ({
  events,
  isOpen,
  onToggle
}) => {
  // Filter to actionable events only (skip mic level spam)
  const filtered = events
    .filter(e => e.type !== 'MIC_LEVEL' && (e.type as string) !== 'HEARTBEAT')
    .slice(0, 20);

  return (
    <div
      className="action-trail"
      style={{ height: isOpen ? (filtered.length > 0 ? Math.min(filtered.length * 26 + 32, 168) : 40) : 0 }}
    >
      {/* Trail header (always visible when open) */}
      {isOpen && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 20px 2px',
            borderBottom: '1px solid rgba(255,255,255,0.04)'
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.08em',
              color: '#3f4551'
            }}
          >
            ACTION TRAIL
          </span>
          <button
            onClick={onToggle}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              color: '#3f4551',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0 2px'
            }}
          >
            HIDE
          </button>
        </div>
      )}

      {isOpen && filtered.length > 0 && (
        <div className="action-trail-inner">
          {filtered.map((evt, idx) => {
            const color = getEventColor(evt.type);
            const payload = formatEventPayload(evt);
            return (
              <div key={evt.id || idx} className="trail-event">
                <div className="trail-event-dot" style={{ background: color }} />
                <span className="trail-event-type">{evt.type}</span>
                {payload && <span className="trail-event-payload">{payload}</span>}
              </div>
            );
          })}
        </div>
      )}

      {isOpen && filtered.length === 0 && (
        <div
          style={{
            padding: '8px 20px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: '#3f4551'
          }}
        >
          No events yet.
        </div>
      )}
    </div>
  );
};
