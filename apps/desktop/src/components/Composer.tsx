import React, { useState, useRef } from 'react';
import type { MicrophoneState, VoiceInputState } from '@meghai/shared-types';
import { MicIcon, MicOffIcon, SendIcon, CommandIcon, ModelIcon } from './ui/Icons.js';

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
  const isTranscribing = voiceInputState === 'TRANSCRIBING';
  const isCapturing = voiceInputState === 'COMMAND_CAPTURE' || (voiceInputState as string) === 'COMMAND_LISTENING';
  const showTranscriptChip = liveTranscript || isCapturing || isTranscribing;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSend(value);
    }
  };

  const canSend = !!value.trim() && !disabled;

  return (
    <div className="composer-island">
      {/* Live transcription chip */}
      {showTranscriptChip && (
        <div
          className={`composer-transcript-chip ${isTranscribing ? 'transcribing' : 'capturing'}`}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'currentColor',
              flexShrink: 0,
              animation: 'megh-blink 1.2s ease infinite'
            }}
          />
          <span>
            {isTranscribing
              ? 'TRANSCRIBING AUDIO STREAM'
              : liveTranscript
              ? `"${liveTranscript}"`
              : 'CAPTURING SPOKEN COMMAND'}
          </span>
        </div>
      )}

      {/* Main input field */}
      <div className={`composer-field${isFocused ? ' focused' : ''}`}>
        {/* Model pill */}
        <button
          className="composer-model-pill"
          onClick={onOpenModelSelector}
          title="Select model provider"
        >
          <ModelIcon size={10} color="#4fa8b5" />
          <span>{selectedModel.replace('local-', '').toUpperCase()}</span>
        </button>

        {/* Text input */}
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
          className="composer-input"
          aria-label="Command input"
        />

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {/* Mic */}
          <button
            className={`composer-action-btn${isMicListening ? ' active' : ''}`}
            onClick={onToggleMic}
            title={isMicListening
              ? `Listening (${voiceInputState}, ${Math.round((micLevel || 0) * 100)}% level). Click to pause.`
              : 'Start voice input'}
            aria-label={isMicListening ? 'Stop microphone' : 'Start microphone'}
          >
            {isMicListening ? <MicIcon size={13} /> : <MicOffIcon size={13} />}
          </button>

          {/* Command palette */}
          <button
            className="composer-action-btn"
            onClick={onOpenPalette}
            title="Open command palette (Ctrl+Space)"
            aria-label="Open command palette"
          >
            <CommandIcon size={12} />
          </button>

          {/* Send */}
          <button
            className={`composer-send-btn ${canSend ? 'ready' : 'idle'}`}
            disabled={!canSend}
            onClick={() => canSend && onSend(value)}
            aria-label="Send command"
          >
            <span>SEND</span>
            <SendIcon size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};
