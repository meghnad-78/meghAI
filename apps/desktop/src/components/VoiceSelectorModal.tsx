import React, { useEffect, useState } from 'react';
import { GlassSurface } from './ui/GlassSurface.js';
import { Button } from './ui/Button.js';
import { Badge } from './ui/Badge.js';
import { tokens } from '../theme/tokens.js';

interface VoiceItem {
  id: string;
  name: string;
  provider: 'windows-onecore' | 'windows-sapi' | 'google-cloud' | 'elevenlabs';
  language: string;
  gender: 'female' | 'male' | 'neutral';
  naturalness: 'robotic' | 'clear' | 'natural' | 'lifelike';
  accent?: string;
  available: boolean;
  isCustom?: boolean;
}

interface VoiceSelectorModalProps {
  isOpen: boolean;
  selectedVoiceId: string;
  onSelectVoice: (voiceId: string) => void;
  onClose: () => void;
}

export const VoiceSelectorModal: React.FC<VoiceSelectorModalProps> = ({
  isOpen,
  selectedVoiceId,
  onSelectVoice,
  onClose
}) => {
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/v1/voice/catalog')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setVoices(data);
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePreview = async (voiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingId === voiceId) return;
    setPreviewingId(voiceId);
    try {
      await fetch('/api/v1/voice/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceId, text: 'Hello! I am MeghAI, your personal operating assistant.' })
      });
    } catch {} finally {
      setPreviewingId(null);
    }
  };

  const filteredVoices = voices.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.language.toLowerCase().includes(search.toLowerCase()) ||
      (v.accent && v.accent.toLowerCase().includes(search.toLowerCase()));
    const matchesProvider = selectedProvider === 'all' || v.provider === selectedProvider;
    return matchesSearch && matchesProvider;
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: tokens.zIndex.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4, 6, 10, 0.78)',
        backdropFilter: 'blur(16px)',
        padding: '24px'
      }}
      onClick={onClose}
    >
      <GlassSurface
        elevation="floating"
        style={{
          width: '100%',
          maxWidth: '580px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: tokens.radii.xl
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ fontSize: tokens.typography.sizes.lg, fontWeight: 700, color: tokens.colors.text.primary }}>
              Select Voice Persona
            </div>
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginTop: '2px' }}>
              Choose native Windows or neural cloud voice synthesis
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.colors.text.muted,
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: tokens.radii.sm
            }}
          >
            ✕
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${tokens.colors.border.subtle}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            placeholder="Search voices, languages (e.g. Heera, Hindi, English)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.md,
              padding: '8px 12px',
              color: tokens.colors.text.primary,
              fontSize: tokens.typography.sizes.sm,
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />

          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'all', label: 'All Providers' },
              { id: 'windows-onecore', label: 'OneCore (WinRT)' },
              { id: 'windows-sapi', label: 'SAPI' },
              { id: 'google-cloud', label: 'Google Cloud' },
              { id: 'elevenlabs', label: 'ElevenLabs' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedProvider(tab.id)}
                style={{
                  background: selectedProvider === tab.id ? tokens.colors.accent.cyanMuted : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${selectedProvider === tab.id ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                  borderRadius: tokens.radii.sm,
                  padding: '4px 10px',
                  color: selectedProvider === tab.id ? tokens.colors.accent.cyan : tokens.colors.text.secondary,
                  fontSize: tokens.typography.sizes.xs,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Voice List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filteredVoices.map(v => {
            const isSelected = selectedVoiceId === v.id;

            return (
              <div
                key={v.id}
                onClick={() => {
                  if (v.available) {
                    onSelectVoice(v.id);
                    onClose();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: tokens.radii.md,
                  border: `1px solid ${isSelected ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                  background: isSelected
                    ? 'rgba(0, 240, 255, 0.08)'
                    : v.available
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(255, 255, 255, 0.005)',
                  cursor: v.available ? 'pointer' : 'default',
                  opacity: v.available ? 1 : 0.45,
                  transition: tokens.transitions.fast
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: tokens.typography.sizes.sm, color: isSelected ? tokens.colors.accent.cyan : tokens.colors.text.primary }}>
                        {v.name}
                      </span>
                      {isSelected && <Badge variant="accent" size="sm">ACTIVE</Badge>}
                      <Badge variant="neutral" size="sm">{v.provider.replace('windows-', '')}</Badge>
                    </div>
                    <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted }}>
                      {v.language} {v.accent ? `• ${v.accent}` : ''} • {v.naturalness}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {v.available && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handlePreview(v.id, e)}
                      loading={previewingId === v.id}
                    >
                      {previewingId === v.id ? 'Playing...' : '🔊 Preview'}
                    </Button>
                  )}
                  {!v.available && (
                    <span style={{ fontSize: '11px', color: tokens.colors.text.faint }}>
                      Key needed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </GlassSurface>
    </div>
  );
};
