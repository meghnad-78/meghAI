import React, { useState, useRef } from 'react';
import type { MicrophoneState, VoiceInputState } from '@meghai/shared-types';
import {
  MicIcon,
  MicOffIcon,
  SendIcon,
  CommandIcon,
  ModelIcon
} from './ui/Icons.js';
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
        maxWidth: '820px',
        margin: '0 auto',
        padding: '0 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        position: 'relative',
        zIndex: tokens.zIndex.surface
      }}
    >
      {/* Integrated Live Voice Transcription Substrate */}
      {(liveTranscript || voiceInputState === 'COMMAND_CAPTURE' || (voiceInputState as any) === 'COMMAND_LISTENING' || voiceInputState === 'TRANSCRIBING') && (
        <div
          style={{
            alignSelf: 'flex-start',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: tokens.colors.bg.elevated,
            border: `1px solid ${voiceInputState === 'TRANSCRIBING' ? tokens.colors.semantic.warning : tokens.colors.border.accent}`,
            borderRadius: tokens.radii.sm,
            padding: '3px 10px',
            fontSize: tokens.typography.sizes.xs,
            color: voiceInputState === 'TRANSCRIBING' ? tokens.colors.semantic.warning : tokens.colors.accent.primary,
            fontFamily: tokens.typography.fontMono
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: voiceInputState === 'TRANSCRIBING' ? tokens.colors.semantic.warning : tokens.colors.accent.primary
            }}
          />
          <span>
            {voiceInputState === 'TRANSCRIBING'
              ? 'TRANSCRIBING AUDIO STREAM'
              : liveTranscript
              ? `"${liveTranscript}"`
              : 'CAPTURING SPOKEN COMMAND (NATURAL PAUSE SUPPORTED)'}
          </span>
        </div>
      )}

      {/* Monolithic Dark Mineral Command Composer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 12px',
          backgroundColor: isFocused ? tokens.colors.bg.active : tokens.colors.bg.surface,
          border: `1px solid ${isFocused ? tokens.colors.border.focus : tokens.colors.border.default}`,
          borderRadius: tokens.radii.md,
          transition: tokens.transitions.fast
        }}
      >
        {/* Model Trigger */}
        <button
          onClick={onOpenModelSelector}
          title="Select AI Model Provider"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            background: tokens.colors.bg.elevated,
            border: `1px solid ${tokens.colors.border.subtle}`,
            borderRadius: tokens.radii.xs,
            padding: '3px 7px',
            color: tokens.colors.text.secondary,
            fontSize: tokens.typography.sizes.xs,
            fontFamily: tokens.typography.fontMono,
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <ModelIcon size={12} color={tokens.colors.accent.primary} />
          <span>{selectedModel.replace('local-', '').toUpperCase()}</span>
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
          placeholder="Command MeghAI, query memory, execute tools... (Ctrl+Space)"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: tokens.colors.text.primary,
            fontSize: tokens.typography.sizes.sm,
            fontFamily: tokens.typography.fontSans,
            lineHeight: 1.4
          }}
        />

        {/* Tactical Actions: Mic, Command Palette & Send */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Microphone Capture Button */}
          <button
            onClick={onToggleMic}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: tokens.radii.xs,
              backgroundColor: isMicListening ? tokens.colors.semantic.errorMuted : tokens.colors.bg.elevated,
              border: `1px solid ${isMicListening ? tokens.colors.semantic.error : tokens.colors.border.default}`,
              color: isMicListening ? '#f8b4b0' : tokens.colors.text.secondary,
              cursor: 'pointer'
            }}
            title={isMicListening ? `Listening (${voiceInputState}, ${Math.round((micLevel || 0) * 100)}% acoustic level). Click to pause.` : 'Click to start voice input'}
          >
            {isMicListening ? <MicIcon size={14} /> : <MicOffIcon size={14} />}
          </button>

          {/* Quick Command Palette Button */}
          <button
            onClick={onOpenPalette}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: tokens.radii.xs,
              backgroundColor: tokens.colors.bg.elevated,
              border: `1px solid ${tokens.colors.border.default}`,
              color: tokens.colors.text.muted,
              cursor: 'pointer'
            }}
            title="Open Command Palette (Ctrl+Space)"
          >
            <CommandIcon size={13} />
          </button>

          {/* Send Execution Button */}
          <button
            disabled={!value.trim() || disabled}
            onClick={() => onSend(value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
              height: '28px',
              padding: '0 12px',
              borderRadius: tokens.radii.xs,
              backgroundColor: value.trim() ? tokens.colors.accent.primary : tokens.colors.bg.elevated,
              border: `1px solid ${value.trim() ? tokens.colors.accent.primary : tokens.colors.border.default}`,
              color: value.trim() ? tokens.colors.text.inverse : tokens.colors.text.faint,
              fontFamily: tokens.typography.fontSans,
              fontSize: tokens.typography.sizes.xs,
              fontWeight: 600,
              cursor: value.trim() && !disabled ? 'pointer' : 'default'
            }}
          >
            <span>SEND</span>
            <SendIcon size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};
