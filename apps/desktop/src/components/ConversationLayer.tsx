import React, { useRef, useEffect } from 'react';
import { PlayIcon, StopIcon, CheckIcon } from './ui/Icons.js';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'megh';
  text: string;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
  verificationDetails?: string;
  timestamp: string;
  provider?: string;
  modelId?: string;
}

interface ConversationLayerProps {
  messages: ChatMessage[];
  speakingMsgId: string | null;
  onSpeakMessage: (id: string, text: string) => void;
  onSelectPrompt: (prompt: string) => void;
}

const QUICK_PROMPTS = [
  'Explain how quantum annealing differs from gate-based quantum circuits',
  'Inspect system processes and outline active memory consumption',
  'Structure a clean TypeScript pipeline for voice data streaming',
  'Record persistent preference: user requires strictly verified code patterns'
];

/**
 * Editorial message presentation — not bubble chat.
 * User input: compact right-aligned minimal container.
 * MeghAI responses: full-width, open typographic editorial layout.
 */
export const ConversationLayer: React.FC<ConversationLayerProps> = ({
  messages,
  speakingMsgId,
  onSpeakMessage,
  onSelectPrompt
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Empty state with prompt suggestions
  const isOnlyWelcome = messages.length <= 1 && messages[0]?.id === 'welcome';

  if (isOnlyWelcome) {
    return (
      <div className="conversation-layer" style={{ justifyContent: 'center' }}>
        <div className="console-empty">
          <div className="console-empty-title">
            MeghAI Operating Environment
          </div>
          <p className="console-empty-sub">
            A unified, high-integrity AI computing substrate running natively on Windows.
            Speak or command below.
          </p>
          <div className="prompt-chips">
            {QUICK_PROMPTS.map((prompt, idx) => (
              <div
                key={idx}
                className="prompt-chip"
                onClick={() => onSelectPrompt(prompt)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onSelectPrompt(prompt)}
              >
                <span className="prompt-chip-text">{prompt}</span>
                <span className="prompt-chip-cta">RUN</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-layer">
      {messages.map(msg => {
        const isUser = msg.sender === 'user';
        const isSpeaking = speakingMsgId === msg.id;

        if (isUser) {
          return (
            <div key={msg.id} className="conv-entry user-entry">
              <div className="conv-user-bubble">{msg.text}</div>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: '#3f4551',
                  marginTop: 4
                }}
              >
                {msg.timestamp}
              </span>
            </div>
          );
        }

        // MeghAI response — editorial, full-width
        const statusChipClass =
          msg.verificationStatus === 'VERIFIED' ? 'verified'
          : msg.verificationStatus === 'FAILED' ? 'failed'
          : 'default';

        return (
          <div key={msg.id} className="conv-entry">
            {/* Optional sender label for first megh message in a sequence */}
            {msg.id === 'welcome' && (
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  letterSpacing: '0.1em',
                  color: '#3f4551',
                  marginBottom: 6,
                  textTransform: 'uppercase'
                }}
              >
                MEGH
              </div>
            )}

            <div className="conv-megh-body">{msg.text}</div>

            {/* Meta bar */}
            <div className="conv-meta-bar">
              {msg.verificationStatus && (
                <span className={`state-chip ${statusChipClass}`}>
                  {msg.verificationStatus === 'VERIFIED' && (
                    <CheckIcon size={9} color="#589e7c" />
                  )}
                  {msg.verificationStatus}
                </span>
              )}

              {msg.verificationDetails && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: '#616a78'
                  }}
                >
                  {msg.verificationDetails}
                </span>
              )}

              {msg.provider && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: '#3f4551'
                  }}
                >
                  [{msg.provider.toUpperCase()}{msg.modelId ? ` / ${msg.modelId}` : ''}]
                </span>
              )}

              <div style={{ flex: 1 }} />

              {/* Speak button */}
              <button
                className={`speak-btn${isSpeaking ? ' speaking' : ''}`}
                onClick={() => onSpeakMessage(msg.id, msg.text)}
                aria-label={isSpeaking ? 'Stop audio' : 'Speak this message'}
              >
                {isSpeaking ? <StopIcon size={10} /> : <PlayIcon size={10} />}
                <span>{isSpeaking ? 'STOP' : 'SPEAK'}</span>
              </button>

              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10,
                  color: '#3f4551'
                }}
              >
                {msg.timestamp}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
