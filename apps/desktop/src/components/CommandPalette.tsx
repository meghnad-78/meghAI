import React, { useState } from 'react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (command: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, onSubmit }) => {
  const [input, setInput] = useState('');

  if (!isOpen) return null;

  const quickActions = [
    { label: 'Create a Note', command: 'Megh, create a note titled Project Alpha with content Architecture finalized.' },
    { label: 'Open Calculator', command: 'Hey Megh, open Calculator' },
    { label: 'Find Resume', command: 'Megh, find my resume' },
    { label: 'System Info', command: 'What is my current system status?' },
    { label: 'Hindi Reminder', command: 'Megh kal mera 8 baje ka reminder laga dena' }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '15vh',
      zIndex: 100
    }} onClick={onClose}>
      <div
        style={{
          width: '580px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 240, 255, 0.15)',
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
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
            placeholder="Type a command, ask Megh, or run an action... (Esc to close)"
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '16px',
              fontFamily: 'inherit'
            }}
          />
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
            Quick Prompts
          </span>
          {quickActions.map((action, idx) => (
            <button
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
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: 'none',
                color: '#e2e8f0',
                fontSize: '13px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0, 240, 255, 0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
            >
              <span>{action.label}</span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>{action.command.slice(0, 35)}...</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
