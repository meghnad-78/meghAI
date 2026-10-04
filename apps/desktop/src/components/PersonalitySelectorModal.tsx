import React, { useEffect, useState } from 'react';
import type { PersonalityProfile } from '@meghai/shared-types';
import { PersonalityIcon, CloseIcon, SearchIcon, CheckIcon } from './ui/Icons.js';
import { tokens } from '../theme/tokens.js';

interface PersonalitySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPersonalityId: string;
  onSelectPersonality: (profile: PersonalityProfile) => void;
}

export const PersonalitySelectorModal: React.FC<PersonalitySelectorModalProps> = ({
  isOpen,
  onClose,
  selectedPersonalityId,
  onSelectPersonality
}) => {
  const [profiles, setProfiles] = useState<PersonalityProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/v1/personalities')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.profiles)) {
          setProfiles(data.profiles);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = profiles.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tone.toLowerCase().includes(q)
    );
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: tokens.colors.bg.overlay,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: tokens.zIndex.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '780px',
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
              <PersonalityIcon size={16} color={tokens.colors.accent.primary} />
              <h2
                style={{
                  margin: 0,
                  fontFamily: tokens.typography.fontDisplay,
                  fontSize: tokens.typography.sizes.lg,
                  fontWeight: 700,
                  color: tokens.colors.text.primary,
                  letterSpacing: '-0.02em'
                }}
              >
                Behavioral Persona & Cognitive Style
              </h2>
            </div>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: tokens.typography.sizes.xs,
                color: tokens.colors.text.muted
              }}
            >
              Changes tone, structure, verbosity, and AI core animation dynamics. Security and permissions remain invariant.
            </p>
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

        {/* Search */}
        <div
          style={{
            padding: '10px 24px',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
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
              placeholder="Filter archetypes (e.g. professional, coding, calm)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: tokens.colors.text.primary,
                fontSize: tokens.typography.sizes.sm,
                fontFamily: tokens.typography.fontSans,
                outline: 'none'
              }}
            />
          </div>
        </div>

        {/* Profiles Grid */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '10px',
            flex: 1
          }}
        >
          {filtered.map(profile => {
            const isSelected = profile.id.toLowerCase() === selectedPersonalityId.toLowerCase();
            return (
              <div
                key={profile.id}
                onClick={() => {
                  fetch('/api/v1/personalities/select', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ personalityId: profile.id })
                  })
                    .then(res => res.json())
                    .then(data => {
                      if (data.activeProfile) {
                        onSelectPersonality(data.activeProfile);
                        onClose();
                      }
                    })
                    .catch(() => {
                      onSelectPersonality(profile);
                      onClose();
                    });
                }}
                style={{
                  padding: '14px',
                  borderRadius: tokens.radii.sm,
                  border: `1px solid ${isSelected ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                  backgroundColor: isSelected ? tokens.colors.accent.primarySubtle : tokens.colors.bg.elevated,
                  cursor: 'pointer',
                  transition: tokens.transitions.fast,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: tokens.typography.sizes.base, color: tokens.colors.text.primary }}>
                      {profile.name}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: tokens.typography.fontMono,
                        padding: '1px 5px',
                        borderRadius: tokens.radii.xs,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: tokens.colors.text.secondary,
                        textTransform: 'uppercase'
                      }}
                    >
                      {profile.visualStyle}
                    </span>
                  </div>

                  {isSelected && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '10px',
                        fontFamily: tokens.typography.fontMono,
                        color: tokens.colors.accent.primary
                      }}
                    >
                      <CheckIcon size={11} color={tokens.colors.accent.primary} />
                      <span>ACTIVE</span>
                    </span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, lineHeight: 1.45 }}>
                  {profile.description}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '2px' }}>
                  <span style={{ fontSize: '10px', fontFamily: tokens.typography.fontMono, color: tokens.colors.text.muted, backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: tokens.radii.xs }}>
                    Tone: {profile.tone}
                  </span>
                  <span style={{ fontSize: '10px', fontFamily: tokens.typography.fontMono, color: tokens.colors.text.muted, backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: tokens.radii.xs }}>
                    Verbosity: {profile.verbosity}
                  </span>
                  {profile.technicalDepth && (
                    <span style={{ fontSize: '10px', fontFamily: tokens.typography.fontMono, color: tokens.colors.text.muted, backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: tokens.radii.xs }}>
                      Tech: {profile.technicalDepth}
                    </span>
                  )}
                </div>

                {profile.suggestedVoiceCharacteristics && profile.suggestedVoiceCharacteristics.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span style={{ fontSize: '10px', color: tokens.colors.text.faint }}>Suggested:</span>
                    {profile.suggestedVoiceCharacteristics.map((trait, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '9px',
                          fontFamily: tokens.typography.fontMono,
                          padding: '1px 5px',
                          borderRadius: tokens.radii.xs,
                          backgroundColor: tokens.colors.accent.primarySubtle,
                          color: tokens.colors.accent.primary,
                          border: `1px solid ${tokens.colors.border.accent}`
                        }}
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: `1px solid ${tokens.colors.border.subtle}`,
            backgroundColor: tokens.colors.bg.subtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: tokens.typography.sizes.xs,
            color: tokens.colors.text.muted
          }}
        >
          <span style={{ fontFamily: tokens.typography.fontMono }}>12 Archetypes Available</span>
          <button
            onClick={onClose}
            style={{
              padding: '4px 12px',
              backgroundColor: tokens.colors.bg.surface,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.xs,
              color: tokens.colors.text.primary,
              fontSize: tokens.typography.sizes.xs,
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
