import React from 'react';
import type { AIState, MicrophoneState, VoiceInputState } from '@meghai/shared-types';
import {
  MicIcon,
  MicOffIcon,
  VolumeIcon,
  VolumeOffIcon,
  ModelIcon,
  VoiceIcon,
  PersonalityIcon,
  TimelineIcon,
  KillSwitchIcon,
  CompassNodeIcon
} from './ui/Icons.js';
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

  const workspaces = [
    { id: 'home', label: 'Console' },
    { id: 'voice', label: 'Voice Studio' },
    { id: 'memory', label: 'Memory' },
    { id: 'knowledge', label: 'Knowledge' },
    { id: 'notes', label: 'Notes' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'routines', label: 'Routines' },
    { id: 'providers', label: 'Providers' },
    { id: 'permissions', label: 'Safety' }
  ];

  const getMicStatusColor = () => {
    if (!isMicListening) return tokens.colors.text.muted;
    if (voiceInputState === 'COMMAND_CAPTURE') return tokens.colors.semantic.error;
    if (voiceInputState === 'WAKE_CONFIRMED' || voiceInputState === 'WAKE_DETECTED') return tokens.colors.accent.primary;
    if (voiceInputState === 'TRANSCRIBING') return tokens.colors.semantic.warning;
    return tokens.colors.semantic.success;
  };

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: '48px',
        backgroundColor: tokens.colors.bg.canvas,
        borderBottom: `1px solid ${tokens.colors.border.subtle}`,
        zIndex: tokens.zIndex.header,
        position: 'relative',
        userSelect: 'none'
      }}
    >
      {/* Left: Brand Identity & Active Workspace Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div
          onClick={() => onSelectTab('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <CompassNodeIcon size={16} color={tokens.colors.accent.primary} />
          <span
            style={{
              fontFamily: tokens.typography.fontDisplay,
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '-0.02em',
              color: tokens.colors.text.primary
            }}
          >
            MEGH<span style={{ color: tokens.colors.accent.primary }}>AI</span>
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
            v0.1
          </span>
          <span
            title={`Network: ${onlineStatus} • Kernel State: ${aiState}`}
            style={{
              fontFamily: tokens.typography.fontMono,
              fontSize: '10px',
              color: onlineStatus === 'ONLINE' ? tokens.colors.semantic.success : tokens.colors.semantic.warning,
              padding: '1px 5px',
              border: `1px solid ${tokens.colors.border.subtle}`,
              borderRadius: tokens.radii.xs,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: onlineStatus === 'ONLINE' ? tokens.colors.semantic.success : tokens.colors.semantic.warning }} />
            {aiState}
          </span>
        </div>

        <div style={{ width: '1px', height: '16px', backgroundColor: tokens.colors.border.default }} />

        {/* Minimal Spatial Workspace Navigation */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          {workspaces.map(ws => {
            const isActive = activeTab === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => onSelectTab(ws.id)}
                style={{
                  background: isActive ? tokens.colors.bg.elevated : 'transparent',
                  border: `1px solid ${isActive ? tokens.colors.border.default : 'transparent'}`,
                  borderRadius: tokens.radii.sm,
                  padding: '4px 10px',
                  color: isActive ? tokens.colors.text.primary : tokens.colors.text.muted,
                  fontSize: tokens.typography.sizes.sm,
                  fontFamily: tokens.typography.fontSans,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: tokens.transitions.fast
                }}
              >
                {ws.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: Operational Controls & Subsystem Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Model Selector Trigger */}
        <button
          onClick={onOpenModelSelector}
          title="Active Model Provider"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: tokens.colors.bg.surface,
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 9px',
            color: tokens.colors.text.secondary,
            fontSize: tokens.typography.sizes.xs,
            fontFamily: tokens.typography.fontMono,
            cursor: 'pointer'
          }}
        >
          <ModelIcon size={13} color={tokens.colors.accent.primary} />
          <span>{selectedModel.replace('local-', '').toUpperCase()}</span>
        </button>

        {/* Voice Selector Trigger */}
        <button
          onClick={onOpenVoiceSelector}
          title="Active Voice Profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: tokens.colors.bg.surface,
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 9px',
            color: tokens.colors.text.secondary,
            fontSize: tokens.typography.sizes.xs,
            fontFamily: tokens.typography.fontSans,
            cursor: 'pointer'
          }}
        >
          <VoiceIcon size={13} color={tokens.colors.accent.primary} />
          <span>{selectedVoiceName}</span>
        </button>

        {/* Personality Selector Trigger */}
        {onOpenPersonalitySelector && (
          <button
            onClick={onOpenPersonalitySelector}
            title="Active Behavioral Personality"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: tokens.colors.bg.surface,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '4px 9px',
              color: tokens.colors.text.secondary,
              fontSize: tokens.typography.sizes.xs,
              fontFamily: tokens.typography.fontSans,
              cursor: 'pointer'
            }}
          >
            <PersonalityIcon size={13} color={tokens.colors.accent.primary} />
            <span>{selectedPersonalityName}</span>
          </button>
        )}

        {/* AutoSpeak Mode Toggle */}
        <button
          onClick={onToggleAutoSpeak}
          title={`Auto-Speak Mode: ${autoSpeak}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: autoSpeak === 'ON' ? tokens.colors.accent.primarySubtle : tokens.colors.bg.surface,
            border: `1px solid ${autoSpeak === 'ON' ? tokens.colors.border.accent : tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 8px',
            color: autoSpeak === 'ON' ? tokens.colors.accent.primary : tokens.colors.text.muted,
            fontSize: tokens.typography.sizes.xs,
            cursor: 'pointer'
          }}
        >
          {autoSpeak === 'ON' ? <VolumeIcon size={13} /> : <VolumeOffIcon size={13} />}
          <span style={{ fontFamily: tokens.typography.fontMono, fontSize: '10px' }}>{autoSpeak}</span>
        </button>

        {/* Microphone Capture Indicator & Toggle */}
        <button
          onClick={onToggleMic}
          title={isMicListening ? `Mic active (${voiceInputState}). Click to pause.` : 'Mic paused. Click to capture.'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: isMicListening ? tokens.colors.bg.elevated : tokens.colors.bg.surface,
            border: `1px solid ${isMicListening ? getMicStatusColor() : tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 8px',
            color: getMicStatusColor(),
            fontSize: tokens.typography.sizes.xs,
            cursor: 'pointer'
          }}
        >
          {isMicListening ? <MicIcon size={13} /> : <MicOffIcon size={13} />}
          {isMicListening && (
            <div
              style={{
                width: '18px',
                height: '4px',
                background: tokens.colors.bg.surface,
                borderRadius: '2px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, Math.max(10, micLevel * 100))}%`,
                  height: '100%',
                  background: getMicStatusColor(),
                  transition: 'width 0.05s linear'
                }}
              />
            </div>
          )}
        </button>

        <div style={{ width: '1px', height: '16px', backgroundColor: tokens.colors.border.default }} />

        {/* Action Timeline Toggle */}
        <button
          onClick={onToggleTimeline}
          title="Contextual Action Timeline"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: 'transparent',
            border: `1px solid ${tokens.colors.border.subtle}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 8px',
            color: tokens.colors.text.muted,
            fontSize: tokens.typography.sizes.xs,
            fontFamily: tokens.typography.fontMono,
            cursor: 'pointer'
          }}
        >
          <TimelineIcon size={13} />
          <span>{eventCount}</span>
        </button>

        {/* Emergency STOP MEGH / Kill Switch (High-Visibility Vermilion Architectural Button) */}
        <button
          onClick={onEmergencyStop}
          title="Emergency Stop: Halts TTS, cancels active model, and stops tool execution immediately"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: tokens.colors.semantic.errorMuted,
            border: `1px solid ${tokens.colors.semantic.error}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 10px',
            color: '#f8b4b0',
            fontSize: tokens.typography.sizes.xs,
            fontFamily: tokens.typography.fontMono,
            fontWeight: 600,
            cursor: 'pointer',
            transition: tokens.transitions.fast
          }}
        >
          <KillSwitchIcon size={12} color="#f8b4b0" />
          <span>STOP MEGH</span>
        </button>
      </div>
    </header>
  );
};
