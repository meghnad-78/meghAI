import React, { useState } from 'react';
import { SearchIcon, CloseIcon, ChevronRightIcon } from './ui/Icons.js';
import { tokens } from '../theme/tokens.js';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (command: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onSubmit }) => {
  const [input, setInput] = useState('');

  if (!isOpen) return null;

  const quickActions = [
    { label: 'System Process Audit', command: 'What is my current system status and process memory consumption?', category: 'SYSTEM' },
    { label: 'Launch Calculator', command: 'Hey Megh, open Calculator', category: 'WINDOWS' },
    { label: 'Technical Documentation', command: 'Explain how quantum annealing differs from gate-based circuits.', category: 'REASONING' },
    { label: 'Create Project Note', command: 'Megh, create a note titled Architecture Finalization with verified components.', category: 'WORKSPACE' },
    { label: 'Voice Mode Query', command: 'Hey Megh, what is on my schedule today?', category: 'VOICE' }
  ];

  const filtered = quickActions.filter(a =>
    !input.trim() ||
    a.label.toLowerCase().includes(input.toLowerCase()) ||
    a.command.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: tokens.colors.bg.overlay,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '14vh',
        zIndex: tokens.zIndex.modal,
        userSelect: 'none'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          backgroundColor: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.strong}`,
          borderRadius: tokens.radii.lg,
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Command Search Bar */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: tokens.colors.bg.subtle
          }}
        >
          <SearchIcon size={16} color={tokens.colors.text.muted} />
          <input
            autoFocus
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && input.trim()) {
                onSubmit(input.trim());
                setInput('');
                onClose();
              }
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Command MeghAI, search tools, trigger action... (Esc to close)"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: tokens.colors.text.primary,
              fontSize: tokens.typography.sizes.base,
              fontFamily: tokens.typography.fontSans
            }}
          />
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.colors.text.muted,
              cursor: 'pointer',
              padding: '2px'
            }}
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Action Items */}
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontSize: '10px',
              fontFamily: tokens.typography.fontMono,
              color: tokens.colors.text.faint,
              padding: '2px 8px 6px',
              letterSpacing: '0.04em'
            }}
          >
            SUGGESTED EXECUTIONS
          </div>

          {filtered.map((action, idx) => (
            <div
              key={idx}
              onClick={() => {
                onSubmit(action.command);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: tokens.radii.xs,
                backgroundColor: tokens.colors.bg.elevated,
                border: `1px solid ${tokens.colors.border.subtle}`,
                cursor: 'pointer',
                transition: tokens.transitions.fast
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '9px',
                    fontFamily: tokens.typography.fontMono,
                    color: tokens.colors.accent.primary,
                    padding: '1px 5px',
                    borderRadius: tokens.radii.xs,
                    backgroundColor: tokens.colors.accent.primarySubtle
                  }}
                >
                  {action.category}
                </span>
                <span
                  style={{
                    fontSize: tokens.typography.sizes.sm,
                    fontFamily: tokens.typography.fontSans,
                    color: tokens.colors.text.primary,
                    fontWeight: 500
                  }}
                >
                  {action.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: tokens.colors.text.muted, fontFamily: tokens.typography.fontMono }}>
                  {action.command.slice(0, 32)}...
                </span>
                <ChevronRightIcon size={12} color={tokens.colors.text.faint} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
