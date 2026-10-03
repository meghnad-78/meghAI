import React, { useState } from 'react';
import type { MeghAIEvent } from '@meghai/shared-types';
import { Badge } from './ui/Badge.js';
import { tokens } from '../theme/tokens.js';

interface ActionTimelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: MeghAIEvent[];
}

type TimelineFilter = 'ALL' | 'AI' | 'TOOLS' | 'WINDOWS' | 'VOICE' | 'MEMORY' | 'ERRORS';

export const ActionTimelineDrawer: React.FC<ActionTimelineDrawerProps> = ({
  isOpen,
  onClose,
  events
}) => {
  const [filter, setFilter] = useState<TimelineFilter>('ALL');

  if (!isOpen) return null;

  const filteredEvents = events.filter(e => {
    if (filter === 'ALL') return true;
    if (filter === 'ERRORS') {
      return e.type.includes('FAIL') || e.type.includes('ERROR') || e.type.includes('RATE_LIMITED');
    }
    if (filter === 'AI') {
      return e.type.startsWith('MODEL_') || e.type.startsWith('AI_') || e.type.startsWith('TASK_');
    }
    if (filter === 'TOOLS') {
      return e.type.startsWith('TOOL_') || e.type.startsWith('RISK_') || e.type.startsWith('PERMISSION_');
    }
    if (filter === 'WINDOWS') {
      return e.type.startsWith('WINDOWS_');
    }
    if (filter === 'VOICE') {
      return e.type.startsWith('VOICE_') || e.type.startsWith('MIC_') || e.type.startsWith('VAD_') || e.type.startsWith('TTS_') || e.type.startsWith('TRANSCRIPT_');
    }
    if (filter === 'MEMORY') {
      return e.type.startsWith('MEMORY_') || e.type.startsWith('CONTEXT_');
    }
    return true;
  });

  const getEventCategoryColor = (type: string) => {
    if (type.includes('FAIL') || type.includes('ERROR') || type.includes('RATE_LIMITED') || type === 'KILL_SWITCH_ACTIVATED') {
      return tokens.colors.accent.rose;
    }
    if (type.startsWith('MODEL_') || type.startsWith('TASK_')) {
      return tokens.colors.accent.purple;
    }
    if (type.startsWith('VOICE_') || type.startsWith('TTS_') || type.startsWith('MIC_')) {
      return tokens.colors.accent.cyan;
    }
    if (type.startsWith('MEMORY_')) {
      return tokens.colors.accent.amber;
    }
    if (type.includes('VERIF') || type.includes('COMPLETED')) {
      return tokens.colors.accent.emerald;
    }
    return tokens.colors.text.muted;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: tokens.zIndex.drawer,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(4, 6, 10, 0.45)',
        backdropFilter: 'blur(8px)',
        userSelect: 'none'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          height: '100%',
          background: tokens.colors.bg.surface,
          borderLeft: `1px solid ${tokens.colors.border.default}`,
          boxShadow: tokens.shadows.floating,
          display: 'flex',
          flexDirection: 'column',
          animation: 'megh-fade-in 0.2s ease-out'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: tokens.typography.sizes.md, fontWeight: 700, color: tokens.colors.text.primary }}>
              Action Timeline
            </span>
            <Badge variant="neutral" size="sm">{events.length}</Badge>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.colors.text.muted,
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Category Filters */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '10px 16px',
            overflowX: 'auto',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`
          }}
        >
          {(['ALL', 'AI', 'VOICE', 'TOOLS', 'MEMORY', 'WINDOWS', 'ERRORS'] as TimelineFilter[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                background: filter === cat ? tokens.colors.accent.cyanMuted : 'transparent',
                border: `1px solid ${filter === cat ? tokens.colors.border.accent : 'transparent'}`,
                borderRadius: tokens.radii.sm,
                padding: '3px 8px',
                color: filter === cat ? tokens.colors.accent.cyan : tokens.colors.text.muted,
                fontSize: '10.5px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Event List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          {filteredEvents.length === 0 ? (
            <div style={{ textAlign: 'center', color: tokens.colors.text.muted, fontSize: tokens.typography.sizes.xs, marginTop: '40px' }}>
              No events found for this filter.
            </div>
          ) : (
            filteredEvents.map(event => {
              const time = new Date(event.timestamp).toLocaleTimeString();
              const categoryColor = getEventCategoryColor(event.type);

              return (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    padding: '10px 12px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderLeft: `2px solid ${categoryColor}`,
                    borderRadius: `0 ${tokens.radii.sm} ${tokens.radii.sm} 0`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: tokens.typography.sizes.xs, color: categoryColor }}>
                      {event.type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '10px', color: tokens.colors.text.faint, fontFamily: tokens.typography.fontMono }}>
                      {time}
                    </span>
                  </div>

                  {Boolean(event.payload && typeof event.payload === 'object') && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: tokens.colors.text.secondary,
                        fontFamily: tokens.typography.fontMono,
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '6px 8px',
                        borderRadius: tokens.radii.xs,
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        marginTop: '2px'
                      }}
                    >
                      {JSON.stringify(event.payload, null, 2).slice(0, 240)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
