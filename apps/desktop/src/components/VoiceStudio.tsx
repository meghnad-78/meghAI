import React, { useState, useEffect } from 'react';
import type {
  VoiceProfile,
  PersonalityMode,
  VoiceSettings,
  AutoSpeakMode,
  MicrophoneState,
  AudioCaptureDiagnostics,
  AudioCueType
} from '@meghai/shared-types';
import { tokens } from '../theme/tokens.js';
import { Icons } from './ui/Icons.js';

export const VoiceStudio: React.FC = () => {
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [catalogStats, setCatalogStats] = useState<{
    totalVoices: number;
    totalOfflineReady: number;
    totalCloud: number;
    totalAvailable: number;
    providers: Record<string, { total: number; available: number }>;
  } | null>(null);

  const [settings, setSettings] = useState<VoiceSettings>({
    selectedVoiceId: 'onecore-heera',
    speechRate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    personalityMode: 'FUTURISTIC_COMPANION',
    autoSpeak: 'ON'
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [characteristicFilter, setCharacteristicFilter] = useState('');
  const [naturalnessFilter, setNaturalnessFilter] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const [previewText, setPreviewText] = useState('Greetings. I am MeghAI, your personal intelligence layer.');
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeVoicePlaying, setActiveVoicePlaying] = useState<string | null>(null);

  // Audio Cue State
  const [activeCuePlaying, setActiveCuePlaying] = useState<string | null>(null);
  const [cueStatus, setCueStatus] = useState<string | null>(null);

  // Native Microphone Capture & Acoustic Telemetry State
  const [micState, setMicState] = useState<MicrophoneState>('MIC_OFF');
  const [micDiagnostics, setMicDiagnostics] = useState<AudioCaptureDiagnostics | null>(null);
  const [inputDevices, setInputDevices] = useState<Array<{ id: number; name: string; channels: number }>>([]);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [isMicLoading, setIsMicLoading] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [ttsFallbackEvent, setTtsFallbackEvent] = useState<{ originalVoiceId?: string; fallbackVoiceId?: string; reason?: string } | null>(null);

  const loadData = async () => {
    try {
      const [vRes, sRes, statsRes] = await Promise.all([
        fetch('/api/v1/voice/catalog'),
        fetch('/api/v1/voice/settings'),
        fetch('/api/v1/voice/catalog/stats').catch(() => null)
      ]);
      const vData = await vRes.json();
      const sData = await sRes.json();
      if (Array.isArray(vData)) setVoices(vData);
      if (sData?.selectedVoiceId) setSettings(sData);
      if (statsRes && statsRes.ok) {
        const statsData = await statsRes.json();
        setCatalogStats(statsData);
      }
    } catch {
      // Fallback
    }
  };

  const loadMicData = async () => {
    try {
      const [sRes, dRes] = await Promise.all([
        fetch('/api/v1/voice/mic/status'),
        fetch('/api/v1/voice/mic/devices')
      ]);
      const sData = await sRes.json();
      const dData = await dRes.json();
      if (sData?.state) {
        setMicState(sData.state);
        setMicDiagnostics(sData.diagnostics || null);
        if (sData.diagnostics?.normalizedLevel !== undefined) {
          setMicLevel(sData.diagnostics.normalizedLevel);
        }
      }
      if (Array.isArray(dData?.devices)) {
        setInputDevices(dData.devices);
      }
    } catch {}
  };

  useEffect(() => {
    loadData();
    loadMicData();

    fetch('/api/v1/voice/diagnostics/last')
      .then(res => res.json())
      .then(data => { if (data) setDiagnostics(data); })
      .catch(() => {});

    const eventSource = new EventSource('/api/v1/events/stream');
    eventSource.onmessage = e => {
      try {
        const evt = JSON.parse(e.data);
        if (evt.type === 'MIC_LEVEL') {
          const payload = evt.payload;
          setMicLevel(payload.normalizedLevel ?? 0);
          setMicDiagnostics(prev => prev ? {
            ...prev,
            currentRms: payload.rms,
            peakLevel: payload.peak,
            normalizedLevel: payload.normalizedLevel,
            frameCount: payload.sequenceNumber
          } : null);
        } else if (evt.type === 'MIC_STARTING') {
          setMicState('MIC_STARTING');
        } else if (evt.type === 'MIC_LISTENING') {
          setMicState('MIC_LISTENING');
        } else if (evt.type === 'MIC_STOPPING') {
          setMicState('MIC_STOPPING');
        } else if (evt.type === 'MIC_OFF') {
          setMicState('MIC_OFF');
          setMicLevel(0);
        } else if (evt.type === 'MIC_DEVICE_UNAVAILABLE') {
          setMicState('MIC_DEVICE_UNAVAILABLE');
          setMicLevel(0);
        } else if (evt.type === 'VOICE_DIAGNOSTICS_UPDATED') {
          if (evt.payload?.diagnostic) setDiagnostics(evt.payload.diagnostic);
        } else if (evt.type === 'TTS_FALLBACK' || evt.type === 'TTS_FALLBACK_TRIGGERED') {
          setTtsFallbackEvent(evt.payload);
        } else if (evt.type === 'TTS_COMPLETED') {
          setTtsFallbackEvent(null);
        }
      } catch {}
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleToggleMic = async () => {
    setIsMicLoading(true);
    try {
      if (micState === 'MIC_LISTENING' || micState === 'MIC_STARTING') {
        setMicState('MIC_STOPPING');
        const res = await fetch('/api/v1/voice/mic/stop', { method: 'POST' });
        const data = await res.json();
        setMicState(data.state || 'MIC_OFF');
        setMicLevel(0);
      } else {
        setMicState('MIC_STARTING');
        const res = await fetch('/api/v1/voice/mic/start', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
          setMicState(data.state || 'MIC_LISTENING');
          setMicDiagnostics(data.diagnostics || null);
        } else {
          setMicState(data.state || 'MIC_ERROR');
        }
      }
    } catch {
      setMicState('MIC_ERROR');
    } finally {
      setIsMicLoading(false);
      loadMicData();
    }
  };

  const handleUpdateSettings = async (updates: Partial<VoiceSettings>) => {
    let extraUpdates = { ...updates };
    if (updates.selectedVoiceId && !updates.selectedProvider) {
      const vid = updates.selectedVoiceId;
      const matched = voices.find(v => v.id === vid);
      if (matched?.provider) {
        extraUpdates.selectedProvider = matched.provider;
      } else if (vid.startsWith('eleven-') || vid.startsWith('elevenlabs-')) {
        extraUpdates.selectedProvider = 'elevenlabs';
      } else if (vid.startsWith('goog-') || vid.startsWith('google-')) {
        extraUpdates.selectedProvider = 'google-cloud';
      } else if (vid.startsWith('openai-')) {
        extraUpdates.selectedProvider = 'openai';
      } else if (vid.startsWith('onecore-') || vid.startsWith('sapi-') || vid.startsWith('local-')) {
        extraUpdates.selectedProvider = 'windows-onecore';
      }
    }
    const next = { ...settings, ...extraUpdates };
    setSettings(next);
    try {
      await fetch('/api/v1/voice/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extraUpdates)
      });
    } catch {
      // Handle error
    }
  };

  const handlePreview = async (voiceId: string) => {
    if (isPlaying && activeVoicePlaying === voiceId) {
      handleStopPlayback();
      return;
    }

    setIsPlaying(true);
    setActiveVoicePlaying(voiceId);
    setPreviewStatus(`Synthesizing speech via audio endpoint...`);
    try {
      const res = await fetch('/api/v1/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, text: previewText, play: true })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setPreviewStatus(`Speech synthesis completed (${data.speechRate}x rate${data.durationMs ? `, ${data.durationMs}ms` : ''})`);
      } else {
        setPreviewStatus(`Synthesis error: ${data.error || 'Failed'}`);
      }
    } catch (err) {
      setPreviewStatus(`Preview failed: ${(err as Error).message}`);
    } finally {
      setIsPlaying(false);
      setActiveVoicePlaying(null);
      setTimeout(() => setPreviewStatus(null), 4000);
    }
  };

  const handlePlayCue = async (cue: AudioCueType) => {
    setActiveCuePlaying(cue);
    setCueStatus(`Synthesizing ${cue} acoustic cue...`);
    try {
      const res = await fetch('/api/v1/voice/cue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cue })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setCueStatus(`Procedural ${cue} executed (${data.format || '16kHz PCM WAV'})`);
      } else {
        setCueStatus(`Acoustic error: ${data.error || 'Failed'}`);
      }
    } catch (err) {
      setCueStatus(`Cue error: ${(err as Error).message}`);
    } finally {
      setTimeout(() => {
        setActiveCuePlaying(null);
        setCueStatus(null);
      }, 3000);
    }
  };

  const handleStopPlayback = async () => {
    try {
      await fetch('/api/v1/voice/stop', { method: 'POST' });
    } catch {}
    setIsPlaying(false);
    setActiveVoicePlaying(null);
    setActiveCuePlaying(null);
    setCueStatus(null);
    setPreviewStatus('Audio playback stopped.');
    setTimeout(() => setPreviewStatus(null), 2500);
  };

  const filteredVoices = voices.filter(v => {
    if (availableOnly && !v.available && !v.isAvailable) return false;
    if (languageFilter && !v.language.toLowerCase().includes(languageFilter.toLowerCase())) return false;
    if (providerFilter) {
      const pf = providerFilter.toLowerCase();
      if (pf === 'windows-sapi' || pf === 'local') {
        if (v.provider !== 'windows-sapi' && (v.provider as any) !== 'local') return false;
      } else if (pf === 'google-cloud-tts' || pf === 'google-cloud' || pf === 'google') {
        if (v.provider !== 'google-cloud' && (v.provider as any) !== 'google-cloud-tts' && (v.provider as any) !== 'google') return false;
      } else if (v.provider !== pf) {
        return false;
      }
    }
    if (naturalnessFilter && v.naturalness !== naturalnessFilter) return false;
    if (characteristicFilter && !(v.characteristics || []).some(c => c.toLowerCase() === characteristicFilter.toLowerCase())) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = v.name.toLowerCase().includes(q);
      const matchLang = v.language.toLowerCase().includes(q);
      const matchDesc = (v.description || '').toLowerCase().includes(q);
      const matchTone = (v.tone || '').toLowerCase().includes(q);
      const matchStyle = (v.style || '').toLowerCase().includes(q);
      const matchAccent = (v.accent || '').toLowerCase().includes(q);
      const matchProvider = (v.provider || '').toLowerCase().includes(q);
      const matchChar = (v.characteristics || []).some(c => c.toLowerCase().includes(q));
      if (!matchName && !matchLang && !matchDesc && !matchTone && !matchStyle && !matchAccent && !matchProvider && !matchChar) {
        return false;
      }
    }
    return true;
  });

  const personalities: Array<{ id: PersonalityMode; title: string; desc: string }> = [
    { id: 'FUTURISTIC_COMPANION', title: 'Futuristic Companion', desc: 'Omnipresent, analytical intelligence partner.' },
    { id: 'PROFESSIONAL', title: 'Executive Professional', desc: 'Direct, clear, action-oriented precision.' },
    { id: 'WARM', title: 'Warm & Empathetic', desc: 'Accessible, supportive, and conversational clarity.' },
    { id: 'CALM_ASSISTANT', title: 'Calm & Deliberate', desc: 'Minimalist, unhurried, focused acoustic pace.' }
  ];

  const autoSpeakModes: Array<{ mode: AutoSpeakMode; label: string; desc: string }> = [
    { mode: 'OFF', label: 'Silent Text', desc: 'Text-only responses. Audio synthesis remains dormant.' },
    { mode: 'ON', label: 'Continuous Speech', desc: 'Automatically synthesizes all conversational responses.' },
    { mode: 'ASK', label: 'On Demand', desc: 'Synthesizes only on explicit user request or push-to-talk.' }
  ];

  const proceduralCues: Array<{
    cue: AudioCueType;
    label: string;
    desc: string;
  }> = [
    { cue: 'startup', label: 'System Startup', desc: 'Ascending triad resonance' },
    { cue: 'listening', label: 'Listening Ping', desc: 'Dual-frequency acoustic detection' },
    { cue: 'thinking', label: 'Thinking Texture', desc: 'Sub-harmonic harmonic resonance' },
    { cue: 'answer_ready', label: 'Answer Ready', desc: 'Ascending triad resolution' },
    { cue: 'interrupt', label: 'Interruption Cue', desc: 'Falling damping brake' }
  ];

  const getProviderBadge = (provider: string) => {
    switch (provider) {
      case 'windows-onecore':
        return { label: 'Windows OneCore', color: tokens.colors.accent.primary };
      case 'windows-sapi':
      case 'local':
        return { label: 'Windows SAPI', color: tokens.colors.text.secondary };
      case 'google-cloud':
      case 'google-cloud-tts':
      case 'google':
        return { label: 'Google Cloud', color: tokens.colors.semantic.info };
      case 'elevenlabs':
        return { label: 'ElevenLabs', color: tokens.colors.semantic.success };
      case 'openai':
        return { label: 'OpenAI Speech', color: tokens.colors.semantic.warning };
      default:
        return { label: provider, color: tokens.colors.text.muted };
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '28px 36px',
        overflowY: 'auto',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Console Header */}
      <div
        style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
          paddingBottom: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: tokens.colors.accent.primary, display: 'flex', alignItems: 'center' }}>
              <Icons.Voice size={22} />
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: tokens.typography.sizes.xl,
                fontWeight: 600,
                color: tokens.colors.text.primary,
                letterSpacing: tokens.typography.letterSpacing.tight,
                fontFamily: tokens.typography.fontDisplay
              }}
            >
              Acoustic Console & Voice Studio
            </h2>
            {catalogStats && (
              <span
                style={{
                  fontSize: tokens.typography.sizes.xs,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: tokens.radii.sm,
                  background: tokens.colors.accent.primarySubtle,
                  border: `1px solid ${tokens.colors.border.accentSubtle}`,
                  color: tokens.colors.accent.primary,
                  fontFamily: tokens.typography.fontMono
                }}
              >
                {catalogStats.totalVoices} VOICES • 5 PROVIDERS
              </span>
            )}
          </div>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: tokens.typography.sizes.sm,
              color: tokens.colors.text.secondary
            }}
          >
            Multi-provider speech synthesis, procedural Web Audio cues, WASAPI acoustic telemetry, and output dispatch.
          </p>
        </div>

        {(isPlaying || activeCuePlaying) && (
          <button
            onClick={handleStopPlayback}
            style={{
              background: tokens.colors.semantic.errorMuted,
              border: `1px solid ${tokens.colors.semantic.error}`,
              color: tokens.colors.semantic.error,
              borderRadius: tokens.radii.sm,
              padding: '7px 14px',
              fontSize: tokens.typography.sizes.xs,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: tokens.typography.fontMono
            }}
          >
            <Icons.Stop size={13} />
            STOP AUDIO OUTPUT
          </button>
        )}
      </div>

      {/* Catalog Telemetry Strip */}
      {catalogStats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px',
            marginBottom: '20px'
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderRadius: tokens.radii.md,
              background: tokens.colors.bg.surface,
              border: `1px solid ${tokens.colors.border.default}`
            }}
          >
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
              Catalog Depth
            </div>
            <div style={{ fontSize: tokens.typography.sizes.xl, fontWeight: 600, color: tokens.colors.text.primary, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
              {catalogStats.totalVoices}
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.faint, marginTop: '2px' }}>
              Across 5 integrated providers
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: tokens.radii.md,
              background: tokens.colors.bg.surface,
              border: `1px solid ${tokens.colors.border.default}`
            }}
          >
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.accent.primary, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
              Offline Ready
            </div>
            <div style={{ fontSize: tokens.typography.sizes.xl, fontWeight: 600, color: tokens.colors.accent.primary, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
              {catalogStats.totalOfflineReady}
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.faint, marginTop: '2px' }}>
              Windows SAPI + OneCore (Local)
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: tokens.radii.md,
              background: tokens.colors.bg.surface,
              border: `1px solid ${tokens.colors.border.default}`
            }}
          >
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.semantic.info, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
              Cloud Synthesizers
            </div>
            <div style={{ fontSize: tokens.typography.sizes.xl, fontWeight: 600, color: tokens.colors.semantic.info, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
              {catalogStats.totalCloud}
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.faint, marginTop: '2px' }}>
              Google + ElevenLabs + OpenAI
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              borderRadius: tokens.radii.md,
              background: tokens.colors.bg.surface,
              border: `1px solid ${tokens.colors.border.default}`
            }}
          >
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.semantic.success, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
              Available Active
            </div>
            <div style={{ fontSize: tokens.typography.sizes.xl, fontWeight: 600, color: tokens.colors.semantic.success, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
              {catalogStats.totalAvailable}
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.faint, marginTop: '2px' }}>
              Ready for immediate playback
            </div>
          </div>
        </div>
      )}

      {/* Active Voice Spotlight Banner */}
      {(() => {
        const activeProfile = voices.find(v => v.id === settings.selectedVoiceId) || voices[0];
        if (!activeProfile) return null;
        const badge = getProviderBadge(activeProfile.provider);
        const isSpeakingThis = isPlaying && activeVoicePlaying === activeProfile.id;

        return (
          <div
            style={{
              background: tokens.colors.bg.elevated,
              border: `1px solid ${isSpeakingThis ? tokens.colors.accent.primary : tokens.colors.border.strong}`,
              borderRadius: tokens.radii.md,
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span
                  style={{
                    fontSize: tokens.typography.sizes.xs,
                    fontWeight: 600,
                    color: tokens.colors.accent.primary,
                    letterSpacing: tokens.typography.letterSpacing.wide,
                    fontFamily: tokens.typography.fontMono
                  }}
                >
                  ACTIVE SYSTEM VOICE
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: tokens.radii.xs,
                    background: tokens.colors.bg.surface,
                    border: `1px solid ${tokens.colors.border.default}`,
                    color: badge.color,
                    fontWeight: 600
                  }}
                >
                  {badge.label}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: tokens.radii.xs,
                    background: tokens.colors.bg.surface,
                    color: tokens.colors.text.secondary,
                    fontFamily: tokens.typography.fontMono
                  }}
                >
                  {activeProfile.language} • {activeProfile.gender}
                </span>
                {isSpeakingThis && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: tokens.colors.accent.primary,
                      fontWeight: 600,
                      fontFamily: tokens.typography.fontMono
                    }}
                  >
                    ● PLAYING LIVE
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: tokens.typography.sizes.lg,
                  fontWeight: 600,
                  color: tokens.colors.text.primary,
                  fontFamily: tokens.typography.fontDisplay
                }}
              >
                {activeProfile.name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {(activeProfile.characteristics || ['natural', 'articulate']).map(c => (
                  <span
                    key={c}
                    style={{
                      fontSize: '11px',
                      padding: '2px 7px',
                      borderRadius: tokens.radii.xs,
                      background: tokens.colors.bg.surface,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      color: tokens.colors.text.secondary
                    }}
                  >
                    #{c}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => handlePreview(activeProfile.id)}
                disabled={!activeProfile.available && !activeProfile.isAvailable && activeVoicePlaying !== activeProfile.id}
                style={{
                  background: isSpeakingThis ? tokens.colors.semantic.errorMuted : tokens.colors.bg.surface,
                  border: `1px solid ${isSpeakingThis ? tokens.colors.semantic.error : tokens.colors.border.strong}`,
                  color: isSpeakingThis ? tokens.colors.semantic.error : tokens.colors.text.primary,
                  borderRadius: tokens.radii.sm,
                  padding: '8px 16px',
                  fontSize: tokens.typography.sizes.xs,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: tokens.typography.fontMono
                }}
              >
                {isSpeakingThis ? <Icons.Stop size={12} /> : <Icons.Play size={12} />}
                {isSpeakingThis ? 'STOP AUDIO' : 'TEST VOICE'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Auto-Speak Dispatch Mode */}
      <div
        style={{
          background: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.radii.md,
          padding: '16px',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
            Acoustic Output Dispatch Mode
          </div>
          <span
            style={{
              fontSize: tokens.typography.sizes.xs,
              padding: '2px 8px',
              borderRadius: tokens.radii.xs,
              background: settings.autoSpeak === 'ON' ? tokens.colors.accent.primarySubtle : tokens.colors.bg.elevated,
              border: `1px solid ${settings.autoSpeak === 'ON' ? tokens.colors.border.accentSubtle : tokens.colors.border.subtle}`,
              color: settings.autoSpeak === 'ON' ? tokens.colors.accent.primary : tokens.colors.text.muted,
              fontFamily: tokens.typography.fontMono,
              fontWeight: 600
            }}
          >
            ACTIVE: {settings.autoSpeak}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {autoSpeakModes.map(opt => {
            const isSelected = settings.autoSpeak === opt.mode;
            return (
              <div
                key={opt.mode}
                onClick={() => handleUpdateSettings({ autoSpeak: opt.mode })}
                style={{
                  background: isSelected ? tokens.colors.bg.elevated : tokens.colors.bg.subtle,
                  border: `1px solid ${isSelected ? tokens.colors.accent.primary : tokens.colors.border.subtle}`,
                  borderRadius: tokens.radii.sm,
                  padding: '12px',
                  cursor: 'pointer',
                  transition: tokens.transitions.fast
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ color: isSelected ? tokens.colors.accent.primary : tokens.colors.text.secondary }}>
                    {opt.mode === 'OFF' ? <Icons.VolumeOff size={14} /> : opt.mode === 'ON' ? <Icons.Volume size={14} /> : <Icons.Mic size={14} />}
                  </span>
                  <span
                    style={{
                      fontSize: tokens.typography.sizes.sm,
                      fontWeight: 600,
                      color: isSelected ? tokens.colors.accent.primary : tokens.colors.text.primary
                    }}
                  >
                    {opt.label}
                  </span>
                </div>
                <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, lineHeight: '1.4' }}>
                  {opt.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Procedural Audio Cues & State Sounds */}
      <div
        style={{
          background: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.radii.md,
          padding: '16px',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
            Procedural Acoustic Cues (Web Audio API & 16-bit PCM WAV)
          </div>
          {cueStatus && (
            <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
              {cueStatus}
            </span>
          )}
        </div>
        <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginBottom: '12px' }}>
          Zero external audio assets. Deterministic mathematical waveforms synthesized in real-time.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
          {proceduralCues.map(c => {
            const isPlayingThis = activeCuePlaying === c.cue;
            return (
              <button
                key={c.cue}
                onClick={() => handlePlayCue(c.cue)}
                style={{
                  background: isPlayingThis ? tokens.colors.accent.primarySubtle : tokens.colors.bg.subtle,
                  border: `1px solid ${isPlayingThis ? tokens.colors.accent.primary : tokens.colors.border.subtle}`,
                  borderRadius: tokens.radii.sm,
                  padding: '12px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: tokens.transitions.fast
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: isPlayingThis ? tokens.colors.accent.primary : tokens.colors.text.secondary }}>
                    <Icons.Volume size={13} />
                  </span>
                  <span
                    style={{
                      fontSize: tokens.typography.sizes.xs,
                      fontWeight: 600,
                      color: isPlayingThis ? tokens.colors.accent.primary : tokens.colors.text.primary
                    }}
                  >
                    {c.label}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: tokens.colors.text.muted, lineHeight: '1.3' }}>
                  {c.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Personality Mode Presets */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary, marginBottom: '10px' }}>
          Active Personality Preset
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {personalities.map(p => {
            const isSelected = settings.personalityMode === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleUpdateSettings({ personalityMode: p.id })}
                style={{
                  background: isSelected ? tokens.colors.bg.elevated : tokens.colors.bg.surface,
                  border: `1px solid ${isSelected ? tokens.colors.accent.primary : tokens.colors.border.default}`,
                  borderRadius: tokens.radii.md,
                  padding: '14px',
                  cursor: 'pointer',
                  transition: tokens.transitions.fast
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ color: isSelected ? tokens.colors.accent.primary : tokens.colors.text.secondary }}>
                    <Icons.Personality size={16} />
                  </span>
                  <span
                    style={{
                      fontSize: tokens.typography.sizes.sm,
                      fontWeight: 600,
                      color: isSelected ? tokens.colors.accent.primary : tokens.colors.text.primary
                    }}
                  >
                    {p.title}
                  </span>
                </div>
                <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, lineHeight: '1.4' }}>
                  {p.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Speech Parameters Controls */}
      {(() => {
        const activeProfile = voices.find(v => v.id === settings.selectedVoiceId) || voices[0];
        const supportsPitch = activeProfile
          ? (activeProfile.supportedControls?.includes('pitch') ?? (activeProfile.provider === 'windows-onecore' || activeProfile.provider === 'google-cloud'))
          : true;
        const isElevenLabs = activeProfile?.provider === 'elevenlabs';

        return (
          <div
            style={{
              background: tokens.colors.bg.surface,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.md,
              padding: '16px',
              marginBottom: '20px'
            }}
          >
            <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary, marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Acoustic Synthesis Modulation</span>
              {activeProfile && (
                <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary }}>
                  Target Provider: <strong style={{ color: tokens.colors.accent.primary }}>{getProviderBadge(activeProfile.provider).label}</strong>
                </span>
              )}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px'
              }}
            >
              {/* Speed */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, marginBottom: '6px' }}>
                  <span>Speech Rate</span>
                  <span style={{ fontWeight: 600, color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
                    {settings.speechRate.toFixed(2)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={settings.speechRate}
                  onChange={e => handleUpdateSettings({ speechRate: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: tokens.colors.accent.primary }}
                />
              </div>

              {/* Pitch */}
              <div style={{ opacity: supportsPitch ? 1 : 0.4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, marginBottom: '6px' }}>
                  <span>Pitch</span>
                  {supportsPitch ? (
                    <span style={{ fontWeight: 600, color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
                      {settings.pitch.toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: tokens.radii.xs, background: tokens.colors.bg.elevated, color: tokens.colors.text.muted }}>
                      UNSUPPORTED
                    </span>
                  )}
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  disabled={!supportsPitch}
                  value={settings.pitch}
                  onChange={e => handleUpdateSettings({ pitch: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: tokens.colors.accent.primary, cursor: supportsPitch ? 'pointer' : 'not-allowed' }}
                />
              </div>

              {/* Volume */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, marginBottom: '6px' }}>
                  <span>Output Amplitude</span>
                  <span style={{ fontWeight: 600, color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
                    {Math.round(settings.volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={settings.volume}
                  onChange={e => handleUpdateSettings({ volume: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: tokens.colors.accent.primary }}
                />
              </div>

              {/* ElevenLabs Stability */}
              <div style={{ opacity: isElevenLabs ? 1 : 0.4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, marginBottom: '6px' }}>
                  <span>Stability (ElevenLabs)</span>
                  {isElevenLabs ? (
                    <span style={{ fontWeight: 600, color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
                      {((settings as any).stability ?? 0.5).toFixed(2)}
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: tokens.radii.xs, background: tokens.colors.bg.elevated, color: tokens.colors.text.muted }}>
                      ELEVENLABS ONLY
                    </span>
                  )}
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  disabled={!isElevenLabs}
                  value={(settings as any).stability ?? 0.5}
                  onChange={e => handleUpdateSettings({ stability: parseFloat(e.target.value) } as any)}
                  style={{ width: '100%', accentColor: tokens.colors.accent.primary, cursor: isElevenLabs ? 'pointer' : 'not-allowed' }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Voice Directory & Search Controls */}
      <div
        style={{
          background: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.radii.md,
          padding: '16px',
          marginBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
            Voice Catalog Directory ({filteredVoices.length} of {voices.length})
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={e => setAvailableOnly(e.target.checked)}
              style={{ accentColor: tokens.colors.accent.primary }}
            />
            Show Available Only
          </label>
        </div>

        {/* Characteristics Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginRight: '4px' }}>Filter:</span>
          {['all', 'warm', 'calm', 'deep', 'articulate', 'expressive', 'energetic', 'narrator', 'natural', 'clear', 'confident'].map(char => {
            const isCharActive = char === 'all' ? !characteristicFilter : characteristicFilter === char;
            return (
              <button
                key={char}
                onClick={() => setCharacteristicFilter(char === 'all' ? '' : char === characteristicFilter ? '' : char)}
                style={{
                  background: isCharActive ? tokens.colors.accent.primarySubtle : tokens.colors.bg.subtle,
                  border: `1px solid ${isCharActive ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                  borderRadius: tokens.radii.xs,
                  padding: '3px 8px',
                  color: isCharActive ? tokens.colors.accent.primary : tokens.colors.text.secondary,
                  fontSize: '11px',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {char}
              </button>
            );
          })}
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by voice name, language, tone..."
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '7px 12px',
              color: tokens.colors.text.primary,
              fontSize: tokens.typography.sizes.xs,
              outline: 'none'
            }}
          />
          <select
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              color: tokens.colors.text.secondary,
              borderRadius: tokens.radii.sm,
              padding: '7px 8px',
              fontSize: tokens.typography.sizes.xs
            }}
          >
            <option value="">All Providers ({voices.length})</option>
            <option value="windows-onecore">Windows OneCore (8 Built-in)</option>
            <option value="windows-sapi">Windows SAPI (3 Desktop)</option>
            <option value="google-cloud-tts">Google Cloud (44 Voices)</option>
            <option value="elevenlabs">ElevenLabs (46 Voices)</option>
            <option value="openai">OpenAI Speech (6 Voices)</option>
          </select>
          <select
            value={languageFilter}
            onChange={e => setLanguageFilter(e.target.value)}
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              color: tokens.colors.text.secondary,
              borderRadius: tokens.radii.sm,
              padding: '7px 8px',
              fontSize: tokens.typography.sizes.xs
            }}
          >
            <option value="">All Languages</option>
            <option value="en">English (US/UK/IN)</option>
            <option value="hi">Hindi (India)</option>
            <option value="bn">Bengali (India)</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="ja">Japanese</option>
          </select>
          <select
            value={naturalnessFilter}
            onChange={e => setNaturalnessFilter(e.target.value)}
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              color: tokens.colors.text.secondary,
              borderRadius: tokens.radii.sm,
              padding: '7px 8px',
              fontSize: tokens.typography.sizes.xs
            }}
          >
            <option value="">All Naturalness</option>
            <option value="generative">Generative</option>
            <option value="studio">Studio</option>
            <option value="neural">Neural</option>
            <option value="standard">Standard</option>
          </select>
        </div>

        {/* Custom Test Phrase Input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={previewText}
            onChange={e => setPreviewText(e.target.value)}
            placeholder="Custom test phrase for synthesis..."
            style={{
              flex: 1,
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '7px 12px',
              color: tokens.colors.text.primary,
              fontSize: tokens.typography.sizes.xs,
              outline: 'none'
            }}
          />
          {isPlaying && (
            <button
              onClick={handleStopPlayback}
              style={{
                background: tokens.colors.semantic.errorMuted,
                border: `1px solid ${tokens.colors.semantic.error}`,
                color: tokens.colors.semantic.error,
                borderRadius: tokens.radii.sm,
                padding: '7px 14px',
                fontSize: tokens.typography.sizes.xs,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: tokens.typography.fontMono
              }}
            >
              STOP AUDIO
            </button>
          )}
        </div>
      </div>

      {previewStatus && (
        <div
          style={{
            background: isPlaying ? tokens.colors.accent.primarySubtle : tokens.colors.bg.surface,
            border: `1px solid ${isPlaying ? tokens.colors.accent.primary : tokens.colors.border.default}`,
            color: isPlaying ? tokens.colors.accent.primary : tokens.colors.text.secondary,
            borderRadius: tokens.radii.sm,
            padding: '8px 14px',
            fontSize: tokens.typography.sizes.xs,
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: tokens.typography.fontMono
          }}
        >
          {isPlaying && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: tokens.colors.accent.primary }} />}
          <span>{previewStatus}</span>
        </div>
      )}

      {/* Voices Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '10px',
          marginBottom: '24px'
        }}
      >
        {filteredVoices.map(v => {
          const isSelected = settings.selectedVoiceId === v.id;
          const isThisVoicePlaying = isPlaying && activeVoicePlaying === v.id;
          const badge = getProviderBadge(v.provider);
          const isAvail = v.available ?? v.isAvailable ?? false;

          return (
            <div
              key={v.id}
              style={{
                background: isSelected ? tokens.colors.bg.elevated : tokens.colors.bg.surface,
                border: `1px solid ${isThisVoicePlaying ? tokens.colors.accent.primary : isSelected ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                borderRadius: tokens.radii.sm,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{v.name}</span>
                    {isThisVoicePlaying && (
                      <span style={{ fontSize: '10px', color: tokens.colors.accent.primary, fontWeight: 600, fontFamily: tokens.typography.fontMono }}>
                        ● SPEAKING
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: tokens.radii.xs,
                      background: tokens.colors.bg.subtle,
                      border: `1px solid ${tokens.colors.border.subtle}`,
                      color: badge.color,
                      fontFamily: tokens.typography.fontMono
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, lineHeight: '1.4' }}>
                  {v.language} {v.accent ? `(${v.accent})` : ''} • {v.gender} • {v.naturalness || 'standard'}
                </div>
                {v.description && (
                  <div style={{ fontSize: '11px', color: tokens.colors.text.faint, marginTop: '2px', fontStyle: 'italic' }}>
                    {v.description}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {(v.characteristics || []).slice(0, 4).map(c => (
                    <span
                      key={c}
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: tokens.radii.xs,
                        background: tokens.colors.bg.subtle,
                        border: `1px solid ${tokens.colors.border.subtle}`,
                        color: tokens.colors.text.muted
                      }}
                    >
                      #{c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status & Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: `1px solid ${tokens.colors.border.subtle}` }}>
                <div>
                  {isAvail ? (
                    <span style={{ fontSize: '11px', color: tokens.colors.semantic.success, fontWeight: 500 }}>
                      ✓ {v.provider.startsWith('windows') ? 'Offline Ready' : 'Available'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: tokens.colors.semantic.warning, fontWeight: 500 }} title={v.availabilityReason || 'Requires API key'}>
                      Requires Key
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handlePreview(v.id)}
                    disabled={!isAvail && !isThisVoicePlaying}
                    style={{
                      background: isThisVoicePlaying ? tokens.colors.semantic.errorMuted : tokens.colors.bg.subtle,
                      border: `1px solid ${isThisVoicePlaying ? tokens.colors.semantic.error : tokens.colors.border.default}`,
                      color: isThisVoicePlaying ? tokens.colors.semantic.error : isAvail ? tokens.colors.accent.primary : tokens.colors.text.muted,
                      borderRadius: tokens.radii.xs,
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      cursor: isAvail || isThisVoicePlaying ? 'pointer' : 'not-allowed',
                      fontFamily: tokens.typography.fontMono
                    }}
                  >
                    {isThisVoicePlaying ? '■ STOP' : '▶ TEST'}
                  </button>
                  <button
                    onClick={() => handleUpdateSettings({ selectedVoiceId: v.id, selectedProvider: v.provider as any })}
                    style={{
                      background: isSelected ? tokens.colors.accent.primary : tokens.colors.bg.subtle,
                      border: `1px solid ${isSelected ? tokens.colors.accent.primary : tokens.colors.border.default}`,
                      color: isSelected ? tokens.colors.bg.canvas : tokens.colors.text.secondary,
                      borderRadius: tokens.radii.xs,
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: tokens.typography.fontMono
                    }}
                  >
                    {isSelected ? 'ACTIVE' : 'SELECT'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Windows Native Acoustic Input & Microphone Telemetry */}
      <div
        style={{
          marginTop: '12px',
          padding: '16px',
          borderRadius: tokens.radii.md,
          background: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.default}`
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
                Windows Native Audio Input
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: tokens.radii.xs,
                  backgroundColor: micState === 'MIC_LISTENING' ? tokens.colors.accent.primarySubtle : tokens.colors.bg.elevated,
                  color: micState === 'MIC_LISTENING' ? tokens.colors.accent.primary : tokens.colors.text.muted,
                  border: `1px solid ${micState === 'MIC_LISTENING' ? tokens.colors.border.accentSubtle : tokens.colors.border.subtle}`,
                  fontFamily: tokens.typography.fontMono
                }}
              >
                {micState}
              </span>
            </div>
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginTop: '3px' }}>
              Real-time 16 kHz 16-bit mono PCM capture via WASAPI / winmm waveIn. Ephemeral RAM ring buffer.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={loadMicData}
              style={{
                background: tokens.colors.bg.subtle,
                border: `1px solid ${tokens.colors.border.default}`,
                color: tokens.colors.text.secondary,
                borderRadius: tokens.radii.xs,
                padding: '6px 12px',
                fontSize: tokens.typography.sizes.xs,
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
            <button
              onClick={handleToggleMic}
              disabled={isMicLoading}
              style={{
                background: micState === 'MIC_LISTENING' ? tokens.colors.semantic.errorMuted : tokens.colors.bg.elevated,
                border: `1px solid ${micState === 'MIC_LISTENING' ? tokens.colors.semantic.error : tokens.colors.border.strong}`,
                color: micState === 'MIC_LISTENING' ? tokens.colors.semantic.error : tokens.colors.text.primary,
                borderRadius: tokens.radii.xs,
                padding: '6px 14px',
                fontSize: tokens.typography.sizes.xs,
                fontWeight: 600,
                cursor: isMicLoading ? 'not-allowed' : 'pointer',
                fontFamily: tokens.typography.fontMono
              }}
            >
              {isMicLoading ? 'UPDATING...' : micState === 'MIC_LISTENING' ? '■ STOP CAPTURE' : '● START CAPTURE'}
            </button>
          </div>
        </div>

        {/* Acoustic Waveform & Level Meter */}
        <div
          style={{
            marginBottom: '14px',
            padding: '12px',
            borderRadius: tokens.radii.sm,
            background: tokens.colors.bg.subtle,
            border: `1px solid ${tokens.colors.border.subtle}`
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, marginBottom: '8px' }}>
            <span>Acoustic Signal Level (RMS Normalizer)</span>
            <span style={{ fontFamily: tokens.typography.fontMono }}>
              {Math.round(micLevel * 100)}% ({micDiagnostics?.currentRms ?? 0} RMS / {micDiagnostics?.peakLevel ?? 0} Peak)
            </span>
          </div>

          {/* Level Progress Bar */}
          <div
            style={{
              height: '4px',
              width: '100%',
              background: tokens.colors.bg.elevated,
              borderRadius: '2px',
              overflow: 'hidden',
              marginBottom: '10px'
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.round(micLevel * 100))}%`,
                background: micLevel > 0.75 ? tokens.colors.semantic.warning : tokens.colors.accent.primary,
                transition: 'width 0.08s ease-out'
              }}
            />
          </div>

          {/* Live Waveform Bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3px', height: '20px' }}>
            {[0.4, 0.7, 1.0, 0.85, 1.2, 0.95, 0.6, 1.1, 0.75, 0.5].map((factor, idx) => {
              const h = micState === 'MIC_LISTENING'
                ? Math.max(3, Math.min(20, Math.round((micLevel || 0.08) * factor * 20)))
                : 3;
              return (
                <div
                  key={idx}
                  style={{
                    width: '3px',
                    height: `${h}px`,
                    backgroundColor: micState === 'MIC_LISTENING' ? tokens.colors.accent.primary : tokens.colors.border.default,
                    borderRadius: '1px',
                    transition: 'height 0.08s ease-out'
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Device & Hardware Telemetry Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '10px'
          }}
        >
          <div style={{ padding: '8px 12px', borderRadius: tokens.radii.xs, background: tokens.colors.bg.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
            <div style={{ fontSize: '10px', color: tokens.colors.text.muted }}>Detected Device</div>
            <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 500, color: tokens.colors.text.primary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inputDevices[0]?.name || micDiagnostics?.activeDevice || 'Default Input Device'}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: tokens.radii.xs, background: tokens.colors.bg.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
            <div style={{ fontSize: '10px', color: tokens.colors.text.muted }}>Format & Rate</div>
            <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 500, color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
              16 kHz Mono (PCM16)
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: tokens.radii.xs, background: tokens.colors.bg.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
            <div style={{ fontSize: '10px', color: tokens.colors.text.muted }}>Frames Received</div>
            <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 500, color: tokens.colors.text.primary, fontFamily: tokens.typography.fontMono }}>
              {micDiagnostics?.frameCount ?? 0} ({((micDiagnostics?.totalBytes ?? 0) / 1024).toFixed(1)} KB)
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: tokens.radii.xs, background: tokens.colors.bg.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
            <div style={{ fontSize: '10px', color: tokens.colors.text.muted }}>Stream Duration</div>
            <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 500, color: tokens.colors.semantic.success, fontFamily: tokens.typography.fontMono }}>
              {((micDiagnostics?.streamDurationMs ?? 0) / 1000).toFixed(1)}s
            </div>
          </div>
        </div>
      </div>

      {/* Developer Diagnostics View (Part 5: Production Voice Pipeline Audit & Telemetry) */}
      <div
        style={{
          marginTop: '24px',
          padding: '20px',
          borderRadius: tokens.radii.lg,
          background: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.subtle}`,
          boxShadow: tokens.shadows.subtle
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px' }}>🛠️</span>
            <div>
              <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary, letterSpacing: '0.02em' }}>
                Developer Voice Diagnostics & Pipeline Trace
              </div>
              <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted }}>
                Live audit trail of mic capture, VAD thresholds, online STT, and explicit TTS provider resolution
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: tokens.radii.pill,
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: tokens.typography.fontMono,
                background: (diagnostics?.ttsFallbackTriggered || ttsFallbackEvent) ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                color: (diagnostics?.ttsFallbackTriggered || ttsFallbackEvent) ? tokens.colors.semantic.warning : tokens.colors.semantic.success,
                border: `1px solid ${(diagnostics?.ttsFallbackTriggered || ttsFallbackEvent) ? tokens.colors.semantic.warning : tokens.colors.semantic.success}`
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: (diagnostics?.ttsFallbackTriggered || ttsFallbackEvent) ? tokens.colors.semantic.warning : tokens.colors.semantic.success
                }}
              />
              {(diagnostics?.ttsFallbackTriggered || ttsFallbackEvent) ? 'FALLBACK TRIGGERED' : 'CLEAN DIRECT PATH'}
            </span>
            <button
              onClick={() => {
                fetch('/api/v1/voice/diagnostics/last')
                  .then(r => r.json())
                  .then(d => { if (d) setDiagnostics(d); })
                  .catch(() => {});
              }}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                borderRadius: tokens.radii.xs,
                background: tokens.colors.bg.elevated,
                border: `1px solid ${tokens.colors.border.subtle}`,
                color: tokens.colors.text.secondary,
                cursor: 'pointer'
              }}
            >
              Refresh Trace
            </button>
          </div>
        </div>

        {/* Fallback Warning Banner */}
        {(diagnostics?.ttsFallbackTriggered || ttsFallbackEvent) && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: tokens.radii.sm,
              background: 'rgba(234, 179, 8, 0.1)',
              border: '1px solid rgba(234, 179, 8, 0.3)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.primary }}>
              <strong>Silent Fallback Prevented:</strong> Requested voice{' '}
              <code style={{ color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
                {ttsFallbackEvent?.originalVoiceId || diagnostics?.ttsVoiceRequested || settings.selectedVoiceId}
              </code>{' '}
              failed and fell back to{' '}
              <code style={{ color: tokens.colors.semantic.warning, fontFamily: tokens.typography.fontMono }}>
                {ttsFallbackEvent?.fallbackVoiceId || diagnostics?.ttsVoiceResolved || 'windows-onecore'}
              </code>.
              {Boolean(ttsFallbackEvent?.reason || diagnostics?.ttsFallbackReason) && (
                <div style={{ color: tokens.colors.text.muted, marginTop: '2px', fontFamily: tokens.typography.fontMono, fontSize: '11px' }}>
                  Reason: {ttsFallbackEvent?.reason || diagnostics?.ttsFallbackReason}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Failure Point Banner */}
        {diagnostics?.failurePoint && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: tokens.radii.sm,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <span style={{ fontSize: '16px' }}>🛑</span>
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.semantic.error }}>
              <strong>Voice Turn Aborted:</strong> {diagnostics.failurePoint}
            </div>
          </div>
        )}

        {/* Diagnostics Metrics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px'
          }}
        >
          {/* Card 1: Mic & VAD State */}
          <div style={{ padding: '12px', borderRadius: tokens.radii.sm, background: tokens.colors.bg.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
            <div style={{ fontSize: '11px', color: tokens.colors.text.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Mic & VAD State
            </div>
            <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
              {micState} <span style={{ color: tokens.colors.text.muted, fontWeight: 400 }}>({diagnostics?.vadState || 'IDLE'})</span>
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.secondary, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
              Avg RMS: {diagnostics?.averageRms ?? 0} | Peak: {diagnostics?.maxRms ?? 0}
            </div>
          </div>

          {/* Card 2: Active STT Provider */}
          <div style={{ padding: '12px', borderRadius: tokens.radii.sm, background: tokens.colors.bg.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
            <div style={{ fontSize: '11px', color: tokens.colors.text.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Active STT Provider
            </div>
            <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
              {diagnostics?.sttProvider || 'Online STT'}
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.secondary, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
              Status: {diagnostics?.sttConnectionState || 'IDLE'} ({diagnostics?.sttFramesSent ?? 0} frames)
            </div>
          </div>

          {/* Card 3: TTS Router & Voice Resolution */}
          <div style={{ padding: '12px', borderRadius: tokens.radii.sm, background: tokens.colors.bg.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
            <div style={{ fontSize: '11px', color: tokens.colors.text.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              TTS Router Resolution
            </div>
            <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
              {diagnostics?.ttsProviderResolved || settings.selectedProvider || 'auto'}
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.secondary, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
              Voice: {diagnostics?.ttsVoiceResolved || settings.selectedVoiceId}
            </div>
          </div>

          {/* Card 4: Last Final Transcript */}
          <div style={{ gridColumn: 'span 2', padding: '12px', borderRadius: tokens.radii.sm, background: tokens.colors.bg.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
            <div style={{ fontSize: '11px', color: tokens.colors.text.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Last Recognized Voice Command
            </div>
            <div style={{ fontSize: tokens.typography.sizes.sm, color: diagnostics?.sttFinalTranscript ? tokens.colors.text.primary : tokens.colors.text.muted, fontStyle: diagnostics?.sttFinalTranscript ? 'normal' : 'italic' }}>
              {diagnostics?.sttFinalTranscript ? `"${diagnostics.sttFinalTranscript}"` : 'No spoken command transcribed in current session'}
            </div>
          </div>

          {/* Card 5: Acoustic Latency */}
          <div style={{ padding: '12px', borderRadius: tokens.radii.sm, background: tokens.colors.bg.subtle, border: `1px solid ${tokens.colors.border.subtle}` }}>
            <div style={{ fontSize: '11px', color: tokens.colors.text.muted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Playback & Latency
            </div>
            <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary, fontFamily: tokens.typography.fontMono }}>
              {diagnostics?.audioOutputLatencyMs ? `${diagnostics.audioOutputLatencyMs} ms` : 'Ready'}
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.secondary, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
              Model: {diagnostics?.modelLatencyMs ? `${diagnostics.modelLatencyMs} ms` : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
