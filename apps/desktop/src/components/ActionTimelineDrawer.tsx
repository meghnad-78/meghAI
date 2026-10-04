import React, { useState } from 'react';
import type { MeghAIEvent } from '@meghai/shared-types';
import { TimelineIcon, CloseIcon } from './ui/Icons.js';
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
      return tokens.colors.semantic.error;
    }
    if (type.startsWith('MODEL_') || type.startsWith('TASK_')) {
      return tokens.colors.accent.primary;
    }
    if (type.startsWith('VOICE_') || type.startsWith('TTS_') || type.startsWith('MIC_')) {
      return tokens.colors.accent.primary;
    }
    if (type.startsWith('MEMORY_')) {
      return tokens.colors.semantic.warning;
    }
    if (type.includes('VERIF') || type.includes('COMPLETED')) {
      return tokens.colors.semantic.success;
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
        backgroundColor: tokens.colors.bg.overlay,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        userSelect: 'none'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          height: '100%',
          backgroundColor: tokens.colors.bg.surface,
          borderLeft: `1px solid ${tokens.colors.border.strong}`,
          display: 'flex',
          flexDirection: 'column'
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
            <TimelineIcon size={16} color={tokens.colors.accent.primary} />
            <span
              style={{
                fontFamily: tokens.typography.fontDisplay,
                fontSize: tokens.typography.sizes.md,
                fontWeight: 700,
                color: tokens.colors.text.primary
              }}
            >
              Action Timeline
            </span>
            <span
              style={{
                fontFamily: tokens.typography.fontMono,
                fontSize: '10px',
                color: tokens.colors.text.faint,
                padding: '1px 5px',
                border: `1px solid ${tokens.colors.border.subtle}`,
                borderRadius: tokens.radii.xs
              }}
            >
              {events.length}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.colors.text.muted,
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Category Filters */}
        <div
          style={{
            display: 'flex',
            gap: '4px',
            padding: '10px 16px',
            overflowX: 'auto',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            backgroundColor: tokens.colors.bg.subtle
          }}
        >
          {(['ALL', 'AI', 'VOICE', 'TOOLS', 'MEMORY', 'WINDOWS', 'ERRORS'] as TimelineFilter[]).map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                background: filter === cat ? tokens.colors.accent.primarySubtle : tokens.colors.bg.surface,
                border: `1px solid ${filter === cat ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                borderRadius: tokens.radii.xs,
                padding: '3px 8px',
                color: filter === cat ? tokens.colors.accent.primary : tokens.colors.text.muted,
                fontSize: '10.5px',
                fontFamily: tokens.typography.fontMono,
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
            gap: '8px'
          }}
        >
          {filteredEvents.length === 0 ? (
            <div style={{ textAlign: 'center', color: tokens.colors.text.muted, fontSize: tokens.typography.sizes.xs, marginTop: '40px' }}>
              No recorded events for this category.
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
                    padding: '9px 12px',
                    backgroundColor: tokens.colors.bg.elevated,
                    border: `1px solid ${tokens.colors.border.subtle}`,
                    borderLeft: `2px solid ${categoryColor}`,
                    borderRadius: tokens.radii.xs
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, fontSize: tokens.typography.sizes.xs, color: categoryColor, fontFamily: tokens.typography.fontMono }}>
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
                        background: 'rgba(0, 0, 0, 0.35)',
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
