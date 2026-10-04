import React, { useState, useEffect, useRef } from 'react';
import type { AIState, MeghAIEvent, MicrophoneState, VoiceInputState, OnlineSystemStatus } from '@meghai/shared-types';
import { AmbientBackground } from './components/AmbientBackground.js';
import { NavRail } from './components/NavRail.js';
import { TopHUD } from './components/TopHUD.js';
import { AICore } from './components/AICore.js';
import { ConversationLayer, type ChatMessage } from './components/ConversationLayer.js';
import { Composer } from './components/Composer.js';
import { ActionTrail } from './components/ActionTrail.js';
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
import { soundEngine } from './sound/soundEngine.js';

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
  // ── Core AI State ──────────────────────────────────────────────────────────
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
  const seenEventIds = useRef(new Set<string>());

  // ── UI State ───────────────────────────────────────────────────────────────
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
  const [isVoiceSelectorOpen, setIsVoiceSelectorOpen] = useState(false);
  const [isPersonalitySelectorOpen, setIsPersonalitySelectorOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isTrailOpen, setIsTrailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  // ── Personality / Providers ────────────────────────────────────────────────
  const [selectedPersonalityId, setSelectedPersonalityId] = useState<string>(() => {
    try { return localStorage.getItem('meghai_selected_personality_id') || 'futuristic'; } catch { return 'futuristic'; }
  });
  const [selectedPersonalityName, setSelectedPersonalityName] = useState<string>(() => {
    try { return localStorage.getItem('meghai_selected_personality_name') || 'Futuristic'; } catch { return 'Futuristic'; }
  });
  const [personalityStyle, setPersonalityStyle] = useState<string>('orbital');

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try { return localStorage.getItem('meghai_selected_provider') || 'local-ollama'; } catch { return 'local-ollama'; }
  });
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(() => {
    try { return localStorage.getItem('meghai_selected_model_id') || 'llama3.2:latest'; } catch { return 'llama3.2:latest'; }
  });
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => {
    try { return localStorage.getItem('meghai_selected_voice_id') || 'onecore-heera'; } catch { return 'onecore-heera'; }
  });
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(() => {
    try { return localStorage.getItem('meghai_selected_voice_name') || 'Heera'; } catch { return 'Heera'; }
  });

  const hasPlayedStartupRef = useRef(false);

  // ── Keyboard Shortcuts & First Gesture ────────────────────────────────────
  useEffect(() => {
    const handleFirstGesture = () => {
      if (!hasPlayedStartupRef.current) {
        hasPlayedStartupRef.current = true;
        soundEngine.playStartup();
      }
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      handleFirstGesture();
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // ── SSE Event Stream ───────────────────────────────────────────────────────
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
          if (mEvt.id) {
            if (seenEventIds.current.has(mEvt.id)) return;
            seenEventIds.current.add(mEvt.id);
            if (seenEventIds.current.size > 2000) {
              const first = seenEventIds.current.values().next().value;
              if (first) seenEventIds.current.delete(first);
            }
          }
          setEvents(prev => [mEvt, ...prev.slice(0, 99)]);

          // ── Sound & State Routing ────────────────────────────────────────
          if (mEvt.type === 'WAKE_DETECTED' || mEvt.type === 'WAKE_ACTIVATION_STARTED') {
            soundEngine.playWake();
          } else if (mEvt.type === 'MIC_STARTING') {
            setMicState('MIC_STARTING');
          } else if (mEvt.type === 'MIC_LISTENING') {
            setMicState('MIC_LISTENING');
            soundEngine.playListening();
          } else if (mEvt.type === 'MODEL_STARTED') {
            soundEngine.startThinkingTexture();
          } else if (mEvt.type === 'MODEL_COMPLETED') {
            soundEngine.stopThinkingTexture();
          } else if (
            mEvt.type === 'KILLSWITCH_ACTIVATED' ||
            mEvt.type === 'KILL_SWITCH_ACTIVATED' ||
            mEvt.type === 'INTERRUPTED' ||
            mEvt.type === 'TTS_INTERRUPTED'
          ) {
            soundEngine.playInterruption();
            setAiState('STOPPED');
            setSpeakingMsgId(null);
          } else if (mEvt.type === 'KILLSWITCH_RESET' || mEvt.type === 'KILL_SWITCH_RESET') {
            soundEngine.playWake();
            setAiState('READY');
            setSpeakingMsgId(null);
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
              if (payload.state === 'IDLE') setLiveTranscript(null);
            }
          } else if (mEvt.type === 'TRANSCRIPT_PARTIAL') {
            const payload = mEvt.payload as { text?: string };
            if (payload?.text) setLiveTranscript(payload.text);
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
              const rawSuffix =
                payload?.rawText &&
                payload?.interpretedText &&
                payload.rawText !== payload.interpretedText
                  ? ` (raw: "${payload.rawText}")`
                  : '';
              const userBubbleText = `🎙️ ${displayText}${rawSuffix}`;
              const msgId = payload?.commandId ? `usr-voice-${payload.commandId}` : `usr-voice-${Date.now()}`;
              setMessages(prev => {
                if (prev.some(m => m.id === msgId || (m.sender === 'user' && m.text === userBubbleText))) return prev;
                return [
                  ...prev,
                  { id: msgId, sender: 'user', text: userBubbleText, timestamp: new Date().toLocaleTimeString() }
                ];
              });
            }
          } else if (mEvt.type === 'TASK_COMPLETED') {
            setLiveTranscript(null);
            soundEngine.playAnswerReady();
            const payload = mEvt.payload as {
              reply?: string;
              verificationStatus?: any;
              verificationDetails?: string;
              commandId?: string;
              timelineCorrelationId?: string;
              provider?: string;
              modelId?: string;
            };
            const corrId = payload?.commandId || payload?.timelineCorrelationId || mEvt.correlationId;
            if (payload?.reply) {
              const respId = corrId ? `megh-resp-${corrId}` : `megh-resp-${Date.now()}`;
              setMessages(prev => {
                const existingIdx = prev.findIndex(m =>
                  (corrId && (m.id === `megh-resp-${corrId}` || m.id.includes(corrId))) || m.id === respId
                );
                if (existingIdx >= 0) {
                  const next = [...prev];
                  next[existingIdx] = {
                    ...next[existingIdx],
                    text: payload.reply!,
                    verificationStatus: payload.verificationStatus,
                    verificationDetails: payload.verificationDetails,
                    provider: payload.provider || next[existingIdx].provider,
                    modelId: payload.modelId || next[existingIdx].modelId
                  };
                  return next;
                }
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
            soundEngine.playError();
            const payload = mEvt.payload as { reply?: string; error?: string; commandId?: string };
            const errorReply = payload?.reply || (payload?.error ? `Error: ${payload.error}` : 'Unable to complete request.');
            const errId = payload?.commandId ? `megh-err-${payload.commandId}` : `megh-err-${Date.now()}`;
            setMessages(prev => {
              if (prev.some(m => m.id === errId || m.text === errorReply)) return prev;
              return [
                ...prev,
                { id: errId, sender: 'megh', text: errorReply, verificationStatus: 'FAILED', timestamp: new Date().toLocaleTimeString() }
              ];
            });
          } else if (mEvt.type === 'VOICE_NO_SPEECH_DETECTED') {
            setLiveTranscript(null);
            setAiState('READY');
          } else if (mEvt.type === 'TTS_FALLBACK') {
            const payload = mEvt.payload as { originalVoiceId?: string; fallbackVoiceId?: string; reason?: string };
            console.warn(`[MeghAI TTS Fallback] ${payload?.originalVoiceId} -> ${payload?.fallbackVoiceId}. Reason: ${payload?.reason}`);
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

    // Initial status checks
    fetch('/api/v1/system/status')
      .then(res => res.json())
      .then((data: any) => { if (data.onlineStatus) setOnlineStatus(data.onlineStatus); })
      .catch(() => { setOnlineStatus('NETWORK_UNAVAILABLE'); });

    fetch('/api/v1/voice/mic/status')
      .then(res => res.json())
      .then((data: any) => {
        if (data?.state) setMicState(data.state);
        if (data?.voiceInputState) setVoiceInputState(data.voiceInputState);
      })
      .catch(() => {});

    fetch('/api/v1/voice/settings')
      .then(res => res.json())
      .then((data: any) => {
        if (data?.autoSpeak) setAutoSpeak(data.autoSpeak);
        if (data?.selectedVoiceId) {
          setSelectedVoiceId(data.selectedVoiceId);
          const cleanName = data.selectedVoiceId.replace(/^onecore-|^local-/, '');
          setSelectedVoiceName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
        }
      })
      .catch(() => {});

    fetch('/api/v1/model/settings')
      .then(res => res.json())
      .then((data: any) => {
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

    fetch('/api/v1/personalities/active')
      .then(res => res.json())
      .then((data: any) => {
        if (data?.id) {
          setSelectedPersonalityId(data.id);
          setSelectedPersonalityName(data.name || data.id);
          if (data.visualStyle) setPersonalityStyle(data.visualStyle);
        }
      })
      .catch(() => {});

    return () => { eventSource.close(); };
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
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
        body: JSON.stringify({ selectedProvider: providerId, selectedModel: modelId })
      });
    } catch (err) {
      console.error('[MeghAI UI] Failed to persist model settings:', err);
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

  const handleSelectVoice = async (voiceId: string, providerId?: string) => {
    setSelectedVoiceId(voiceId);
    const cleanName = voiceId.replace(/^onecore-|^local-|^eleven-|^goog-|^openai-/, '');
    setSelectedVoiceName(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    try {
      localStorage.setItem('meghai_selected_voice_id', voiceId);
      localStorage.setItem('meghai_selected_voice_name', cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    } catch {}
    try {
      let provider = providerId;
      if (!provider) {
        if (voiceId.startsWith('eleven-') || voiceId.startsWith('elevenlabs-')) provider = 'elevenlabs';
        else if (voiceId.startsWith('goog-') || voiceId.startsWith('google-')) provider = 'google-cloud';
        else if (voiceId.startsWith('openai-')) provider = 'openai';
        else if (voiceId.startsWith('onecore-') || voiceId.startsWith('sapi-') || voiceId.startsWith('local-')) provider = 'windows-onecore';
      }
      await fetch('/api/v1/voice/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedVoiceId: voiceId, ...(provider ? { selectedProvider: provider } : {}) })
      });
    } catch {}
  };

  const handleSpeakMessage = async (msgId: string, text: string) => {
    if (speakingMsgId === msgId) {
      try { await fetch('/api/v1/voice/stop', { method: 'POST' }); } catch {}
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
    const commandId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const userMsg: ChatMessage = {
      id: `usr-${commandId}`,
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
        body: JSON.stringify({ text, commandId, providerId: selectedModel, modelId: selectedModelId })
      });
      const data = await res.json() as any;
      const corrId = data.timelineCorrelationId || commandId;
      const meghMsgId = `megh-resp-${corrId}`;
      const meghMsg: ChatMessage = {
        id: meghMsgId,
        sender: 'megh',
        text: data.reply || data.clarificationPrompt || JSON.stringify(data),
        verificationStatus: data.verificationStatus,
        verificationDetails: data.verificationDetails,
        provider: data.provider,
        modelId: data.modelId,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => {
        const existingIdx = prev.findIndex(m =>
          m.id === meghMsgId || (m.sender === 'megh' && (m.id.includes(corrId) || m.id.includes(commandId)))
        );
        if (existingIdx >= 0) {
          const next = [...prev];
          next[existingIdx] = { ...next[existingIdx], ...meghMsg };
          return next;
        }
        return [...prev, meghMsg];
      });
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
    soundEngine.playInterruption();
    try {
      await fetch('/api/v1/system/kill', { method: 'POST' });
      setAiState('STOPPED');
      setMicState('MIC_OFF');
      setMicLevel(0);
      setSpeakingMsgId(null);
    } catch {
      setAiState('STOPPED');
    }
  };

  const handleResetEmergencyStop = async () => {
    soundEngine.playWake();
    try {
      const res = await fetch('/api/v1/system/kill/reset', { method: 'POST' });
      const data = await res.json() as any;
      if (data.success) setAiState('READY');
    } catch {
      setAiState('READY');
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
        const res = await fetch('/api/v1/voice/mic/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'command', reason: 'User toggled microphone button' })
        });
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Ambient computational physics background (fixed, fullscreen) */}
      <AmbientBackground aiState={aiState} voiceInputState={voiceInputState} micLevel={micLevel} />

      {/* Left Nav Rail */}
      <NavRail
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onToggleTimeline={() => setIsTrailOpen(prev => !prev)}
        eventCount={events.filter(e => e.type !== 'MIC_LEVEL' && (e.type as string) !== 'HEARTBEAT').length}
      />

      {/* Top HUD strip */}
      <TopHUD
        aiState={aiState}
        micState={micState}
        voiceInputState={voiceInputState}
        micLevel={micLevel}
        onlineStatus={onlineStatus}
        autoSpeak={autoSpeak}
        selectedModel={selectedModel}
        selectedVoiceName={selectedVoiceName}
        selectedPersonalityName={selectedPersonalityName}
        onToggleAutoSpeak={handleToggleAutoSpeak}
        onToggleMic={handleToggleMic}
        onOpenModelSelector={() => setIsModelSelectorOpen(true)}
        onOpenVoiceSelector={() => setIsVoiceSelectorOpen(true)}
        onOpenPersonalitySelector={() => setIsPersonalitySelectorOpen(true)}
        onEmergencyStop={handleEmergencyStop}
        onResetEmergencyStop={handleResetEmergencyStop}
      />

      {/* Main Workspace */}
      <main className="workspace">
        {/* ── Console (Home) ───────────────────────────────────────────── */}
        {activeTab === 'home' && (
          <div className="console-layout">
            {/* Living Brain */}
            <div className="brain-container">
              <AICore
                state={aiState}
                size={220}
                micLevel={micLevel}
                voiceInputState={voiceInputState}
                personalityStyle={personalityStyle}
              />
              <div
                className="brain-state-label"
                style={{
                  color: aiState === 'LISTENING' ? '#5cb8c5'
                    : aiState === 'SPEAKING' ? '#859bb0'
                    : aiState === 'ROUTING' || aiState === 'PLANNING' || aiState === 'RESPONDING' ? '#7a8ea3'
                    : aiState === 'EXECUTING' ? '#5c8fa8'
                    : aiState === 'STOPPED' || aiState === 'FAILED' ? '#bf5049'
                    : '#3f4551'
                }}
              >
                {aiState}
              </div>
            </div>

            {/* Conversation */}
            <ConversationLayer
              messages={messages}
              speakingMsgId={speakingMsgId}
              onSpeakMessage={handleSpeakMessage}
              onSelectPrompt={prompt => handleSendMessage(prompt)}
            />

            {/* Action Trail (compact inline event stream) */}
            <ActionTrail
              events={events}
              isOpen={isTrailOpen}
              onToggle={() => setIsTrailOpen(prev => !prev)}
            />

            {/* Command Composer */}
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

        {/* ── Workspace Centers ────────────────────────────────────────── */}
        {activeTab === 'notes' && <NotesCenter />}
        {activeTab === 'tasks' && <TaskCenter />}
        {activeTab === 'memory' && <MemoryCenter />}
        {activeTab === 'knowledge' && <KnowledgeCenter />}
        {activeTab === 'voice' && <VoiceStudio />}
        {activeTab === 'routines' && <RoutineCenter />}
        {activeTab === 'providers' && <ProviderCenter />}
        {activeTab === 'permissions' && <PermissionCenter />}
      </main>

      {/* Legacy Timeline Drawer (kept for full event access) */}
      <ActionTimelineDrawer
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        events={events}
      />

      {/* Modals */}
      <ModelSelectorModal
        isOpen={isModelSelectorOpen}
        selectedProvider={selectedModel}
        onSelectProvider={handleSelectModel}
        onClose={() => setIsModelSelectorOpen(false)}
        onOpenProviderCenter={() => setActiveTab('providers')}
      />

      <VoiceSelectorModal
        isOpen={isVoiceSelectorOpen}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={handleSelectVoice}
        onClose={() => setIsVoiceSelectorOpen(false)}
      />

      <PersonalitySelectorModal
        isOpen={isPersonalitySelectorOpen}
        selectedPersonalityId={selectedPersonalityId}
        onSelectPersonality={profile => {
          setSelectedPersonalityId(profile.id);
          setSelectedPersonalityName(profile.name);
          setPersonalityStyle(profile.visualStyle);
          try {
            localStorage.setItem('meghai_selected_personality_id', profile.id);
            localStorage.setItem('meghai_selected_personality_name', profile.name);
          } catch {}
        }}
        onClose={() => setIsPersonalitySelectorOpen(false)}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSubmit={handleSendMessage}
      />
    </>
  );
};
