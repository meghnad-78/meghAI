import React, { useState, useEffect } from 'react';
import type { AIState, MeghAIEvent, MicrophoneState, VoiceInputState } from '@meghai/shared-types';
import { AICore } from './components/AICore.js';
import { TopHUD } from './components/TopHUD.js';
import { ActionTimeline } from './components/ActionTimeline.js';
import { CommandPalette } from './components/CommandPalette.js';
import { NotesCenter } from './components/NotesCenter.js';
import { TaskCenter } from './components/TaskCenter.js';
import { MemoryCenter } from './components/MemoryCenter.js';
import { KnowledgeCenter } from './components/KnowledgeCenter.js';
import { VoiceStudio } from './components/VoiceStudio.js';
import { RoutineCenter } from './components/RoutineCenter.js';
import { ProviderCenter } from './components/ProviderCenter.js';
import { PermissionCenter } from './components/PermissionCenter.js';

interface Message {
  id: string;
  sender: 'user' | 'megh';
  text: string;
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
  verificationDetails?: string;
  timestamp: string;
}

export type ActiveTab =
  | 'home'
  | 'notes'
  | 'tasks'
  | 'memory'
  | 'knowledge'
  | 'voice'
  | 'routines'
  | 'providers'
  | 'permissions';

export const App: React.FC = () => {
  const [aiState, setAiState] = useState<AIState>('READY');
  const [micState, setMicState] = useState<MicrophoneState>('MIC_OFF');
  const [voiceInputState, setVoiceInputState] = useState<VoiceInputState>('IDLE');
  const [micLevel, setMicLevel] = useState<number>(0);
  const [isLocalMode, setIsLocalMode] = useState<boolean>(true);
  const [autoSpeak, setAutoSpeak] = useState<'OFF' | 'ON' | 'ASK'>('ON');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [events, setEvents] = useState<MeghAIEvent[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'megh',
      text: 'MeghAI Windows Operating Layer initialized. Say "Hey Megh" or press Ctrl+Space to begin.',
      verificationStatus: 'VERIFIED',
      verificationDetails: 'System online & secure.',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  // Global Keyboard Shortcuts (Ctrl+Space for Palette, Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Connect to SSE Stream from MeghAI API Server
  useEffect(() => {
    const eventSource = new EventSource('/api/v1/events/stream');

    eventSource.onmessage = e => {
      try {
        const evt = JSON.parse(e.data) as MeghAIEvent | { type: string; aiState?: AIState };
        if ('aiState' in evt && evt.aiState) {
          setAiState(evt.aiState);
        } else if ('type' in evt && evt.type === 'AI_STATE_CHANGED') {
          const payload = (evt as MeghAIEvent<{ state: AIState }>).payload;
          if (payload?.state) setAiState(payload.state);
        }
        if ('id' in evt) {
          const mEvt = evt as MeghAIEvent;
          setEvents(prev => [mEvt, ...prev.slice(0, 99)]);

          // Handle real native microphone and voice events
          if (mEvt.type === 'MIC_STARTING') {
            setMicState('MIC_STARTING');
          } else if (mEvt.type === 'MIC_LISTENING') {
            setMicState('MIC_LISTENING');
          } else if (mEvt.type === 'MIC_LEVEL') {
            const payload = mEvt.payload as { normalizedLevel?: number; rms?: number; peak?: number };
            setMicLevel(payload?.normalizedLevel ?? 0);
          } else if (mEvt.type === 'MIC_STOPPING') {
            setMicState('MIC_STOPPING');
            setVoiceInputState('IDLE');
          } else if (mEvt.type === 'MIC_OFF') {
            setMicState('MIC_OFF');
            setVoiceInputState('IDLE');
            setMicLevel(0);
            setAiState(prev => prev === 'LISTENING' ? 'READY' : prev);
          } else if (mEvt.type === 'MIC_DEVICE_UNAVAILABLE') {
            setMicState('MIC_DEVICE_UNAVAILABLE');
            setVoiceInputState('IDLE');
            setMicLevel(0);
          } else if (mEvt.type === 'VOICE_INPUT_STATE_CHANGED') {
            const payload = mEvt.payload as { state: VoiceInputState };
            if (payload?.state) {
              setVoiceInputState(payload.state);
            }
          } else if (mEvt.type === 'TRANSCRIPT_FINAL') {
            const payload = mEvt.payload as { text: string };
            if (payload?.text) {
              setMessages(prev => [
                ...prev,
                {
                  id: `usr-voice-${Date.now()}`,
                  sender: 'user',
                  text: `🎙️ ${payload.text}`,
                  timestamp: new Date().toLocaleTimeString()
                }
              ]);
            }
          } else if (mEvt.type === 'TASK_COMPLETED') {
            const payload = mEvt.payload as { reply?: string; verificationStatus?: any; verificationDetails?: string };
            if (payload?.reply) {
              setMessages(prev => {
                if (prev.some(m => m.text === payload.reply)) return prev;
                return [
                  ...prev,
                  {
                    id: `megh-resp-${Date.now()}`,
                    sender: 'megh',
                    text: payload.reply!,
                    verificationStatus: payload.verificationStatus,
                    verificationDetails: payload.verificationDetails,
                    timestamp: new Date().toLocaleTimeString()
                  }
                ];
              });
            }
          }
        }
      } catch {
        // Ignore parse error
      }
    };

    // Check system status
    fetch('/api/v1/system/status')
      .then(res => res.json())
      .then(data => {
        if (data.providers) {
          const hasCloud = data.providers.some((p: any) => p.isConfigured && p.id !== 'local-ollama');
          setIsLocalMode(!hasCloud);
        }
      })
      .catch(() => setIsLocalMode(true));

    // Check initial microphone status
    fetch('/api/v1/voice/mic/status')
      .then(res => res.json())
      .then(data => {
        if (data?.state) {
          setMicState(data.state);
        }
        if (data?.voiceInputState) {
          setVoiceInputState(data.voiceInputState);
        }
      })
      .catch(() => {});

    // Check voice settings (including persistent autoSpeak mode)
    fetch('/api/v1/voice/settings')
      .then(res => res.json())
      .then(data => {
        if (data?.autoSpeak) {
          setAutoSpeak(data.autoSpeak);
        }
      })
      .catch(() => {});

    return () => {
      eventSource.close();
    };
  }, []);

  const handleToggleAutoSpeak = async () => {
    const nextMode: 'OFF' | 'ON' | 'ASK' = autoSpeak === 'ON' ? 'OFF' : 'ON';
    setAutoSpeak(nextMode);
    try {
      await fetch('/api/v1/voice/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSpeak: nextMode })
      });
    } catch {}
  };

  const handleSpeakMessage = async (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      try {
        await fetch('/api/v1/voice/stop', { method: 'POST' });
      } catch {}
      setSpeakingMsgId(null);
      return;
    }

    setSpeakingMsgId(msgId);
    try {
      await fetch('/api/v1/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
    } catch {} finally {
      setSpeakingMsgId(null);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    try {
      const res = await fetch('/api/v1/input/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json() as any;

      const meghMsg: Message = {
        id: `megh-${Date.now()}`,
        sender: 'megh',
        text: data.reply || data.clarificationPrompt || JSON.stringify(data),
        verificationStatus: data.verificationStatus,
        verificationDetails: data.verificationDetails,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, meghMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `megh-err-${Date.now()}`,
          sender: 'megh',
          text: `Could not process request: ${(err as Error).message}`,
          verificationStatus: 'FAILED',
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    }
  };

  const handleEmergencyStop = async () => {
    try {
      await fetch('/api/v1/system/kill', { method: 'POST' });
      setAiState('CANCELLED');
      setMicState('MIC_OFF');
      setMicLevel(0);
      setSpeakingMsgId(null);
    } catch {
      // Fallback
    }
  };

  const handleToggleMic = async () => {
    if (micState === 'MIC_LISTENING' || micState === 'MIC_STARTING') {
      setMicState('MIC_STOPPING');
      try {
        const res = await fetch('/api/v1/voice/mic/stop', { method: 'POST' });
        const data = await res.json();
        setMicState(data.state || 'MIC_OFF');
        setMicLevel(0);
        if (aiState === 'LISTENING') setAiState('READY');
      } catch {
        setMicState('MIC_OFF');
        setMicLevel(0);
      }
    } else {
      setMicState('MIC_STARTING');
      try {
        const res = await fetch('/api/v1/voice/mic/start', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          setMicState(data.state || 'MIC_LISTENING');
          setAiState('LISTENING');
        } else {
          setMicState(data.state || 'MIC_ERROR');
        }
      } catch {
        setMicState('MIC_ERROR');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', background: '#07090e', color: '#f8fafc' }}>
      {/* Top HUD */}
      <TopHUD
        aiState={aiState}
        micState={micState}
        voiceInputState={voiceInputState}
        micLevel={micLevel}
        isLocalMode={isLocalMode}
        autoSpeak={autoSpeak}
        onToggleAutoSpeak={handleToggleAutoSpeak}
        onEmergencyStop={handleEmergencyStop}
        onToggleMic={handleToggleMic}
      />

      {/* Main 3-Column Workspace Layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Navigation Bar */}
        <aside style={{
          width: '72px',
          background: 'rgba(11, 15, 25, 0.7)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '20px 0',
          gap: '14px',
          overflowY: 'auto'
        }}>
          {[
            { id: 'home', label: 'Home (AI Core)', icon: '⚡' },
            { id: 'notes', label: 'Notes & Facts', icon: '📝' },
            { id: 'tasks', label: 'Tasks & DAG', icon: '✓' },
            { id: 'memory', label: 'Memory Center', icon: '🧠' },
            { id: 'knowledge', label: 'Knowledge Graph', icon: '🌐' },
            { id: 'voice', label: 'Voice Studio', icon: '🎙️' },
            { id: 'routines', label: 'Routines & Brief', icon: '⏱️' },
            { id: 'providers', label: 'Providers & Costs', icon: '☁️' },
            { id: 'permissions', label: 'Safety & Policy', icon: '🛡️' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                border: activeTab === tab.id ? '1px solid #00f0ff' : '1px solid rgba(255, 255, 255, 0.06)',
                background: activeTab === tab.id ? 'rgba(0, 240, 255, 0.15)' : 'transparent',
                color: activeTab === tab.id ? '#00f0ff' : '#94a3b8',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </aside>

        {/* Center Canvas: Living AI Core or Dedicated Center Panes */}
        <main style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: 'radial-gradient(ellipse at 50% 20%, rgba(138, 43, 226, 0.08) 0%, rgba(7, 9, 14, 0) 70%)',
          overflow: 'hidden'
        }}>
          {activeTab === 'home' && (
            <>
              {/* Living Adaptive AI Core Animation */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 0 0' }}>
                <AICore state={aiState} size={240} />
              </div>

              {/* Conversation Stream */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 32px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      background: msg.sender === 'user' ? 'rgba(0, 240, 255, 0.12)' : 'rgba(15, 23, 42, 0.75)',
                      border: `1px solid ${msg.sender === 'user' ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: '16px',
                      padding: '14px 18px',
                      backdropFilter: 'blur(12px)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
                    }}
                  >
                    <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#f1f5f9', whiteSpace: 'pre-wrap' }}>
                      {msg.text}
                    </div>

                    {/* Verification Badge */}
                    {msg.verificationStatus && (
                      <div style={{
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        color: msg.verificationStatus === 'VERIFIED' ? '#34d399' : '#f87171'
                      }}>
                        <span>{msg.verificationStatus === 'VERIFIED' ? '✓ VERIFIED OUTCOME' : '⚠ UNVERIFIED'}</span>
                        {msg.verificationDetails && (
                          <span style={{ color: '#64748b' }}>• {msg.verificationDetails}</span>
                        )}
                      </div>
                    )}

                    {/* On-Demand Audio Spoken Output (Listen Button) */}
                    {msg.sender === 'megh' && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleSpeakMessage(msg.id, msg.text)}
                          style={{
                            background: speakingMsgId === msg.id ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            border: `1px solid ${speakingMsgId === msg.id ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                            color: speakingMsgId === msg.id ? '#fca5a5' : '#38bdf8',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.15s ease'
                          }}
                          title={speakingMsgId === msg.id ? 'Stop audio' : 'Speak this response on Windows speakers'}
                        >
                          <span>{speakingMsgId === msg.id ? '■ Stop' : '🔊 Listen'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bottom Floating Command Bar */}
              <div style={{
                padding: '16px 32px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '24px',
                  padding: '8px 18px',
                  backdropFilter: 'blur(16px)',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)'
                }}>
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSendMessage(inputText);
                    }}
                    placeholder="Ask Megh, create a note, daily brief... (Ctrl+Space for Palette)"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#f8fafc',
                      fontSize: '14px',
                      fontFamily: 'inherit'
                    }}
                  />
                  <button
                    onClick={() => handleSendMessage(inputText)}
                    style={{
                      background: 'linear-gradient(135deg, #00f0ff, #8a2be2)',
                      border: 'none',
                      borderRadius: '16px',
                      color: '#07090e',
                      padding: '6px 14px',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Send
                  </button>
                </div>

                {/* Quick Palette Button */}
                <button
                  onClick={() => setIsCommandPaletteOpen(true)}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                  title="Open Universal Command Palette (Ctrl+Space)"
                >
                  ⌘
                </button>
              </div>
            </>
          )}

          {activeTab === 'notes' && <NotesCenter />}
          {activeTab === 'tasks' && <TaskCenter />}
          {activeTab === 'memory' && <MemoryCenter />}
          {activeTab === 'knowledge' && <KnowledgeCenter />}
          {activeTab === 'voice' && <VoiceStudio />}
          {activeTab === 'routines' && <RoutineCenter />}
          {activeTab === 'providers' && <ProviderCenter />}
          {activeTab === 'permissions' && <PermissionCenter />}
        </main>

        {/* Right Panel: Action Timeline */}
        <aside style={{ width: '320px', height: '100%' }}>
          <ActionTimeline events={events} />
        </aside>
      </div>

      {/* Universal Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSubmit={handleSendMessage}
      />
    </div>
  );
};
