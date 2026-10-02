import React from 'react';
import type { AIState } from '@meghai/shared-types';

interface TopHUDProps {
  aiState: AIState;
  micStatus: 'READY' | 'LISTENING' | 'OFF';
  isLocalMode: boolean;
  onEmergencyStop: () => void;
  onToggleMic: () => void;
}

export const TopHUD: React.FC<TopHUDProps> = ({
  aiState,
  micStatus,
  isLocalMode,
  onEmergencyStop,
  onToggleMic
}) => {
  return (
    <header style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 24px',
      background: 'rgba(7, 9, 14, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      zIndex: 50
    }}>
      {/* Brand & Identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #00f0ff, #8a2be2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 16px rgba(0, 240, 255, 0.35)'
        }}>
          <span style={{ fontWeight: 800, fontSize: '14px', color: '#07090e' }}>M</span>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', color: '#f8fafc' }}>MeghAI</span>
            <span style={{
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.06)',
              color: '#94a3b8',
              fontWeight: 600
            }}>OS LAYER</span>
          </div>
        </div>
      </div>

      {/* Central Telemetry Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {/* AI State Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          color: '#cbd5e1'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: aiState === 'FAILED' || aiState === 'CANCELLED' ? '#ef4444' : aiState === 'VERIFYING' ? '#10b981' : '#38bdf8'
          }} />
          <span>STATE: {aiState}</span>
        </div>
        {/* Mic Indicator */}
        <button
          onClick={onToggleMic}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: '6px 12px',
            borderRadius: '20px',
            color: '#cbd5e1',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: micStatus === 'LISTENING' ? '#ef4444' : micStatus === 'READY' ? '#10b981' : '#64748b',
            boxShadow: micStatus === 'LISTENING' ? '0 0 10px #ef4444' : 'none'
          }} />
          <span>MIC: {micStatus}</span>
        </button>

        {/* Cloud / Local Mode Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '6px 12px',
          borderRadius: '20px',
          fontSize: '12px',
          color: '#cbd5e1'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isLocalMode ? '#f59e0b' : '#38bdf8'
          }} />
          <span>{isLocalMode ? 'LOCAL MODE' : 'CLOUD CONNECTED'}</span>
        </div>
      </div>

      {/* Emergency STOP MEGH Kill Switch (Section 55) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={onEmergencyStop}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(185, 28, 28, 0.3))',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            color: '#fca5a5',
            padding: '6px 14px',
            borderRadius: '8px',
            fontWeight: 700,
            fontSize: '12px',
            letterSpacing: '0.05em',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Emergency Kill Switch: Stop all agent tasks, model streams, audio, and tools"
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#ef4444' }} />
          STOP MEGH
        </button>
      </div>
    </header>
  );
};
