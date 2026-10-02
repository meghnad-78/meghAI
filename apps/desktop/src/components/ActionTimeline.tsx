import React from 'react';
import type { MeghAIEvent } from '@meghai/shared-types';

interface ActionTimelineProps {
  events: MeghAIEvent[];
}

export const ActionTimeline: React.FC<ActionTimelineProps> = ({ events }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(11, 15, 25, 0.6)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '16px',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.04em', color: '#94a3b8', textTransform: 'uppercase' }}>
          Action Timeline
        </span>
        <span style={{ fontSize: '11px', color: '#64748b' }}>
          {events.length} events
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {events.length === 0 ? (
          <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', marginTop: '40px' }}>
            System ready. Operational events will stream here live.
          </div>
        ) : (
          events.map(event => {
            const time = new Date(event.timestamp).toLocaleTimeString();
            const isKill = event.type === 'KILL_SWITCH_ACTIVATED';
            const isVerified = event.type === 'VERIFICATION_COMPLETED';
            const isTool = event.type === 'TOOL_REQUESTED' || event.type === 'TOOL_COMPLETED';

            return (
              <div
                key={event.id}
                style={{
                  display: 'flex',
                  gap: '10px',
                  fontSize: '12px',
                  lineHeight: '1.4',
                  padding: '8px',
                  borderRadius: '6px',
                  background: isKill ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                  borderLeft: `2px solid ${isKill ? '#ef4444' : isVerified ? '#10b981' : isTool ? '#38bdf8' : '#64748b'}`
                }}
              >
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', color: '#64748b', flexShrink: 0 }}>
                  {time}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <span style={{ fontWeight: 600, color: isKill ? '#f87171' : isVerified ? '#34d399' : '#e2e8f0' }}>
                    {event.type.replace(/_/g, ' ')}
                  </span>
                  {Boolean(event.payload && typeof event.payload === 'object') && (
                    <span style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-word' }}>
                      {JSON.stringify(event.payload).slice(0, 80)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
