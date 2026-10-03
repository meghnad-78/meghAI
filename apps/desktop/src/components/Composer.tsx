import React, { useState, useRef } from 'react';
import type { MicrophoneState, VoiceInputState } from '@meghai/shared-types';
import { GlassSurface } from './ui/GlassSurface.js';
import { Button } from './ui/Button.js';
import { tokens } from '../theme/tokens.js';

interface ComposerProps {
  value: string;
  onChange: (val: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  selectedModel: string;
  onOpenModelSelector: () => void;
  micState: MicrophoneState;
  voiceInputState: VoiceInputState;
  micLevel: number;
  onToggleMic: () => void;
  liveTranscript: string | null;
  onOpenPalette: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  selectedModel,
  onOpenModelSelector,
  micState,
  voiceInputState,
  micLevel,
  onToggleMic,
  liveTranscript,
  onOpenPalette
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isMicListening = micState === 'MIC_LISTENING';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSend(value);
      }
    }
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '780px',
        margin: '0 auto',
        padding: '0 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        zIndex: tokens.zIndex.surface
      }}
    >
      {/* Live Audio Transcript Preview Chip */}
      {(liveTranscript || voiceInputState === 'COMMAND_CAPTURE' || (voiceInputState as any) === 'COMMAND_LISTENING' || voiceInputState === 'TRANSCRIBING') && (
        <div
          style={{
            alignSelf: 'center',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0, 240, 255, 0.08)',
            border: `1px solid ${tokens.colors.border.accent}`,
            borderRadius: tokens.radii.pill,
            padding: '4px 14px',
            fontSize: tokens.typography.sizes.xs,
            color: tokens.colors.accent.cyan,
            boxShadow: tokens.shadows.glowCyan,
            backdropFilter: 'blur(12px)',
            animation: 'megh-fade-in 0.2s ease-out'
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: tokens.colors.accent.cyan,
              animation: 'megh-pulse 1.4s infinite'
            }}
          />
          <span style={{ fontStyle: 'italic' }}>
            {voiceInputState === 'TRANSCRIBING'
              ? '⚡ Transcribing audio...'
              : liveTranscript
              ? `"${liveTranscript}..."`
              : '🎙️ Listening... (natural pauses supported up to 2.2s)'}
          </span>
        </div>
      )}

      {/* Main Composer Box */}
      <GlassSurface
        elevation={isFocused ? 'floating' : 'surface'}
        glow={isFocused}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 14px',
          borderRadius: tokens.radii.xl,
          border: `1px solid ${isFocused ? tokens.colors.border.accent : tokens.colors.border.default}`,
          boxShadow: isFocused ? tokens.shadows.glowCyan : tokens.shadows.elevated,
          transition: tokens.transitions.normal
        }}
      >
        {/* Model Selector Badge Button */}
        <button
          onClick={onOpenModelSelector}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: `1px solid ${tokens.colors.border.subtle}`,
            borderRadius: tokens.radii.sm,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            color: tokens.colors.text.secondary,
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: tokens.transitions.fast,
            flexShrink: 0
          }}
          title="Switch AI model provider"
        >
          <span style={{ color: tokens.colors.accent.cyan }}>✦</span>
          <span>{selectedModel.toUpperCase()}</span>
        </button>

        {/* Input Text Box */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Ask MeghAI, save memory, launch apps, daily brief... (Ctrl+Space)"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: tokens.colors.text.primary,
            fontSize: tokens.typography.sizes.sm,
            fontFamily: tokens.typography.fontSans,
            lineHeight: 1.5
          }}
        />

        {/* Action Controls: Mic, Command Palette & Send */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Microphone button */}
          <button
            onClick={onToggleMic}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: isMicListening ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${isMicListening ? '#EF4444' : tokens.colors.border.default}`,
              color: isMicListening ? '#FCA5A5' : tokens.colors.text.secondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '13px',
              transform: isMicListening ? `scale(${Math.min(1.25, 1 + micLevel * 0.3)})` : 'scale(1)',
              transition: tokens.transitions.fast
            }}
            title={isMicListening ? `Voice listening (${voiceInputState}). Click to stop.` : 'Voice input. Click to listen.'}
          >
            {isMicListening ? '🎙️' : '🎤'}
          </button>

          {/* Quick Command Palette Button */}
          <button
            onClick={onOpenPalette}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${tokens.colors.border.default}`,
              color: tokens.colors.text.muted,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Open Universal Command Palette (Ctrl+Space)"
          >
            ⌘
          </button>

          {/* Send Button */}
          <Button
            size="sm"
            variant="primary"
            disabled={!value.trim() || disabled}
            onClick={() => onSend(value)}
            style={{ borderRadius: tokens.radii.pill, padding: '6px 14px' }}
          >
            Send
          </Button>
        </div>
      </GlassSurface>
    </div>
  );
};
