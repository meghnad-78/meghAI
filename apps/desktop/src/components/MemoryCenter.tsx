import React, { useState, useEffect } from 'react';
import type { MemoryEntry } from '@meghai/shared-types';
import { tokens } from '../theme/tokens.js';
import { Icons } from './ui/Icons.js';

export const MemoryCenter: React.FC = () => {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLayer, setFilterLayer] = useState<string>('ALL');
  const [newContent, setNewContent] = useState('');
  const [newLayer, setNewLayer] = useState('SEMANTIC');
  const [newSensitivity, setNewSensitivity] = useState<'PUBLIC' | 'PERSONAL' | 'CONFIDENTIAL' | 'RESTRICTED'>('PERSONAL');
  const [isLoading, setIsLoading] = useState(false);

  const loadMemories = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/memory');
      const data = await res.json() as any;
      setMemories(data.memories || []);
      setCandidates(data.candidates || []);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemories();
  }, []);

  const handleAddMemory = async () => {
    if (!newContent.trim()) return;
    try {
      await fetch('/api/v1/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newContent,
          layer: newLayer,
          sensitivity: newSensitivity,
          durable: true
        })
      });
      setNewContent('');
      loadMemories();
    } catch {
      // Handle error
    }
  };

  const handlePromoteCandidate = async (candidateId: string) => {
    try {
      await fetch('/api/v1/memory/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId })
      });
      loadMemories();
    } catch {
      // Handle error
    }
  };

  const handleToggleLock = async (id: string, currentLock: boolean) => {
    try {
      await fetch('/api/v1/memory/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, locked: !currentLock })
      });
      loadMemories();
    } catch {
      // Handle error
    }
  };

  const filteredMemories = memories.filter(m => {
    if (filterLayer !== 'ALL' && m.type !== filterLayer) return false;
    if (searchQuery && !m.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '28px 36px',
        overflowY: 'auto',
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
          paddingBottom: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: tokens.colors.accent.primary, display: 'flex', alignItems: 'center' }}>
              <Icons.Memory size={22} />
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
              Durable Memory Substrate
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.secondary }}>
            Multi-layer contextual recall, behavioral candidate promotion, and immutable locked memories.
          </p>
        </div>
        <button
          onClick={loadMemories}
          style={{
            background: tokens.colors.bg.surface,
            border: `1px solid ${tokens.colors.border.default}`,
            color: tokens.colors.text.secondary,
            borderRadius: tokens.radii.xs,
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: tokens.typography.sizes.xs,
            fontFamily: tokens.typography.fontMono
          }}
        >
          {isLoading ? 'REFRESHING...' : 'REFRESH'}
        </button>
      </div>

      {/* Add Memory Box */}
      <div
        style={{
          background: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.radii.md,
          padding: '16px',
          marginBottom: '20px'
        }}
      >
        <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.secondary, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
          Record Permanent Context
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
          <input
            type="text"
            placeholder="e.g. User prefers Python for backend and TypeScript for frontend."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            style={{
              flex: 1,
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '8px 12px',
              color: tokens.colors.text.primary,
              fontSize: tokens.typography.sizes.sm,
              outline: 'none'
            }}
          />
          <select
            value={newLayer}
            onChange={e => setNewLayer(e.target.value)}
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '8px 12px',
              color: tokens.colors.text.secondary,
              fontSize: tokens.typography.sizes.xs
            }}
          >
            <option value="SEMANTIC">SEMANTIC</option>
            <option value="PREFERENCE">PREFERENCE</option>
            <option value="EPISODIC">EPISODIC</option>
            <option value="PROCEDURAL">PROCEDURAL</option>
            <option value="PROJECT">PROJECT</option>
          </select>
          <select
            value={newSensitivity}
            onChange={e => setNewSensitivity(e.target.value as any)}
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '8px 12px',
              color: tokens.colors.text.secondary,
              fontSize: tokens.typography.sizes.xs
            }}
          >
            <option value="PUBLIC">PUBLIC</option>
            <option value="PERSONAL">PERSONAL</option>
            <option value="CONFIDENTIAL">CONFIDENTIAL</option>
            <option value="RESTRICTED">RESTRICTED</option>
          </select>
          <button
            onClick={handleAddMemory}
            style={{
              background: tokens.colors.accent.primary,
              border: 'none',
              borderRadius: tokens.radii.sm,
              padding: '8px 16px',
              color: tokens.colors.bg.canvas,
              fontWeight: 600,
              fontSize: tokens.typography.sizes.xs,
              cursor: 'pointer',
              fontFamily: tokens.typography.fontMono
            }}
          >
            STORE
          </button>
        </div>
      </div>

      {/* Candidates for Promotion */}
      {candidates.length > 0 && (
        <div
          style={{
            background: tokens.colors.semantic.warningMuted,
            border: `1px solid ${tokens.colors.semantic.warning}`,
            borderRadius: tokens.radii.md,
            padding: '16px',
            marginBottom: '20px'
          }}
        >
          <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.semantic.warning, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
            Contextual Candidates (Awaiting Promotion)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {candidates.map(c => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: tokens.colors.bg.surface,
                  border: `1px solid ${tokens.colors.border.subtle}`,
                  padding: '10px 14px',
                  borderRadius: tokens.radii.sm
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '10px',
                      background: tokens.colors.bg.elevated,
                      color: tokens.colors.semantic.warning,
                      padding: '2px 6px',
                      borderRadius: tokens.radii.xs,
                      marginRight: '8px',
                      fontFamily: tokens.typography.fontMono
                    }}
                  >
                    {c.layer}
                  </span>
                  <span style={{ fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.primary }}>{c.content}</span>
                </div>
                <button
                  onClick={() => handlePromoteCandidate(c.id)}
                  style={{
                    background: tokens.colors.semantic.successMuted,
                    border: `1px solid ${tokens.colors.semantic.success}`,
                    borderRadius: tokens.radii.xs,
                    padding: '5px 12px',
                    color: tokens.colors.semantic.success,
                    fontWeight: 600,
                    fontSize: tokens.typography.sizes.xs,
                    cursor: 'pointer',
                    fontFamily: tokens.typography.fontMono
                  }}
                >
                  PROMOTE
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Filter memories by keyword..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: tokens.colors.bg.surface,
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '8px 14px',
            color: tokens.colors.text.primary,
            fontSize: tokens.typography.sizes.xs,
            outline: 'none'
          }}
        />
        <select
          value={filterLayer}
          onChange={e => setFilterLayer(e.target.value)}
          style={{
            background: tokens.colors.bg.surface,
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '8px 14px',
            color: tokens.colors.text.secondary,
            fontSize: tokens.typography.sizes.xs
          }}
        >
          <option value="ALL">All Layers</option>
          <option value="SEMANTIC">Semantic</option>
          <option value="PREFERENCE">Preference</option>
          <option value="EPISODIC">Episodic</option>
          <option value="PROCEDURAL">Procedural</option>
          <option value="PROJECT">Project</option>
        </select>
      </div>

      {/* Memory List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredMemories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: tokens.colors.text.muted, fontSize: tokens.typography.sizes.sm }}>
            No permanent memories recorded matching criteria.
          </div>
        ) : (
          filteredMemories.map(m => (
            <div
              key={m.id}
              style={{
                background: tokens.colors.bg.surface,
                border: `1px solid ${tokens.colors.border.subtle}`,
                borderRadius: tokens.radii.sm,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: tokens.radii.xs,
                      background: tokens.colors.bg.elevated,
                      color: tokens.colors.accent.primary,
                      fontWeight: 600,
                      fontFamily: tokens.typography.fontMono
                    }}
                  >
                    {m.type}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: tokens.radii.xs,
                      background: tokens.colors.bg.subtle,
                      color: tokens.colors.text.muted,
                      fontFamily: tokens.typography.fontMono
                    }}
                  >
                    {m.sensitivity}
                  </span>
                  {m.locked && (
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: tokens.radii.xs,
                        background: tokens.colors.semantic.errorMuted,
                        color: tokens.colors.semantic.error,
                        fontFamily: tokens.typography.fontMono
                      }}
                    >
                      LOCKED
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: tokens.colors.text.faint, fontFamily: tokens.typography.fontMono }}>
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.primary, lineHeight: '1.4' }}>
                  {m.content}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                <button
                  onClick={() => handleToggleLock(m.id, Boolean(m.locked))}
                  style={{
                    background: m.locked ? tokens.colors.semantic.errorMuted : tokens.colors.bg.subtle,
                    border: `1px solid ${m.locked ? tokens.colors.semantic.error : tokens.colors.border.default}`,
                    color: m.locked ? tokens.colors.semantic.error : tokens.colors.text.muted,
                    borderRadius: tokens.radii.xs,
                    padding: '4px 10px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontFamily: tokens.typography.fontMono
                  }}
                >
                  {m.locked ? 'UNLOCK' : 'LOCK'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
