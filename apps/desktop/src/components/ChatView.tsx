import React, { useRef, useEffect } from 'react';
import { Button } from './ui/Button.js';
import { Badge } from './ui/Badge.js';
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

  // First-Run / Empty State
  if (messages.length <= 1 && messages[0]?.id === 'welcome') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          maxWidth: '720px',
          margin: '0 auto',
          textAlign: 'center',
          userSelect: 'none'
        }}
      >
        <div style={{ fontSize: tokens.typography.sizes.display, fontWeight: 700, color: tokens.colors.text.primary, letterSpacing: '-0.03em' }}>
          Good to see you.
        </div>
        <div style={{ fontSize: tokens.typography.sizes.base, color: tokens.colors.text.secondary, marginTop: '8px', maxWidth: '460px', lineHeight: 1.5 }}>
          MeghAI Windows Operating Layer is ready. What would you like to explore or automate today?
        </div>

        {/* Quick Suggestion Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginTop: '32px',
            width: '100%',
            maxWidth: '560px'
          }}
        >
          {[
            {
              title: 'Ask or Explain',
              desc: 'Ask technical questions or summarize documentation',
              prompt: 'Explain how quantum annealing works compared to gate-based quantum computing.'
            },
            {
              title: 'Voice Activation',
              desc: 'Say "Hey Megh" or click the microphone to speak',
              prompt: 'Hey Megh, what is on my schedule today?'
            },
            {
              title: 'Windows System Control',
              desc: 'Launch applications, execute safe scripts, or check stats',
              prompt: 'Open Notepad and check system memory usage'
            },
            {
              title: 'Memory & Knowledge',
              desc: 'Store persistent facts or query knowledge graph',
              prompt: 'Remember that my preferred programming language is TypeScript'
            }
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => onSelectPrompt(item.prompt)}
              style={{
                background: 'rgba(255, 255, 255, 0.025)',
                border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: tokens.radii.lg,
                padding: '14px 18px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: tokens.transitions.fast
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = tokens.colors.border.accent;
                e.currentTarget.style.background = 'rgba(0, 240, 255, 0.04)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = tokens.colors.border.default;
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
              }}
            >
              <div style={{ fontWeight: 600, fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.primary }}>
                {item.title}
              </div>
              <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginTop: '4px', lineHeight: 1.4 }}>
                {item.desc}
              </div>
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
        gap: '20px',
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
              maxWidth: isUser ? '80%' : '100%',
              width: isUser ? 'auto' : '100%'
            }}
          >
            {isUser ? (
              // Clean, compact user prompt pill
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: `1px solid ${tokens.colors.border.default}`,
                  borderRadius: tokens.radii.xl,
                  padding: '10px 18px',
                  color: tokens.colors.text.primary,
                  fontSize: tokens.typography.sizes.sm,
                  lineHeight: 1.5,
                  backdropFilter: 'blur(12px)',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {msg.text}
              </div>
            ) : (
              // Expansive, editorial assistant message block
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '8px 0',
                  color: tokens.colors.text.primary
                }}
              >
                {/* Assistant Content */}
                <div
                  style={{
                    fontSize: tokens.typography.sizes.md,
                    lineHeight: 1.65,
                    color: '#E2E8F0',
                    whiteSpace: 'pre-wrap',
                    fontFamily: tokens.typography.fontSans
                  }}
                >
                  {msg.text}
                </div>

                {/* Footer Controls: Verification, Listen, Metadata */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginTop: '4px'
                  }}
                >
                  {/* Verification Status */}
                  {msg.verificationStatus && (
                    <Badge
                      variant={msg.verificationStatus === 'VERIFIED' ? 'success' : msg.verificationStatus === 'FAILED' ? 'danger' : 'neutral'}
                      size="sm"
                    >
                      {msg.verificationStatus === 'VERIFIED' ? '✓ VERIFIED' : 'UNVERIFIED'}
                    </Badge>
                  )}

                  {msg.verificationDetails && (
                    <span style={{ fontSize: '11px', color: tokens.colors.text.muted }}>
                      {msg.verificationDetails}
                    </span>
                  )}

                  <div style={{ flex: 1 }} />

                  {/* Audio Listen / Stop button */}
                  <Button
                    size="sm"
                    variant={isSpeaking ? 'danger' : 'ghost'}
                    onClick={() => onSpeakMessage(msg.id, msg.text)}
                  >
                    {isSpeaking ? '■ Stop Audio' : '🔊 Listen'}
                  </Button>

                  <span style={{ fontSize: '11px', color: tokens.colors.text.faint, fontFamily: tokens.typography.fontMono }}>
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
