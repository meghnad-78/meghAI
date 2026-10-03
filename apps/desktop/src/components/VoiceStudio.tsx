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
    const next = { ...settings, ...updates };
    setSettings(next);
    try {
      await fetch('/api/v1/voice/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
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
    setPreviewStatus(`Synthesizing and playing speech through Windows default audio device...`);
    try {
      const res = await fetch('/api/v1/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, text: previewText, play: true })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setPreviewStatus(`✓ Audio spoken successfully (${data.speechRate}x rate, ${data.durationMs ? `${data.durationMs}ms` : 'completed'})`);
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
    setCueStatus(`Synthesizing & playing "${cue}" audio cue...`);
    try {
      const res = await fetch('/api/v1/voice/cue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cue })
      });
      const data = await res.json() as any;
      if (res.ok) {
        setCueStatus(`✓ Played procedural "${cue}" cue (${data.format || '16kHz PCM WAV'})`);
      } else {
        setCueStatus(`Audio cue error: ${data.error || 'Failed'}`);
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

  const personalities: Array<{ id: PersonalityMode; title: string; desc: string; icon: string }> = [
    { id: 'FUTURISTIC_COMPANION', title: 'Futuristic Companion', desc: 'Omnipresent, razor-sharp intelligence partner.', icon: '⚡' },
    { id: 'PROFESSIONAL', title: 'Executive Professional', desc: 'Direct, clear, and action-oriented precision.', icon: '💼' },
    { id: 'WARM', title: 'Warm & Empathetic', desc: 'Friendly, courteous, accessible, and supportive.', icon: '☀️' },
    { id: 'CALM_ASSISTANT', title: 'Calm & Deliberate', desc: 'Peaceful, minimalist, and unhurried focus.', icon: '🌿' }
  ];

  const autoSpeakModes: Array<{ mode: AutoSpeakMode; label: string; desc: string; icon: string }> = [
    { mode: 'OFF', label: 'Off', desc: 'Text-only responses. Audio is silent.', icon: '🔇' },
    { mode: 'ON', label: 'Always Speak', desc: 'MeghAI automatically speaks all responses through Windows audio.', icon: '🔊' },
    { mode: 'ASK', label: 'Ask / Manual', desc: 'Audio played on-demand or push-to-talk.', icon: '🎙️' }
  ];

  const proceduralCues: Array<{
    cue: AudioCueType;
    label: string;
    icon: string;
    desc: string;
    color: string;
  }> = [
    { cue: 'startup', label: 'Startup Chime', icon: '🚀', desc: 'Ascending triad + shimmer on boot', color: '#00f0ff' },
    { cue: 'listening', label: 'Listening Ping', icon: '🎙️', desc: 'Dual-frequency detection ping', color: '#ef4444' },
    { cue: 'thinking', label: 'Thinking Tone', icon: '🧠', desc: 'Pulsing low harmonic thinking cycle', color: '#f59e0b' },
    { cue: 'answer_ready', label: 'Answer Ready', icon: '✨', desc: 'Gentle rising chime before speech', color: '#10b981' },
    { cue: 'interrupt', label: 'Interrupt Cue', icon: '🛑', desc: 'Rapid falling brake chirp', color: '#ec4899' }
  ];

  const getProviderBadge = (provider: string) => {
    switch (provider) {
      case 'windows-onecore':
        return { label: 'Windows OneCore', bg: 'rgba(0, 240, 255, 0.15)', border: '#00f0ff', color: '#38bdf8' };
      case 'windows-sapi':
      case 'local':
        return { label: 'Windows SAPI', bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8', color: '#cbd5e1' };
      case 'google-cloud':
      case 'google-cloud-tts':
      case 'google':
        return { label: 'Google Cloud', bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', color: '#d8b4fe' };
      case 'elevenlabs':
        return { label: 'ElevenLabs', bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', color: '#6ee7b7' };
      case 'openai':
        return { label: 'OpenAI Speech', bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', color: '#fde047' };
      default:
        return { label: provider, bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.1)', color: '#94a3b8' };
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      {/* Header & Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Voice & Personality Studio</h2>
            {catalogStats && (
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(0, 240, 255, 0.15)',
                border: '1px solid rgba(0, 240, 255, 0.4)',
                color: '#00f0ff'
              }}>
                {catalogStats.totalVoices} Voices Across 4 Providers
              </span>
            )}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Multi-provider voice synthesis, procedural acoustic cues, auto-speak configuration, and native microphone telemetry.
          </p>
        </div>
        {(isPlaying || activeCuePlaying) && (
          <button
            onClick={handleStopPlayback}
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>■</span> Stop Audio Output
          </button>
        )}
      </div>

      {/* Catalog Telemetry Bar */}
      {catalogStats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Catalog Voices</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
              {catalogStats.totalVoices} Across 5 Providers
            </div>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#38bdf8' }}>Offline Ready (Windows SAPI + OneCore)</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#00f0ff', marginTop: '2px' }}>
              {catalogStats.totalOfflineReady} Voices (100% Local)
            </div>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#c084fc' }}>Cloud AI (Google + ElevenLabs + OpenAI)</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#d8b4fe', marginTop: '2px' }}>
              {catalogStats.totalCloud} Voices
            </div>
          </div>
          <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '11px', color: '#6ee7b7' }}>Available Right Now</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#10b981', marginTop: '2px' }}>
              {catalogStats.totalAvailable} Active
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
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(138, 43, 226, 0.08) 100%)',
            border: `1px solid ${isSpeakingThis ? '#c084fc' : 'rgba(0, 240, 255, 0.3)'}`,
            borderRadius: '12px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(0, 240, 255, 0.05)'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f0ff', letterSpacing: '0.05em' }}>
                  ACTIVE SYSTEM VOICE
                </span>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: badge.bg,
                  border: `1px solid ${badge.border}`,
                  color: badge.color,
                  fontWeight: 700
                }}>
                  {badge.label}
                </span>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.06)', color: '#cbd5e1' }}>
                  {activeProfile.language} • {activeProfile.gender}
                </span>
                {isSpeakingThis && (
                  <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 700 }}>
                    ● LIVE PLAYING THROUGH AUDIO DEVICE
                  </span>
                )}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                {activeProfile.name}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                {(activeProfile.characteristics || ['natural', 'articulate']).map(c => (
                  <span key={c} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '12px', background: 'rgba(0, 240, 255, 0.12)', border: '1px solid rgba(0, 240, 255, 0.25)', color: '#38bdf8' }}>
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
                  background: isSpeakingThis ? 'rgba(239, 68, 68, 0.25)' : '#00f0ff',
                  border: isSpeakingThis ? '1px solid #ef4444' : 'none',
                  color: isSpeakingThis ? '#ef4444' : '#07090e',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {isSpeakingThis ? '■ Stop Audio' : '▶ Test Voice Audio'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Auto-Speak Behavior Selector */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Auto-Speak Responses (Windows Audio Output)</span>
          <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: settings.autoSpeak === 'ON' ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)', color: settings.autoSpeak === 'ON' ? '#00f0ff' : '#94a3b8', fontWeight: 700 }}>
            CURRENT: {settings.autoSpeak}
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
                  background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                  border: `1px solid ${isSelected ? '#00f0ff' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>{opt.icon}</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#00f0ff' : '#f8fafc' }}>{opt.label}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.3' }}>{opt.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Procedural Audio Cues & State Sounds */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
            Procedural Audio State Cues (100% Offline 16-bit PCM WAV)
          </div>
          {cueStatus && (
            <span style={{ fontSize: '11px', color: '#00f0ff', fontWeight: 600 }}>
              {cueStatus}
            </span>
          )}
        </div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>
          Pure mathematical waveform cues synthesized locally without pre-recorded assets or internet dependencies.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
          {proceduralCues.map(c => {
            const isPlayingThis = activeCuePlaying === c.cue;
            return (
              <button
                key={c.cue}
                onClick={() => handlePlayCue(c.cue)}
                style={{
                  background: isPlayingThis ? `${c.color}25` : 'rgba(15, 23, 42, 0.5)',
                  border: `1px solid ${isPlayingThis ? c.color : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '10px',
                  padding: '12px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '16px' }}>{c.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: isPlayingThis ? c.color : '#f8fafc' }}>
                    {c.label}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', lineHeight: '1.3' }}>
                  {c.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Personality Mode Selector */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>
          Active Personality Preset
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {personalities.map(p => {
            const isSelected = settings.personalityMode === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleUpdateSettings({ personalityMode: p.id })}
                style={{
                  background: isSelected ? 'rgba(0, 240, 255, 0.12)' : 'rgba(15, 23, 42, 0.65)',
                  border: `1px solid ${isSelected ? '#00f0ff' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '20px', marginBottom: '6px' }}>{p.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: isSelected ? '#00f0ff' : '#f8fafc' }}>{p.title}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', lineHeight: '1.4' }}>{p.desc}</div>
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
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Voice Synthesis Parameters (Controls adapt dynamically per provider)</span>
              {activeProfile && (
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Target Provider: <strong style={{ color: '#00f0ff' }}>{getProviderBadge(activeProfile.provider).label}</strong>
                </span>
              )}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px'
            }}>
              {/* Speed - Supported on all */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
                  <span>Speech Speed</span>
                  <span style={{ fontWeight: 600, color: '#00f0ff' }}>{settings.speechRate.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={settings.speechRate}
                  onChange={e => handleUpdateSettings({ speechRate: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: '#00f0ff' }}
                />
              </div>

              {/* Pitch - Provider specific */}
              <div style={{ opacity: supportsPitch ? 1 : 0.45 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
                  <span>Pitch</span>
                  {supportsPitch ? (
                    <span style={{ fontWeight: 600, color: '#8a2be2' }}>{settings.pitch.toFixed(2)}</span>
                  ) : (
                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', fontWeight: 700 }}>
                      NOT SUPPORTED
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
                  style={{ width: '100%', accentColor: '#8a2be2', cursor: supportsPitch ? 'pointer' : 'not-allowed' }}
                />
              </div>

              {/* Output Volume */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
                  <span>Output Volume</span>
                  <span style={{ fontWeight: 600, color: '#10b981' }}>{Math.round(settings.volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={settings.volume}
                  onChange={e => handleUpdateSettings({ volume: parseFloat(e.target.value) })}
                  style={{ width: '100%', accentColor: '#10b981' }}
                />
              </div>

              {/* ElevenLabs Stability */}
              <div style={{ opacity: isElevenLabs ? 1 : 0.45 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
                  <span>Stability (ElevenLabs)</span>
                  {isElevenLabs ? (
                    <span style={{ fontWeight: 600, color: '#10b981' }}>{((settings as any).stability ?? 0.5).toFixed(2)}</span>
                  ) : (
                    <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)', color: '#94a3b8' }}>
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
                  style={{ width: '100%', accentColor: '#10b981', cursor: isElevenLabs ? 'pointer' : 'not-allowed' }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {/* Voice Directory & Search */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '14px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
            Voice Directory ({filteredVoices.length} shown of {voices.length})
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={e => setAvailableOnly(e.target.checked)}
              style={{ accentColor: '#00f0ff' }}
            />
            Show Available Only
          </label>
        </div>

        {/* Characteristics Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', marginRight: '4px' }}>Characteristics:</span>
          {['all', 'warm', 'calm', 'deep', 'articulate', 'expressive', 'energetic', 'narrator', 'natural', 'clear', 'confident'].map(char => {
            const isCharActive = char === 'all' ? !characteristicFilter : characteristicFilter === char;
            return (
              <button
                key={char}
                onClick={() => setCharacteristicFilter(char === 'all' ? '' : char === characteristicFilter ? '' : char)}
                style={{
                  background: isCharActive ? 'rgba(0, 240, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: `1px solid ${isCharActive ? '#00f0ff' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: '12px',
                  padding: '2px 8px',
                  color: isCharActive ? '#00f0ff' : '#cbd5e1',
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

        {/* Filter Bar */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by voice name, language, tone, or style..."
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: '#f8fafc',
              fontSize: '12px'
            }}
          />
          <select
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
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
            style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
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
            style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '6px 8px', fontSize: '12px' }}
          >
            <option value="">All Naturalness</option>
            <option value="generative">Generative</option>
            <option value="studio">Studio</option>
            <option value="neural">Neural</option>
            <option value="standard">Standard</option>
          </select>
        </div>

        {/* Custom Test Phrase Input */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            value={previewText}
            onChange={e => setPreviewText(e.target.value)}
            placeholder="Test phrase to synthesize..."
            style={{
              flex: 1,
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 12px',
              color: '#f8fafc',
              fontSize: '12px'
            }}
          />
          {isPlaying && (
            <button
              onClick={handleStopPlayback}
              style={{
                background: '#ef4444',
                border: 'none',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Stop Audio
            </button>
          )}
        </div>
      </div>

      {previewStatus && (
        <div style={{
          background: isPlaying ? 'rgba(138, 43, 226, 0.15)' : 'rgba(0, 240, 255, 0.1)',
          border: `1px solid ${isPlaying ? '#8a2be2' : '#00f0ff'}`,
          color: isPlaying ? '#c084fc' : '#00f0ff',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '12px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {isPlaying && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc' }} />}
          <span>{previewStatus}</span>
        </div>
      )}

      {/* Voices Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {filteredVoices.map(v => {
          const isSelected = settings.selectedVoiceId === v.id;
          const isThisVoicePlaying = isPlaying && activeVoicePlaying === v.id;
          const badge = getProviderBadge(v.provider);
          const isAvail = v.available ?? v.isAvailable ?? false;

          return (
            <div
              key={v.id}
              style={{
                background: isSelected ? 'rgba(0, 240, 255, 0.08)' : 'rgba(15, 23, 42, 0.55)',
                border: `1px solid ${isThisVoicePlaying ? '#8a2be2' : isSelected ? '#00f0ff' : 'rgba(255, 255, 255, 0.06)'}`,
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{v.name}</span>
                    {isThisVoicePlaying && (
                      <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 700 }}>● SPEAKING</span>
                    )}
                  </div>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: badge.bg,
                    border: `1px solid ${badge.border}`,
                    color: badge.color
                  }}>
                    {badge.label}
                  </span>
                </div>

                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: '1.4' }}>
                  {v.language} {v.accent ? `(${v.accent})` : ''} • {v.gender} • {v.naturalness || 'standard'}
                </div>
                {v.description && (
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px', fontStyle: 'italic' }}>
                    {v.description}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                  {(v.characteristics || []).slice(0, 4).map(c => (
                    <span key={c} style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#94a3b8'
                    }}>
                      #{c}
                    </span>
                  ))}
                </div>
              </div>

              {/* Status & Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
                {/* Availability status */}
                <div>
                  {isAvail ? (
                    <span style={{ fontSize: '10px', color: '#10b981', fontWeight: 600 }}>
                      ✓ {v.provider.startsWith('windows') ? 'Offline Ready' : 'Available'}
                    </span>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#eab308', fontWeight: 500 }} title={v.availabilityReason || 'Requires API key'}>
                      🔒 Needs Key
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handlePreview(v.id)}
                    disabled={!isAvail && !isThisVoicePlaying}
                    style={{
                      background: isThisVoicePlaying ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      border: `1px solid ${isThisVoicePlaying ? '#ef4444' : 'rgba(255, 255, 255, 0.12)'}`,
                      color: isThisVoicePlaying ? '#ef4444' : isAvail ? '#38bdf8' : '#64748b',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: isThisVoicePlaying ? 700 : 500,
                      cursor: isAvail || isThisVoicePlaying ? 'pointer' : 'not-allowed'
                    }}
                    title={isThisVoicePlaying ? 'Stop playback' : isAvail ? 'Test Audio Output on Speakers' : (v.availabilityReason || 'Requires API key')}
                  >
                    {isThisVoicePlaying ? '■ Stop' : '▶ Test'}
                  </button>
                  <button
                    onClick={() => handleUpdateSettings({ selectedVoiceId: v.id, selectedProvider: v.provider as any })}
                    style={{
                      background: isSelected ? '#00f0ff' : 'rgba(255, 255, 255, 0.05)',
                      border: 'none',
                      color: isSelected ? '#07090e' : '#cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {isSelected ? 'Active' : 'Select'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Windows Native Acoustic Input & Microphone Telemetry */}
      <div style={{
        marginTop: '12px',
        padding: '16px',
        borderRadius: '12px',
        background: 'rgba(15, 23, 42, 0.4)',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                Windows Native Audio Input
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: micState === 'MIC_LISTENING' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: micState === 'MIC_LISTENING' ? '#ef4444' : '#94a3b8',
                border: `1px solid ${micState === 'MIC_LISTENING' ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`
              }}>
                {micState}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
              Real-time 16 kHz 16-bit mono PCM capture via WASAPI / winmm waveIn. 100% local ephemeral memory frames.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={loadMicData}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              ↻ Refresh
            </button>
            <button
              onClick={handleToggleMic}
              disabled={isMicLoading}
              style={{
                background: micState === 'MIC_LISTENING' ? 'rgba(239, 68, 68, 0.25)' : 'linear-gradient(135deg, #00f0ff, #8a2be2)',
                border: micState === 'MIC_LISTENING' ? '1px solid #ef4444' : 'none',
                color: micState === 'MIC_LISTENING' ? '#fca5a5' : '#07090e',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: isMicLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {isMicLoading ? 'Updating...' : micState === 'MIC_LISTENING' ? '■ Stop Capture' : '● Start Capture'}
            </button>
          </div>
        </div>

        {/* Acoustic Waveform & Level Meter */}
        <div style={{
          marginBottom: '14px',
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(7, 9, 14, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1', marginBottom: '8px' }}>
            <span>Acoustic Signal Level (RMS Normalizer)</span>
            <span>{Math.round(micLevel * 100)}% ({micDiagnostics?.currentRms ?? 0} RMS / {micDiagnostics?.peakLevel ?? 0} Peak)</span>
          </div>
          {/* Level Progress Bar */}
          <div style={{
            height: '8px',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '10px'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.round(micLevel * 100))}%`,
              background: micLevel > 0.75 ? '#ef4444' : micLevel > 0.35 ? '#10b981' : '#00f0ff',
              transition: 'width 0.08s ease-out'
            }} />
          </div>
          {/* Live Waveform Bars */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '3px', height: '24px' }}>
            {[0.4, 0.7, 1.0, 0.85, 1.2, 0.95, 0.6, 1.1, 0.75, 0.5].map((factor, idx) => {
              const h = micState === 'MIC_LISTENING'
                ? Math.max(3, Math.min(24, Math.round((micLevel || 0.08) * factor * 24)))
                : 3;
              return (
                <div
                  key={idx}
                  style={{
                    width: '4px',
                    height: `${h}px`,
                    backgroundColor: micState === 'MIC_LISTENING' ? '#00f0ff' : 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '2px',
                    transition: 'height 0.08s ease-out'
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Device & Hardware Telemetry Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px'
        }}>
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Detected Device</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {inputDevices[0]?.name || micDiagnostics?.activeDevice || 'Default Input Device'}
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Format & Rate</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
              16 kHz Mono (PCM16)
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Frames Received</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>
              {micDiagnostics?.frameCount ?? 0} frames ({((micDiagnostics?.totalBytes ?? 0) / 1024).toFixed(1)} KB)
            </div>
          </div>
          <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Stream Duration</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
              {((micDiagnostics?.streamDurationMs ?? 0) / 1000).toFixed(1)}s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
