import React from 'react';
import type { AIState, MicrophoneState, VoiceInputState } from '@meghai/shared-types';

interface TopHUDProps {
  aiState: AIState;
  micState: MicrophoneState;
  voiceInputState?: VoiceInputState;
  micLevel?: number;
  isLocalMode?: boolean;
  onlineStatus?: string;
  autoSpeak?: 'OFF' | 'ON' | 'ASK';
  onToggleAutoSpeak?: () => void;
  onEmergencyStop: () => void;
  onToggleMic: () => void;
}

export const TopHUD: React.FC<TopHUDProps> = ({
  aiState,
  micState,
  voiceInputState = 'IDLE',
  micLevel = 0,
  isLocalMode = false,
  onlineStatus = 'ONLINE',
  autoSpeak = 'ON',
  onToggleAutoSpeak,
  onEmergencyStop,
  onToggleMic
}) => {
  const getMicColor = () => {
    if (micState === 'MIC_LISTENING') {
      switch (voiceInputState) {
        case 'WAKE_CONFIRMED': return '#00f0ff';
        case 'COMMAND_CAPTURE': return '#ef4444';
        case 'TRANSCRIBING': return '#f59e0b';
        case 'PROCESSING': return '#a855f7';
        case 'PASSIVE_WAKE_LISTENING':
        default: return '#10b981';
      }
    }
    switch (micState) {
      case 'MIC_STARTING': return '#f59e0b';
      case 'MIC_STOPPING': return '#d97706';
      case 'MIC_READY': return '#10b981';
      case 'MIC_DEVICE_UNAVAILABLE': return '#eab308';
      case 'MIC_ERROR': return '#dc2626';
      case 'MIC_OFF':
      default: return '#64748b';
    }
  };

  const getMicLabel = () => {
    if (micState === 'MIC_LISTENING') {
      switch (voiceInputState) {
        case 'PASSIVE_WAKE_LISTENING': return 'WAKE READY: "Hey Megh"';
        case 'WAKE_CONFIRMED': return 'WAKE DETECTED!';
        case 'COMMAND_CAPTURE': return 'LISTENING...';
        case 'TRANSCRIBING': return 'TRANSCRIBING...';
        case 'PROCESSING': return 'PROCESSING...';
        case 'SPEAKING': return 'SPEAKING...';
        default: return 'LISTENING';
      }
    }
    switch (micState) {
      case 'MIC_STARTING': return 'STARTING...';
      case 'MIC_STOPPING': return 'STOPPING...';
      case 'MIC_READY': return 'MIC READY';
      case 'MIC_DEVICE_UNAVAILABLE': return 'NO MIC';
      case 'MIC_ERROR': return 'MIC ERROR';
      case 'MIC_OFF':
      default: return 'MIC OFF';
    }
  };
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* AI State Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: aiState === 'SPEAKING'
            ? 'rgba(168, 85, 247, 0.15)'
            : aiState === 'RESPONDING' || aiState === 'PLANNING'
            ? 'rgba(0, 240, 255, 0.12)'
            : 'rgba(15, 23, 42, 0.6)',
          border: `1px solid ${
            aiState === 'SPEAKING'
              ? 'rgba(168, 85, 247, 0.4)'
              : aiState === 'RESPONDING' || aiState === 'PLANNING'
              ? 'rgba(0, 240, 255, 0.3)'
              : 'rgba(255, 255, 255, 0.1)'
          }`,
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '12px',
          color: aiState === 'SPEAKING' ? '#d8b4fe' : '#cbd5e1',
          transition: 'all 0.2s ease'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: aiState === 'FAILED' || aiState === 'CANCELLED'
              ? '#ef4444'
              : aiState === 'SPEAKING'
              ? '#a855f7'
              : aiState === 'RESPONDING' || aiState === 'PLANNING'
              ? '#00f0ff'
              : aiState === 'VERIFYING'
              ? '#10b981'
              : '#38bdf8',
            boxShadow: aiState === 'SPEAKING'
              ? '0 0 12px #a855f7'
              : (aiState === 'RESPONDING' || aiState === 'PLANNING')
              ? '0 0 10px #00f0ff'
              : 'none'
          }} />
          <span style={{ fontWeight: 600 }}>STATE: {aiState}</span>

          {/* Animated sound waves when MeghAI is speaking through Windows speakers */}
          {aiState === 'SPEAKING' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '14px', paddingLeft: '2px' }}>
              {[6, 12, 16, 10, 14, 8].map((h, i) => (
                <span
                  key={i}
                  style={{
                    width: '2px',
                    height: `${h}px`,
                    backgroundColor: '#a855f7',
                    borderRadius: '1px'
                  }}
                />
              ))}
            </div>
          )}

          {/* Animated thinking dot pulse when MeghAI is thinking */}
          {(aiState === 'RESPONDING' || aiState === 'PLANNING') && (
            <span style={{ color: '#00f0ff', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>
              THINKING...
            </span>
          )}
        </div>

        {/* Auto-Speak Toggle Badge */}
        <button
          onClick={onToggleAutoSpeak}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: autoSpeak === 'ON' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(15, 23, 42, 0.6)',
            border: `1px solid ${autoSpeak === 'ON' ? 'rgba(0, 240, 255, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 600,
            color: autoSpeak === 'ON' ? '#00f0ff' : '#94a3b8',
            cursor: onToggleAutoSpeak ? 'pointer' : 'default',
            transition: 'all 0.15s ease'
          }}
          title={`Auto-Speak responses: ${autoSpeak}. Click to toggle between ON and OFF.`}
        >
          <span>{autoSpeak === 'ON' ? '🔊' : '🔇'}</span>
          <span>SPEAK: {autoSpeak}</span>
        </button>
        {/* Mic Indicator & Real Acoustic Level Visualizer */}
        <button
          onClick={onToggleMic}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: micState === 'MIC_LISTENING' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.6)',
            border: `1px solid ${micState === 'MIC_LISTENING' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
            padding: '6px 14px',
            borderRadius: '20px',
            color: micState === 'MIC_LISTENING' ? '#fca5a5' : '#cbd5e1',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title={micState === 'MIC_LISTENING' ? 'Click to stop live microphone capture' : 'Click to start live Windows microphone capture'}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getMicColor(),
            boxShadow: micState === 'MIC_LISTENING' ? '0 0 10px #ef4444' : 'none'
          }} />
          <span>{getMicLabel()}</span>

          {/* Real-time acoustic level waveform bars (active when listening) */}
          {micState === 'MIC_LISTENING' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              height: '14px',
              paddingLeft: '4px'
            }}>
              {[0.6, 1.0, 0.8, 1.1, 0.7].map((factor, idx) => {
                const barHeight = Math.max(3, Math.min(14, Math.round((micLevel || 0.1) * factor * 14)));
                return (
                  <span
                    key={idx}
                    style={{
                      width: '2.5px',
                      height: `${barHeight}px`,
                      backgroundColor: '#ef4444',
                      borderRadius: '1px',
                      transition: 'height 0.08s ease-out'
                    }}
                  />
                );
              })}
            </div>
          )}
        </button>

        {/* Online Status Indicator (Section 27 & 39) */}
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
            backgroundColor: (onlineStatus === 'ONLINE' || !isLocalMode) ? '#10b981' : onlineStatus === 'ONLINE_DEGRADED' ? '#f59e0b' : '#f59e0b',
            boxShadow: (onlineStatus === 'ONLINE' || !isLocalMode) ? '0 0 8px rgba(16, 185, 129, 0.5)' : 'none'
          }} />
          <span style={{ fontWeight: 600 }}>
            {onlineStatus === 'ONLINE' ? 'ONLINE' : onlineStatus === 'ONLINE_DEGRADED' ? 'ONLINE (DEGRADED)' : onlineStatus === 'NO_CREDENTIALS' ? 'ONLINE (NO KEYS)' : 'ONLINE'}
          </span>
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
