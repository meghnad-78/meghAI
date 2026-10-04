import React, { useEffect, useState } from 'react';
import { VoiceIcon, PlayIcon, StopIcon, CloseIcon, SearchIcon } from './ui/Icons.js';
import { tokens } from '../theme/tokens.js';

interface VoiceItem {
  id: string;
  name: string;
  provider: 'windows-onecore' | 'windows-sapi' | 'google-cloud' | 'elevenlabs' | 'openai';
  language: string;
  gender: 'female' | 'male' | 'neutral';
  naturalness: 'robotic' | 'clear' | 'natural' | 'lifelike';
  accent?: string;
  available: boolean;
  isCustom?: boolean;
  characteristics?: string[];
  supportedControls?: ('speed' | 'pitch' | 'stability' | 'similarity' | 'style')[];
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
        body: JSON.stringify({ voiceId, text: 'Greetings. I am MeghAI, your personal intelligence layer.' })
      });
    } catch {} finally {
      setPreviewingId(null);
    }
  };

  const filteredVoices = voices.filter(v => {
    const q = search.toLowerCase();
    const matchesSearch = v.name.toLowerCase().includes(q) ||
      v.language.toLowerCase().includes(q) ||
      (v.accent && v.accent.toLowerCase().includes(q)) ||
      (v.characteristics && v.characteristics.some(c => c.toLowerCase().includes(q)));
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
        backgroundColor: tokens.colors.bg.overlay,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.strong}`,
          borderRadius: tokens.radii.lg,
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px 14px',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <VoiceIcon size={16} color={tokens.colors.accent.primary} />
              <span
                style={{
                  fontFamily: tokens.typography.fontDisplay,
                  fontSize: tokens.typography.sizes.lg,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: tokens.colors.text.primary
                }}
              >
                Voice Profile Directory
              </span>
            </div>
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginTop: '2px' }}>
              Native Windows offline speech or neural cloud synthesis
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.colors.text.muted,
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            backgroundColor: tokens.colors.bg.subtle
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: tokens.colors.bg.surface,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.xs,
              padding: '6px 10px'
            }}
          >
            <SearchIcon size={14} color={tokens.colors.text.muted} />
            <input
              type="text"
              placeholder="Filter by name, characteristics, language (e.g. Heera, calm, Hindi)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: tokens.colors.text.primary,
                fontSize: tokens.typography.sizes.sm,
                fontFamily: tokens.typography.fontSans,
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'all', label: 'All Providers' },
              { id: 'windows-onecore', label: 'OneCore' },
              { id: 'windows-sapi', label: 'SAPI' },
              { id: 'google-cloud', label: 'Google Cloud' },
              { id: 'elevenlabs', label: 'ElevenLabs' },
              { id: 'openai', label: 'OpenAI' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedProvider(tab.id)}
                style={{
                  background: selectedProvider === tab.id ? tokens.colors.accent.primarySubtle : tokens.colors.bg.surface,
                  border: `1px solid ${selectedProvider === tab.id ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                  borderRadius: tokens.radii.xs,
                  padding: '3px 9px',
                  color: selectedProvider === tab.id ? tokens.colors.accent.primary : tokens.colors.text.secondary,
                  fontSize: tokens.typography.sizes.xs,
                  fontFamily: tokens.typography.fontMono,
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
                  borderRadius: tokens.radii.sm,
                  border: `1px solid ${isSelected ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                  backgroundColor: isSelected ? tokens.colors.accent.primarySubtle : tokens.colors.bg.elevated,
                  cursor: v.available ? 'pointer' : 'default',
                  opacity: v.available ? 1 : 0.45,
                  transition: tokens.transitions.fast
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: tokens.typography.sizes.sm,
                        color: isSelected ? tokens.colors.accent.primary : tokens.colors.text.primary
                      }}
                    >
                      {v.name}
                    </span>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontFamily: tokens.typography.fontMono,
                          padding: '1px 5px',
                          borderRadius: tokens.radii.xs,
                          backgroundColor: tokens.colors.accent.primaryMuted,
                          color: tokens.colors.accent.primary,
                          border: `1px solid ${tokens.colors.border.accent}`
                        }}
                      >
                        ACTIVE
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: tokens.typography.fontMono,
                        padding: '1px 5px',
                        borderRadius: tokens.radii.xs,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: tokens.colors.text.muted,
                        border: `1px solid ${tokens.colors.border.subtle}`
                      }}
                    >
                      {v.provider.replace('windows-', '').toUpperCase()}
                    </span>
                  </div>
                  <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted }}>
                    {v.language} {v.accent ? `• ${v.accent}` : ''} • {v.naturalness}
                  </span>
                  {v.characteristics && v.characteristics.length > 0 && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {v.characteristics.slice(0, 3).map((ch, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: '9px',
                            fontFamily: tokens.typography.fontMono,
                            padding: '1px 5px',
                            borderRadius: tokens.radii.xs,
                            background: 'rgba(255, 255, 255, 0.04)',
                            color: tokens.colors.text.secondary,
                            border: `1px solid ${tokens.colors.border.subtle}`
                          }}
                        >
                          {ch}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {v.available && (
                    <button
                      onClick={e => handlePreview(v.id, e)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'transparent',
                        border: `1px solid ${tokens.colors.border.default}`,
                        borderRadius: tokens.radii.xs,
                        padding: '3px 8px',
                        color: tokens.colors.text.secondary,
                        fontSize: tokens.typography.sizes.xs,
                        cursor: 'pointer'
                      }}
                    >
                      {previewingId === v.id ? <StopIcon size={11} /> : <PlayIcon size={11} />}
                      <span>{previewingId === v.id ? 'PLAYING' : 'TEST'}</span>
                    </button>
                  )}
                  {!v.available && (
                    <span style={{ fontSize: '10px', color: tokens.colors.text.faint, fontFamily: tokens.typography.fontMono }}>
                      KEY NEEDED
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
