import React, { useRef, useEffect } from 'react';
import { PlayIcon, StopIcon, CheckIcon } from './ui/Icons.js';
import { tokens } from '../theme/tokens.js';

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

interface ChatViewProps {
  messages: ChatMessage[];
  speakingMsgId: string | null;
  onSpeakMessage: (id: string, text: string) => void;
  onSelectPrompt: (prompt: string) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  speakingMsgId,
  onSpeakMessage,
  onSelectPrompt
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // First-Run / Elegant Minimal Empty State (Section 59)
  if (messages.length <= 1 && messages[0]?.id === 'welcome') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px 24px',
          maxWidth: '680px',
          margin: '0 auto',
          textAlign: 'center',
          userSelect: 'none'
        }}
      >
        <div
          style={{
            fontFamily: tokens.typography.fontDisplay,
            fontSize: tokens.typography.sizes.display,
            fontWeight: 700,
            color: tokens.colors.text.primary,
            letterSpacing: tokens.typography.letterSpacing.display,
            lineHeight: 1.15
          }}
        >
          MeghAI Operating Environment
        </div>
        <p
          style={{
            fontFamily: tokens.typography.fontSans,
            fontSize: tokens.typography.sizes.sm,
            color: tokens.colors.text.secondary,
            marginTop: '10px',
            maxWidth: '480px',
            lineHeight: 1.6
          }}
        >
          A unified, high-integrity AI computing substrate running natively on Windows.
          Speak aloud or command below.
        </p>

        {/* Minimal Contextual Prompts (Non-card, architectural divider layout) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginTop: '32px',
            width: '100%',
            maxWidth: '520px'
          }}
        >
          {[
            'Explain how quantum annealing differs from gate-based quantum circuits',
            'Inspect system processes and outline active memory consumption',
            'Structure a clean, verified TypeScript pipeline for voice data streaming',
            'Record persistent preference: user requires strictly verified code patterns'
          ].map((prompt, idx) => (
            <div
              key={idx}
              onClick={() => onSelectPrompt(prompt)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                backgroundColor: tokens.colors.bg.surface,
                border: `1px solid ${tokens.colors.border.subtle}`,
                borderRadius: tokens.radii.sm,
                cursor: 'pointer',
                textAlign: 'left',
                transition: tokens.transitions.fast
              }}
            >
              <span
                style={{
                  fontFamily: tokens.typography.fontSans,
                  fontSize: tokens.typography.sizes.xs,
                  color: tokens.colors.text.secondary
                }}
              >
                {prompt}
              </span>
              <span
                style={{
                  fontFamily: tokens.typography.fontMono,
                  fontSize: '10px',
                  color: tokens.colors.accent.primary
                }}
              >
                RUN
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 32px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '860px',
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}
    >
      {messages.map(msg => {
        const isUser = msg.sender === 'user';
        const isSpeaking = speakingMsgId === msg.id;

        return (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignSelf: isUser ? 'flex-end' : 'flex-start',
              maxWidth: isUser ? '78%' : '100%',
              width: isUser ? 'auto' : '100%'
            }}
          >
            {isUser ? (
              // Editorial User Prompt (Quiet, minimal, hairline defined)
              <div
                style={{
                  backgroundColor: tokens.colors.bg.elevated,
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: tokens.radii.md,
                  padding: '9px 14px',
                  color: tokens.colors.text.primary,
                  fontFamily: tokens.typography.fontSans,
                  fontSize: tokens.typography.sizes.sm,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}
              >
                {msg.text}
              </div>
            ) : (
              // Open Editorial Assistant Presentation (High readability, no card containers)
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '6px 0',
                  color: tokens.colors.text.primary
                }}
              >
                {/* Assistant Content Body */}
                <div
                  style={{
                    fontFamily: tokens.typography.fontSans,
                    fontSize: tokens.typography.sizes.md,
                    lineHeight: 1.68,
                    color: tokens.colors.text.primary,
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {msg.text}
                </div>

                {/* Subsystem Metadata & Tactical Audio Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '4px',
                    paddingTop: '6px',
                    borderTop: `1px solid ${tokens.colors.border.subtle}`
                  }}
                >
                  {/* Verification Status Badge */}
                  {msg.verificationStatus && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        fontFamily: tokens.typography.fontMono,
                        padding: '1px 6px',
                        borderRadius: tokens.radii.xs,
                        backgroundColor: msg.verificationStatus === 'VERIFIED' ? tokens.colors.semantic.successMuted : tokens.colors.bg.elevated,
                        border: `1px solid ${msg.verificationStatus === 'VERIFIED' ? tokens.colors.semantic.success : tokens.colors.border.default}`,
                        color: msg.verificationStatus === 'VERIFIED' ? tokens.colors.semantic.success : tokens.colors.text.muted
                      }}
                    >
                      {msg.verificationStatus === 'VERIFIED' && <CheckIcon size={10} color={tokens.colors.semantic.success} />}
                      <span>{msg.verificationStatus}</span>
                    </span>
                  )}

                  {msg.verificationDetails && (
                    <span style={{ fontSize: '11px', color: tokens.colors.text.muted, fontFamily: tokens.typography.fontMono }}>
                      {msg.verificationDetails}
                    </span>
                  )}

                  {msg.provider && (
                    <span style={{ fontSize: '10px', color: tokens.colors.text.faint, fontFamily: tokens.typography.fontMono }}>
                      [{msg.provider.toUpperCase()}]
                    </span>
                  )}

                  <div style={{ flex: 1 }} />

                  {/* Audio Synthesize / Halt Controller */}
                  <button
                    onClick={() => onSpeakMessage(msg.id, msg.text)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: isSpeaking ? tokens.colors.semantic.errorMuted : tokens.colors.bg.elevated,
                      border: `1px solid ${isSpeaking ? tokens.colors.semantic.error : tokens.colors.border.default}`,
                      borderRadius: tokens.radii.xs,
                      padding: '3px 8px',
                      color: isSpeaking ? '#f8b4b0' : tokens.colors.text.secondary,
                      fontSize: tokens.typography.sizes.xs,
                      cursor: 'pointer'
                    }}
                  >
                    {isSpeaking ? <StopIcon size={11} /> : <PlayIcon size={11} />}
                    <span>{isSpeaking ? 'STOP AUDIO' : 'SPEAK'}</span>
                  </button>

                  <span
                    style={{
                      fontSize: '10px',
                      color: tokens.colors.text.faint,
                      fontFamily: tokens.typography.fontMono
                    }}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
};
