import React, { useState, useEffect } from 'react';
import type { VoiceProfile, PersonalityMode, VoiceSettings } from '@meghai/shared-types';

export const VoiceStudio: React.FC = () => {
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>({
    selectedVoiceId: 'local-david',
    speechRate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    personalityMode: 'FUTURISTIC_COMPANION'
  });
  const [languageFilter, setLanguageFilter] = useState('');
  const [providerFilter, setProviderFilter] = useState('');
  const [previewText, setPreviewText] = useState('Greetings. I am MeghAI, your personal intelligence layer.');
  const [previewStatus, setPreviewStatus] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [vRes, sRes] = await Promise.all([
        fetch('/api/v1/voice/catalog'),
        fetch('/api/v1/voice/settings')
      ]);
      const vData = await vRes.json();
      const sData = await sRes.json();
      setVoices(vData || []);
      if (sData?.selectedVoiceId) setSettings(sData);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
    setPreviewStatus(`Synthesizing preview for ${voiceId}...`);
    try {
      const res = await fetch('/api/v1/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, text: previewText })
      });
      const data = await res.json() as any;
      setPreviewStatus(`✓ Audio rendered (${data.speechRate}x rate, ${data.pitch} pitch)`);
      setTimeout(() => setPreviewStatus(null), 3500);
    } catch (err) {
      setPreviewStatus(`Preview failed: ${(err as Error).message}`);
    }
  };

  const filteredVoices = voices.filter(v => {
    if (languageFilter && !v.language.toLowerCase().includes(languageFilter.toLowerCase())) return false;
    if (providerFilter && v.provider !== providerFilter) return false;
    return true;
  });

  const personalities: Array<{ id: PersonalityMode; title: string; desc: string; icon: string }> = [
    { id: 'FUTURISTIC_COMPANION', title: 'Futuristic Companion', desc: 'Omnipresent, razor-sharp intelligence partner.', icon: '⚡' },
    { id: 'PROFESSIONAL', title: 'Executive Professional', desc: 'Direct, clear, and action-oriented precision.', icon: '💼' },
    { id: 'WARM', title: 'Warm & Empathetic', desc: 'Friendly, courteous, accessible, and supportive.', icon: '☀️' },
    { id: 'CALM_ASSISTANT', title: 'Calm & Deliberate', desc: 'Peaceful, minimalist, and unhurried focus.', icon: '🌿' }
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Voice & Personality Studio</h2>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
          Select from 100+ multi-dialect voices, tune speech cadence, and select MeghAI’s personality tone.
        </p>
      </div>

      {/* Personality Mode Selector */}
      <div style={{ marginBottom: '24px' }}>
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
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
            <span>Speech Speed</span>
            <span>{settings.speechRate.toFixed(2)}x</span>
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
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
            <span>Pitch</span>
            <span>{settings.pitch.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.5"
            step="0.05"
            value={settings.pitch}
            onChange={e => handleUpdateSettings({ pitch: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: '#8a2be2' }}
          />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
            <span>Output Volume</span>
            <span>{Math.round(settings.volume * 100)}%</span>
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
      </div>

      {/* Voice Directory & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
          Voice Catalog ({filteredVoices.length} available)
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={languageFilter}
            onChange={e => setLanguageFilter(e.target.value)}
            style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}
          >
            <option value="">All Languages</option>
            <option value="en">English (US/UK/IN)</option>
            <option value="hi">Hindi (India)</option>
            <option value="bn">Bengali (India/BD)</option>
          </select>
          <select
            value={providerFilter}
            onChange={e => setProviderFilter(e.target.value)}
            style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', color: '#cbd5e1', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}
          >
            <option value="">All Providers</option>
            <option value="local">Local (Windows SAPI)</option>
            <option value="google">Google Cloud</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>
      </div>

      {/* Custom Test Phrase Input */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        <input
          type="text"
          value={previewText}
          onChange={e => setPreviewText(e.target.value)}
          placeholder="Test phrase to synthesize..."
          style={{
            flex: 1,
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            padding: '6px 12px',
            color: '#f8fafc',
            fontSize: '12px'
          }}
        />
      </div>

      {previewStatus && (
        <div style={{ background: 'rgba(0, 240, 255, 0.1)', border: '1px solid #00f0ff', color: '#00f0ff', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '12px' }}>
          {previewStatus}
        </div>
      )}

      {/* Voices Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
        {filteredVoices.slice(0, 36).map(v => {
          const isSelected = settings.selectedVoiceId === v.id;
          return (
            <div
              key={v.id}
              style={{
                background: isSelected ? 'rgba(0, 240, 255, 0.08)' : 'rgba(15, 23, 42, 0.55)',
                border: `1px solid ${isSelected ? '#00f0ff' : 'rgba(255, 255, 255, 0.06)'}`,
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{v.name}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {v.language} • {v.provider} • {v.gender}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handlePreview(v.id)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#38bdf8',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                  title="Test Audio Sample"
                >
                  ▶ Test
                </button>
                <button
                  onClick={() => handleUpdateSettings({ selectedVoiceId: v.id })}
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
          );
        })}
      </div>
    </div>
  );
};
