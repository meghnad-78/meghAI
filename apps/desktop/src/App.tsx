import React, { useState, useEffect } from 'react';
import type { AIState, MeghAIEvent, MicrophoneState, VoiceInputState, OnlineSystemStatus } from '@meghai/shared-types';
import { AICore } from './components/AICore.js';
import { TopBar } from './components/TopBar.js';
import { ChatView, type ChatMessage } from './components/ChatView.js';
import { Composer } from './components/Composer.js';
import { ActionTimelineDrawer } from './components/ActionTimelineDrawer.js';
import { ModelSelectorModal } from './components/ModelSelectorModal.js';
import { VoiceSelectorModal } from './components/VoiceSelectorModal.js';
import { PersonalitySelectorModal } from './components/PersonalitySelectorModal.js';
import { CommandPalette } from './components/CommandPalette.js';
import { NotesCenter } from './components/NotesCenter.js';
import { TaskCenter } from './components/TaskCenter.js';
import { MemoryCenter } from './components/MemoryCenter.js';
import { KnowledgeCenter } from './components/KnowledgeCenter.js';
import { VoiceStudio } from './components/VoiceStudio.js';
import { RoutineCenter } from './components/RoutineCenter.js';
import { ProviderCenter } from './components/ProviderCenter.js';
import { PermissionCenter } from './components/PermissionCenter.js';
import { tokens } from './theme/tokens.js';

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
  const [onlineStatus, setOnlineStatus] = useState<OnlineSystemStatus>('ONLINE');
  const [autoSpeak, setAutoSpeak] = useState<'OFF' | 'ON' | 'ASK'>('ON');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [events, setEvents] = useState<MeghAIEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
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
  const [liveTranscript, setLiveTranscript] = useState<string | null>(null);

  // Modals & Panels State
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isVoiceSelectorOpen, setIsVoiceSelectorOpen] = useState(false);
  const [isPersonalitySelectorOpen, setIsPersonalitySelectorOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  // Selected Personality
  const [selectedPersonalityId, setSelectedPersonalityId] = useState<string>('futuristic');
  const [selectedPersonalityName, setSelectedPersonalityName] = useState<string>('Futuristic');
  const [personalityStyle, setPersonalityStyle] = useState<string>('orbital');

  // Selected Providers & Voices (Loaded from persistent store + localStorage cache)
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      return localStorage.getItem('meghai_selected_provider') || 'local-ollama';
    } catch {
      return 'local-ollama';
    }
  });
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem('meghai_selected_model_id') || 'llama3.2:latest';
    } catch {
      return 'llama3.2:latest';
    }
  });
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('onecore-heera');
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('Heera');

  // Global Keyboard Shortcuts (Ctrl+Space for Palette)
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
            setLiveTranscript(null);
          } else if (mEvt.type === 'MIC_OFF') {
            setMicState('MIC_OFF');
            setVoiceInputState('IDLE');
            setMicLevel(0);
            setLiveTranscript(null);
            setAiState(prev => prev === 'LISTENING' ? 'READY' : prev);
          } else if (mEvt.type === 'MIC_DEVICE_UNAVAILABLE') {
            setMicState('MIC_DEVICE_UNAVAILABLE');
            setVoiceInputState('IDLE');
            setMicLevel(0);
            setLiveTranscript(null);
          } else if (mEvt.type === 'VOICE_INPUT_STATE_CHANGED') {
            const payload = mEvt.payload as { state: VoiceInputState };
            if (payload?.state) {
              setVoiceInputState(payload.state);
              if (payload.state === 'IDLE') {
                setLiveTranscript(null);
              }
            }
          } else if (mEvt.type === 'TRANSCRIPT_PARTIAL') {
            // Streaming / interim transcript preview: isolated to preview chip
            const payload = mEvt.payload as { text?: string };
            if (payload?.text) {
              setLiveTranscript(payload.text);
            }
          } else if (mEvt.type === 'TRANSCRIPT_FINAL') {
            setLiveTranscript(null);
            const payload = mEvt.payload as {
              commandId?: string;
              voiceSessionId?: string;
              text?: string;
              rawText?: string;
              interpretedText?: string;
            };
            const displayText = payload?.interpretedText || payload?.text || payload?.rawText;
            if (displayText) {
              const rawSuffix = payload?.rawText && payload?.interpretedText && payload.rawText !== payload.interpretedText
                ? ` (raw: "${payload.rawText}")`
                : '';
              const userBubbleText = `🎙️ ${displayText}${rawSuffix}`;
              const msgId = payload?.commandId ? `usr-voice-${payload.commandId}` : `usr-voice-${Date.now()}`;
              setMessages(prev => {
                // Idempotency: Prevent duplicate message bubbles for the same voice command
                if (prev.some(m => m.id === msgId || (m.sender === 'user' && m.text === userBubbleText))) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    id: msgId,
                    sender: 'user',
                    text: userBubbleText,
                    timestamp: new Date().toLocaleTimeString()
                  }
                ];
              });
            }
          } else if (mEvt.type === 'TASK_COMPLETED') {
            setLiveTranscript(null);
            const payload = mEvt.payload as {
              reply?: string;
              verificationStatus?: any;
              verificationDetails?: string;
              commandId?: string;
              provider?: string;
              modelId?: string;
            };
            if (payload?.reply) {
              const respId = payload?.commandId ? `megh-resp-${payload.commandId}` : `megh-resp-${Date.now()}`;
              setMessages(prev => {
                if (prev.some(m => m.id === respId || m.text === payload.reply)) return prev;
                return [
                  ...prev,
                  {
                    id: respId,
                    sender: 'megh',
                    text: payload.reply!,
                    verificationStatus: payload.verificationStatus,
                    verificationDetails: payload.verificationDetails,
                    provider: payload.provider,
                    modelId: payload.modelId,
                    timestamp: new Date().toLocaleTimeString()
                  }
                ];
              });
            }
          } else if (mEvt.type === 'TASK_FAILED' || mEvt.type === 'VOICE_MODEL_RATE_LIMITED') {
            setLiveTranscript(null);
            const payload = mEvt.payload as {
              reply?: string;
              error?: string;
              commandId?: string;
            };
            const errorReply = payload?.reply || (payload?.error ? `⚠️ ${payload.error}` : 'Unable to complete request.');
            const errId = payload?.commandId ? `megh-err-${payload.commandId}` : `megh-err-${Date.now()}`;
            setMessages(prev => {
              if (prev.some(m => m.id === errId || m.text === errorReply)) return prev;
              return [
                ...prev,
                {
                  id: errId,
                  sender: 'megh',
                  text: errorReply,
                  verificationStatus: 'FAILED',
                  timestamp: new Date().toLocaleTimeString()
                }
              ];
            });
          } else if (mEvt.type === 'PERSONALITY_SETTINGS_CHANGED') {
            const payload = mEvt.payload as { activeProfile?: any };
            if (payload?.activeProfile) {
              setSelectedPersonalityId(payload.activeProfile.id);
              setSelectedPersonalityName(payload.activeProfile.name || payload.activeProfile.id);
              if (payload.activeProfile.visualStyle) setPersonalityStyle(payload.activeProfile.visualStyle);
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
        if (data.onlineStatus) {
          setOnlineStatus(data.onlineStatus);
        }
      })
      .catch(() => {
        setOnlineStatus('NETWORK_UNAVAILABLE');
      });

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

    // Check voice settings (including persistent autoSpeak mode and selected voice)
    fetch('/api/v1/voice/settings')
      .then(res => res.json())
      .then(data => {
        if (data?.autoSpeak) {
          setAutoSpeak(data.autoSpeak);
        }
        if (data?.selectedVoiceId) {
          setSelectedVoiceId(data.selectedVoiceId);
          const cleanName = data.selectedVoiceId.replace(/^onecore-|^local-/, '');
          setSelectedVoiceName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
      })
      .catch(() => {});

    // Check model settings (including persistent selected model provider)
    fetch('/api/v1/model/settings')
      .then(res => res.json())
      .then(data => {
        if (data?.selectedProvider) {
          setSelectedModel(data.selectedProvider);
          if (data?.selectedModel) setSelectedModelId(data.selectedModel);
          try {
            localStorage.setItem('meghai_selected_provider', data.selectedProvider);
            if (data?.selectedModel) localStorage.setItem('meghai_selected_model_id', data.selectedModel);
          } catch {}
        }
      })
      .catch(() => {});

    // Check personality settings
    fetch('/api/v1/personalities/active')
      .then(res => res.json())
      .then(data => {
        if (data?.id) {
          setSelectedPersonalityId(data.id);
          setSelectedPersonalityName(data.name || data.id);
          if (data.visualStyle) setPersonalityStyle(data.visualStyle);
        }
      })
      .catch(() => {});

    return () => {
      eventSource.close();
    };
  }, []);

  const handleSelectModel = async (providerId: string, modelId?: string) => {
    setSelectedModel(providerId);
    setSelectedModelId(modelId);
    try {
      localStorage.setItem('meghai_selected_provider', providerId);
      if (modelId) localStorage.setItem('meghai_selected_model_id', modelId);
      else localStorage.removeItem('meghai_selected_model_id');
      await fetch('/api/v1/model/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedProvider: providerId,
          selectedModel: modelId
        })
      });
    } catch (err) {
      console.error('[MeghAI UI] Failed to persist model settings to server:', err);
    }
  };

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

  const handleSelectVoice = async (voiceId: string) => {
    setSelectedVoiceId(voiceId);
    const cleanName = voiceId.replace(/^onecore-|^local-/, '');
    setSelectedVoiceName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    try {
      await fetch('/api/v1/voice/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedVoiceId: voiceId })
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
        body: JSON.stringify({ text, voiceId: selectedVoiceId })
      });
    } catch {} finally {
      setSpeakingMsgId(null);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
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
        body: JSON.stringify({
          text,
          providerId: selectedModel,
          modelId: selectedModelId
        })
      });
      const data = await res.json() as any;

      const meghMsg: ChatMessage = {
        id: `megh-${Date.now()}`,
        sender: 'megh',
        text: data.reply || data.clarificationPrompt || JSON.stringify(data),
        verificationStatus: data.verificationStatus,
        verificationDetails: data.verificationDetails,
        provider: data.provider,
        modelId: data.modelId,
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        background: tokens.colors.bg.canvas,
        color: tokens.colors.text.primary,
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Master Top Bar */}
      <TopBar
        aiState={aiState}
        micState={micState}
        voiceInputState={voiceInputState}
        micLevel={micLevel}
        onlineStatus={onlineStatus}
        autoSpeak={autoSpeak}
        selectedModel={selectedModel}
        selectedVoiceName={selectedVoiceName}
        selectedPersonalityName={selectedPersonalityName}
        eventCount={events.length}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onToggleAutoSpeak={handleToggleAutoSpeak}
        onToggleMic={handleToggleMic}
        onOpenModelSelector={() => setIsModelSelectorOpen(true)}
        onOpenVoiceSelector={() => setIsVoiceSelectorOpen(true)}
        onOpenPersonalitySelector={() => setIsPersonalitySelectorOpen(true)}
        onToggleTimeline={() => setIsTimelineOpen(prev => !prev)}
        onEmergencyStop={handleEmergencyStop}
      />

      {/* Main Workspace Frame */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at 50% 12%, rgba(0, 240, 255, 0.04) 0%, rgba(4, 6, 10, 0) 65%)'
        }}
      >
        {activeTab === 'home' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Signature Central AI Core Visualization */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '12px 0 0',
                flexShrink: 0
              }}
            >
              <AICore
                state={aiState}
                size={230}
                micLevel={micLevel}
                voiceInputState={voiceInputState}
                personalityStyle={personalityStyle}
              />
            </div>

            {/* Editorial Conversation View */}
            <ChatView
              messages={messages}
              speakingMsgId={speakingMsgId}
              onSpeakMessage={handleSpeakMessage}
              onSelectPrompt={prompt => handleSendMessage(prompt)}
            />

            {/* Premium Command Composer */}
            <Composer
              value={inputText}
              onChange={setInputText}
              onSend={handleSendMessage}
              selectedModel={selectedModel}
              onOpenModelSelector={() => setIsModelSelectorOpen(true)}
              micState={micState}
              voiceInputState={voiceInputState}
              micLevel={micLevel}
              onToggleMic={handleToggleMic}
              liveTranscript={liveTranscript}
              onOpenPalette={() => setIsCommandPaletteOpen(true)}
            />
          </div>
        )}

        {/* Dedicated Workspace Center Views */}
        {activeTab === 'notes' && <NotesCenter />}
        {activeTab === 'tasks' && <TaskCenter />}
        {activeTab === 'memory' && <MemoryCenter />}
        {activeTab === 'knowledge' && <KnowledgeCenter />}
        {activeTab === 'voice' && <VoiceStudio />}
        {activeTab === 'routines' && <RoutineCenter />}
        {activeTab === 'providers' && <ProviderCenter />}
        {activeTab === 'permissions' && <PermissionCenter />}
      </main>

      {/* Contextual Action Timeline Drawer */}
      <ActionTimelineDrawer
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        events={events}
      />

      {/* First-Class Model Provider Selector Modal */}
      <ModelSelectorModal
        isOpen={isModelSelectorOpen}
        selectedProvider={selectedModel}
        onSelectProvider={handleSelectModel}
        onClose={() => setIsModelSelectorOpen(false)}
        onOpenProviderCenter={() => setActiveTab('providers')}
      />

      {/* First-Class Voice Selector Modal */}
      <VoiceSelectorModal
        isOpen={isVoiceSelectorOpen}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={handleSelectVoice}
        onClose={() => setIsVoiceSelectorOpen(false)}
      />

      {/* First-Class Personality Selector Modal */}
      <PersonalitySelectorModal
        isOpen={isPersonalitySelectorOpen}
        selectedPersonalityId={selectedPersonalityId}
        onSelectPersonality={profile => {
          setSelectedPersonalityId(profile.id);
          setSelectedPersonalityName(profile.name);
          setPersonalityStyle(profile.visualStyle);
        }}
        onClose={() => setIsPersonalitySelectorOpen(false)}
      />

      {/* Universal Command Palette (Ctrl+Space) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSubmit={handleSendMessage}
      />
    </div>
  );
};
