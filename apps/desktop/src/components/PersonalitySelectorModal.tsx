import React, { useEffect, useState } from 'react';
import type { PersonalityProfile } from '@meghai/shared-types';
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
          border: `1px solid ${tokens.colors.border.hover}`,
          borderRadius: tokens.radii.lg,
          boxShadow: tokens.shadows.floating,
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>🎭</span>
              <h2
                style={{
                  margin: 0,
                  fontSize: tokens.typography.sizes.lg,
                  fontWeight: 700,
                  color: tokens.colors.text.primary,
                  letterSpacing: '-0.02em'
                }}
              >
                AI Personality & Behavioral Persona
              </h2>
            </div>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: tokens.typography.sizes.xs,
                color: tokens.colors.text.muted
              }}
            >
              Changes assistant tone, response structure, verbosity, and style. Security and permissions remain invariant.
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.colors.text.muted,
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${tokens.colors.border.subtle}` }}>
          <input
            type="text"
            placeholder="Search personalities (e.g. professional, coding, calm)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: tokens.colors.bg.elevated,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              color: tokens.colors.text.primary,
              fontSize: tokens.typography.sizes.sm,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Profiles Grid */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
            gap: '12px',
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
                  padding: '16px',
                  borderRadius: tokens.radii.md,
                  border: `1px solid ${isSelected ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                  backgroundColor: isSelected ? 'rgba(0, 240, 255, 0.04)' : tokens.colors.bg.elevated,
                  cursor: 'pointer',
                  transition: tokens.transitions.fast,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: isSelected ? tokens.shadows.glowCyan : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: tokens.typography.sizes.base, color: tokens.colors.text.primary }}>
                      {profile.name}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: tokens.radii.pill,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: tokens.colors.text.secondary,
                        textTransform: 'uppercase'
                      }}
                    >
                      {profile.visualStyle}
                    </span>
                  </div>

                  {isSelected && (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: tokens.colors.accent.cyan }}>
                      ✓ ACTIVE
                    </span>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, lineHeight: 1.4 }}>
                  {profile.description}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  <span style={{ fontSize: '10px', color: tokens.colors.text.muted, backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: tokens.radii.xs }}>
                    Tone: {profile.tone}
                  </span>
                  <span style={{ fontSize: '10px', color: tokens.colors.text.muted, backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: tokens.radii.xs }}>
                    Verbosity: {profile.verbosity}
                  </span>
                  {profile.technicalDepth && (
                    <span style={{ fontSize: '10px', color: tokens.colors.text.muted, backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: tokens.radii.xs }}>
                      Tech: {profile.technicalDepth}
                    </span>
                  )}
                </div>

                {profile.suggestedVoiceCharacteristics && profile.suggestedVoiceCharacteristics.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', color: tokens.colors.text.faint }}>Suggested Voice:</span>
                    {profile.suggestedVoiceCharacteristics.map((trait, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '9px',
                          padding: '1px 5px',
                          borderRadius: tokens.radii.pill,
                          backgroundColor: 'rgba(0, 240, 255, 0.08)',
                          color: tokens.colors.accent.cyan,
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: tokens.typography.sizes.xs,
            color: tokens.colors.text.muted
          }}
        >
          <span>12 Built-in Personality Archetypes Available</span>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
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
