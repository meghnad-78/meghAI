import React from 'react';
import type { AIState, MicrophoneState, VoiceInputState } from '@meghai/shared-types';
import { StatusIndicator } from './ui/StatusIndicator.js';
import { tokens } from '../theme/tokens.js';

interface TopBarProps {
  aiState: AIState;
  micState: MicrophoneState;
  voiceInputState: VoiceInputState;
  micLevel: number;
  onlineStatus: string;
  autoSpeak: 'OFF' | 'ON' | 'ASK';
  selectedModel: string;
  selectedVoiceName: string;
  selectedPersonalityName?: string;
  eventCount: number;
  activeTab: string;
  onSelectTab: (tab: any) => void;
  onToggleAutoSpeak: () => void;
  onToggleMic: () => void;
  onOpenModelSelector: () => void;
  onOpenVoiceSelector: () => void;
  onOpenPersonalitySelector?: () => void;
  onToggleTimeline: () => void;
  onEmergencyStop: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  aiState,
  micState,
  voiceInputState,
  micLevel,
  onlineStatus,
  autoSpeak,
  selectedModel,
  selectedVoiceName,
  selectedPersonalityName = 'Futuristic',
  eventCount,
  activeTab,
  onSelectTab,
  onToggleAutoSpeak,
  onToggleMic,
  onOpenModelSelector,
  onOpenVoiceSelector,
  onOpenPersonalitySelector,
  onToggleTimeline,
  onEmergencyStop
}) => {
  const isMicListening = micState === 'MIC_LISTENING';

  const getMicColor = () => {
    if (isMicListening) {
      if (voiceInputState === 'COMMAND_CAPTURE') return tokens.colors.accent.rose;
      if (voiceInputState === 'WAKE_CONFIRMED') return tokens.colors.accent.cyan;
      if (voiceInputState === 'TRANSCRIBING') return tokens.colors.accent.amber;
      return tokens.colors.accent.emerald;
    }
    return tokens.colors.text.muted;
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 20px',
        background: 'rgba(4, 6, 10, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        zIndex: tokens.zIndex.header,
        position: 'relative',
        userSelect: 'none'
      }}
    >
      {/* Left: Brand & AI Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          onClick={() => onSelectTab('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer'
          }}
        >
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: tokens.radii.sm,
              background: 'linear-gradient(135deg, #00F0FF 0%, #A855F7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: tokens.shadows.glowCyan
            }}
          >
            <span style={{ fontWeight: 800, fontSize: '13px', color: '#04060A' }}>M</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 700, fontSize: tokens.typography.sizes.sm, letterSpacing: '-0.02em', color: tokens.colors.text.primary }}>
              MeghAI
            </span>
            <span style={{ fontSize: '10px', color: tokens.colors.text.muted, fontWeight: 500 }}>
              v0.1
            </span>
          </div>
        </div>

        <div style={{ width: '1px', height: '14px', background: tokens.colors.border.default }} />

        {/* Global AI State & Connectivity */}
        <StatusIndicator state={aiState} size="sm" />
        <span
          style={{
            fontSize: '11px',
            color: onlineStatus === 'ONLINE' ? tokens.colors.accent.emerald : tokens.colors.accent.amber,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
          title={`System status: ${onlineStatus}`}
        >
          ● {onlineStatus === 'ONLINE' ? 'Cloud' : 'Local'}
        </span>
      </div>

      {/* Center: Contextual Navigation Workspace Tabs */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          background: 'rgba(255, 255, 255, 0.025)',
          padding: '3px',
          borderRadius: tokens.radii.md,
          border: `1px solid ${tokens.colors.border.subtle}`
        }}
      >
        {[
          { id: 'home', label: 'Studio' },
          { id: 'notes', label: 'Notes' },
          { id: 'tasks', label: 'Tasks' },
          { id: 'memory', label: 'Memory' },
          { id: 'knowledge', label: 'Graph' },
          { id: 'voice', label: 'Voice' },
          { id: 'providers', label: 'Providers' },
          { id: 'permissions', label: 'Safety' },
          { id: 'routines', label: 'Routines' }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              style={{
                background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: 'none',
                color: isActive ? tokens.colors.text.primary : tokens.colors.text.secondary,
                padding: '4px 10px',
                borderRadius: tokens.radii.sm,
                fontSize: tokens.typography.sizes.xs,
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                transition: tokens.transitions.fast
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Right: Quick Controls, Model, Voice & Emergency Kill Switch */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Model Selector Pill */}
        <button
          onClick={onOpenModelSelector}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 9px',
            color: tokens.colors.text.primary,
            fontSize: tokens.typography.sizes.xs,
            cursor: 'pointer',
            transition: tokens.transitions.fast
          }}
          title="Change active model provider"
        >
          <span style={{ color: tokens.colors.accent.cyan, fontSize: '11px' }}>✦</span>
          <span style={{ fontWeight: 600 }}>{selectedModel.toUpperCase()}</span>
          <span style={{ fontSize: '9px', color: tokens.colors.text.muted }}>▼</span>
        </button>

        {/* Voice Persona Pill */}
        <button
          onClick={onOpenVoiceSelector}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 9px',
            color: tokens.colors.text.primary,
            fontSize: tokens.typography.sizes.xs,
            cursor: 'pointer',
            transition: tokens.transitions.fast
          }}
          title="Select synthesis voice"
        >
          <span style={{ color: tokens.colors.accent.purple, fontSize: '11px' }}>🗣️</span>
          <span style={{ fontWeight: 500 }}>{selectedVoiceName}</span>
          <span style={{ fontSize: '9px', color: tokens.colors.text.muted }}>▼</span>
        </button>

        {/* Personality Persona Pill */}
        <button
          onClick={onOpenPersonalitySelector}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 9px',
            color: tokens.colors.text.primary,
            fontSize: tokens.typography.sizes.xs,
            cursor: 'pointer',
            transition: tokens.transitions.fast
          }}
          title="Select active AI personality & behavioral style"
        >
          <span style={{ color: tokens.colors.accent.amber, fontSize: '11px' }}>🎭</span>
          <span style={{ fontWeight: 500 }}>{selectedPersonalityName}</span>
          <span style={{ fontSize: '9px', color: tokens.colors.text.muted }}>▼</span>
        </button>

        {/* Auto-Speak Toggle */}
        <button
          onClick={onToggleAutoSpeak}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: autoSpeak === 'ON' ? tokens.colors.accent.cyanMuted : 'transparent',
            border: `1px solid ${autoSpeak === 'ON' ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 8px',
            color: autoSpeak === 'ON' ? tokens.colors.accent.cyan : tokens.colors.text.muted,
            fontSize: tokens.typography.sizes.xs,
            fontWeight: 500,
            cursor: 'pointer'
          }}
          title={`Speech playback: ${autoSpeak}`}
        >
          <span>{autoSpeak === 'ON' ? '🔊' : '🔇'}</span>
        </button>

        {/* Native Microphone Button with Live Waveform */}
        <button
          onClick={onToggleMic}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: isMicListening ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 255, 255, 0.03)',
            border: `1px solid ${isMicListening ? 'rgba(239, 68, 68, 0.4)' : tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 10px',
            color: isMicListening ? '#FCA5A5' : tokens.colors.text.secondary,
            fontSize: tokens.typography.sizes.xs,
            fontWeight: 500,
            cursor: 'pointer',
            transition: tokens.transitions.fast
          }}
          title={isMicListening ? 'Listening (click to stop)' : 'Microphone idle (click to start)'}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: getMicColor(),
              boxShadow: isMicListening ? '0 0 8px rgba(239, 68, 68, 0.8)' : 'none'
            }}
          />
          <span>{isMicListening ? 'Listening' : 'Mic'}</span>

          {isMicListening && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '10px' }}>
              {[0.5, 1.0, 0.7, 0.9].map((f, i) => {
                const h = Math.max(2, Math.min(10, Math.round((micLevel || 0.1) * f * 10)));
                return (
                  <span
                    key={i}
                    style={{
                      width: '2px',
                      height: `${h}px`,
                      backgroundColor: '#EF4444',
                      borderRadius: '1px'
                    }}
                  />
                );
              })}
            </div>
          )}
        </button>

        {/* Action Timeline Toggle */}
        <button
          onClick={onToggleTimeline}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'transparent',
            border: `1px solid ${tokens.colors.border.subtle}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 8px',
            color: tokens.colors.text.secondary,
            fontSize: tokens.typography.sizes.xs,
            cursor: 'pointer'
          }}
          title="Open Action Timeline Drawer"
        >
          <span>⚡</span>
          <span style={{ fontSize: '10px', color: tokens.colors.text.muted }}>{eventCount}</span>
        </button>

        {/* Emergency Kill Switch */}
        <button
          onClick={onEmergencyStop}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#FCA5A5',
            padding: '4px 10px',
            borderRadius: tokens.radii.sm,
            fontSize: tokens.typography.sizes.xs,
            fontWeight: 700,
            cursor: 'pointer',
            transition: tokens.transitions.fast
          }}
          title="Emergency Stop: Halt all AI models, tools, audio & loops"
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '1px', backgroundColor: '#EF4444' }} />
          STOP
        </button>
      </div>
    </header>
  );
};
