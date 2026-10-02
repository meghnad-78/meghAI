import React, { useState, useEffect } from 'react';
import type { MemoryEntry } from '@meghai/shared-types';

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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Memory Center</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Multi-layer long-term recall, behavioral candidate promotion, and locked memories.
          </p>
        </div>
        <button
          onClick={loadMemories}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#38bdf8',
            borderRadius: '8px',
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          {isLoading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* Add Memory Box */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>
          + Store Permanent Memory
        </div>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="e.g. User prefers Python for backend and TypeScript for frontend."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(7, 9, 14, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: '13px'
            }}
          />
          <select
            value={newLayer}
            onChange={e => setNewLayer(e.target.value)}
            style={{
              background: 'rgba(7, 9, 14, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#cbd5e1',
              fontSize: '13px'
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
              background: 'rgba(7, 9, 14, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#cbd5e1',
              fontSize: '13px'
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
              background: 'linear-gradient(135deg, #00f0ff, #8a2be2)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#07090e',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Candidates for Promotion */}
      {candidates.length > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24', marginBottom: '8px' }}>
            ★ Memory Candidates (Awaiting Promotion)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {candidates.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.5)', padding: '8px 12px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '2px 6px', borderRadius: '4px', marginRight: '8px' }}>
                    {c.layer}
                  </span>
                  <span style={{ fontSize: '13px', color: '#f1f5f9' }}>{c.content}</span>
                </div>
                <button
                  onClick={() => handlePromoteCandidate(c.id)}
                  style={{
                    background: '#10b981',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    color: '#07090e',
                    fontWeight: 600,
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  ✓ Promote to Durable
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
          placeholder="Search recalled memories..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: '#f8fafc',
            fontSize: '13px'
          }}
        />
        <select
          value={filterLayer}
          onChange={e => setFilterLayer(e.target.value)}
          style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: '#cbd5e1',
            fontSize: '13px'
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredMemories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
            No permanent memories found matching your criteria.
          </div>
        ) : (
          filteredMemories.map(m => (
            <div
              key={m.id}
              style={{
                background: 'rgba(15, 23, 42, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 600 }}>
                    {m.type}
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
                    {m.sensitivity}
                  </span>
                  {m.locked && (
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                      🔒 LOCKED
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', lineHeight: '1.4' }}>
                  {m.content}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                <button
                  onClick={() => handleToggleLock(m.id, Boolean(m.locked))}
                  style={{
                    background: m.locked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${m.locked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: m.locked ? '#f87171' : '#94a3b8',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {m.locked ? 'Unlock' : 'Lock'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
