import React from 'react';
import type { AIState, MicrophoneState, VoiceInputState } from '@meghai/shared-types';
import {
  MicIcon,
  MicOffIcon,
  VolumeIcon,
  VolumeOffIcon,
  ModelIcon,
  VoiceIcon,
  PersonalityIcon,
  KillSwitchIcon
} from './ui/Icons.js';

interface TopHUDProps {
  aiState: AIState;
  micState: MicrophoneState;
  voiceInputState: VoiceInputState;
  micLevel: number;
  onlineStatus: string;
  autoSpeak: 'OFF' | 'ON' | 'ASK';
  selectedModel: string;
  selectedVoiceName: string;
  selectedPersonalityName?: string;
  onToggleAutoSpeak: () => void;
  onToggleMic: () => void;
  onOpenModelSelector: () => void;
  onOpenVoiceSelector: () => void;
  onOpenPersonalitySelector?: () => void;
  onEmergencyStop: () => void;
  onResetEmergencyStop?: () => void;
}

const StatusDot: React.FC<{ color: string }> = ({ color }) => (
  <span
    style={{
      display: 'inline-block',
      width: 5,
      height: 5,
      borderRadius: '50%',
      backgroundColor: color,
      flexShrink: 0
    }}
  />
);

export const TopHUD: React.FC<TopHUDProps> = ({
  aiState,
  micState,
  voiceInputState,
  micLevel,
  onlineStatus,
  autoSpeak,
  selectedModel,
  selectedVoiceName,
  selectedPersonalityName = 'Futuristic',
  onToggleAutoSpeak,
  onToggleMic,
  onOpenModelSelector,
  onOpenVoiceSelector,
  onOpenPersonalitySelector,
  onEmergencyStop,
  onResetEmergencyStop
}) => {
  const isMicListening = micState === 'MIC_LISTENING';

  const getMicColor = () => {
    if (!isMicListening) return '#3f4551';
    if (voiceInputState === 'COMMAND_CAPTURE') return '#bf5049';
    if (voiceInputState === 'WAKE_CONFIRMED' || voiceInputState === 'WAKE_DETECTED') return '#4fa8b5';
    if (voiceInputState === 'TRANSCRIBING') return '#c6994a';
    return '#589e7c';
  };

  const getAiStateColor = () => {
    const map: Record<string, string> = {
      READY: '#4fa8b5',
      LISTENING: '#5cb8c5',
      TRANSCRIBING: '#c6994a',
      ROUTING: '#7a8ea3',
      PLANNING: '#7a8ea3',
      RESPONDING: '#7a8ea3',
      EXECUTING: '#5c8fa8',
      SPEAKING: '#859bb0',
      FAILED: '#bf5049',
      CANCELLED: '#616a78',
      STOPPED: '#bf5049'
    };
    return map[aiState] || '#616a78';
  };

  const isStopped = aiState === 'STOPPED' || aiState === 'CANCELLED';

  return (
    <header className="top-hud" role="banner">
      {/* Left: State + Online indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: '0.08em'
          }}
        >
          <StatusDot color={getAiStateColor()} />
          <span style={{ color: getAiStateColor(), fontWeight: 600 }}>{aiState}</span>
        </div>

        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.07)' }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: onlineStatus === 'ONLINE' ? '#589e7c' : '#c6994a',
            letterSpacing: '0.04em'
          }}
        >
          <StatusDot color={onlineStatus === 'ONLINE' ? '#589e7c' : '#c6994a'} />
          {onlineStatus}
        </div>
      </div>

      {/* Right: Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button className="hud-btn" onClick={onOpenModelSelector} title="Active model provider">
          <ModelIcon size={11} color="#4fa8b5" />
          <span>{selectedModel.replace('local-', '').toUpperCase()}</span>
        </button>

        <button className="hud-btn" onClick={onOpenVoiceSelector} title="Active voice profile">
          <VoiceIcon size={11} color="#4fa8b5" />
          <span>{selectedVoiceName}</span>
        </button>

        {onOpenPersonalitySelector && (
          <button className="hud-btn" onClick={onOpenPersonalitySelector} title="Active personality">
            <PersonalityIcon size={11} color="#4fa8b5" />
            <span>{selectedPersonalityName}</span>
          </button>
        )}

        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.07)' }} />

        <button
          className={`hud-btn${autoSpeak === 'ON' ? ' active' : ''}`}
          onClick={onToggleAutoSpeak}
          title={`Auto-speak: ${autoSpeak}`}
        >
          {autoSpeak === 'ON' ? <VolumeIcon size={11} /> : <VolumeOffIcon size={11} />}
          <span>{autoSpeak}</span>
        </button>

        <button
          className={`hud-btn${isMicListening ? ' active' : ''}`}
          onClick={onToggleMic}
          title={isMicListening
            ? `Mic active (${voiceInputState}). Click to pause.`
            : 'Mic paused. Click to capture.'}
          style={isMicListening ? {
            background: 'rgba(79, 168, 181, 0.1)',
            borderColor: `${getMicColor()}55`,
            color: getMicColor()
          } : {}}
        >
          {isMicListening ? <MicIcon size={11} /> : <MicOffIcon size={11} />}
          {isMicListening && (
            <div className="mic-level-track">
              <div
                className="mic-level-fill"
                style={{
                  width: `${Math.min(100, Math.max(8, micLevel * 100))}%`,
                  background: getMicColor()
                }}
              />
            </div>
          )}
        </button>

        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.07)' }} />

        {isStopped ? (
          <button
            className="hud-btn success"
            onClick={onResetEmergencyStop || onEmergencyStop}
            title="Resume: Clear emergency stop"
          >
            <span style={{ fontSize: 10 }}>&#9654;</span>
            <span>RESUME</span>
          </button>
        ) : (
          <button
            className="hud-btn danger"
            onClick={onEmergencyStop}
            title="Emergency Stop: Halt all AI activity immediately"
          >
            <KillSwitchIcon size={11} color="#f8b4b0" />
            <span>STOP MEGH</span>
          </button>
        )}
      </div>
    </header>
  );
};
