import React, { useState, useEffect } from 'react';
import type { NoteEntry } from '@meghai/shared-types';

export const NotesCenter: React.FC = () => {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadNotes = async () => {
    try {
      const res = await fetch('/api/v1/notes');
      const data = await res.json();
      setNotes(data || []);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const handleCreateNote = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    const tags = newTags.split(',').map(t => t.trim()).filter(Boolean);
    try {
      await fetch('/api/v1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          tags
        })
      });
      setNewTitle('');
      setNewContent('');
      setNewTags('');
      loadNotes();
    } catch {
      // Handle error
    }
  };

  const filteredNotes = notes.filter(n => {
    if (searchQuery && !n.title.toLowerCase().includes(searchQuery.toLowerCase()) && !n.content.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Notes & Personal Knowledge</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Persistent notes, verified facts, and indexed research documents.
          </p>
        </div>
        <button
          onClick={loadNotes}
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
          ↻ Refresh
        </button>
      </div>

      {/* Add Note Box */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>
          + Create Note
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Title (e.g. Architecture Decisions for MeghAI)"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
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
            <input
              type="text"
              placeholder="Tags, comma-separated (e.g. ai, architecture, windows)"
              value={newTags}
              onChange={e => setNewTags(e.target.value)}
              style={{
                width: '260px',
                background: 'rgba(7, 9, 14, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                padding: '8px 12px',
                color: '#f8fafc',
                fontSize: '13px'
              }}
            />
          </div>
          <textarea
            placeholder="Note content..."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={3}
            style={{
              background: 'rgba(7, 9, 14, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#f8fafc',
              fontSize: '13px',
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCreateNote}
              style={{
                background: 'linear-gradient(135deg, #00f0ff, #8a2be2)',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 18px',
                color: '#07090e',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Save Note
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '14px' }}>
        <input
          type="text"
          placeholder="Search notes..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '8px 14px',
            color: '#f8fafc',
            fontSize: '13px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Notes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
        {filteredNotes.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
            No notes found.
          </div>
        ) : (
          filteredNotes.map(note => (
            <div
              key={note.id}
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                  {note.title}
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'hidden' }}>
                  {note.content}
                </div>
              </div>

              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {note.tags?.map(t => (
                    <span key={t} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0, 240, 255, 0.12)', color: '#00f0ff' }}>
                      #{t}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '10px', color: '#64748b' }}>
                  {new Date(note.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
