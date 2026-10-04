import React, { useState, useEffect } from 'react';
import type { NoteEntry } from '@meghai/shared-types';
import { tokens } from '../theme/tokens.js';
import { Icons } from './ui/Icons.js';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: tokens.colors.accent.primary, display: 'flex', alignItems: 'center' }}>
              <Icons.Notes size={22} />
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
              Notes & Knowledge Ledger
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.secondary }}>
            Persistent structured notes, verified operational facts, and indexed markdown records.
          </p>
        </div>
        <button
          onClick={loadNotes}
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
          REFRESH
        </button>
      </div>

      {/* Add Note Box */}
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
          Draft Record
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              placeholder="Record Title (e.g. Architecture Decisions for MeghAI)"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
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
            <input
              type="text"
              placeholder="Tags, comma-separated (e.g. ai, windows)"
              value={newTags}
              onChange={e => setNewTags(e.target.value)}
              style={{
                width: '260px',
                background: tokens.colors.bg.subtle,
                border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: tokens.radii.sm,
                padding: '8px 12px',
                color: tokens.colors.text.primary,
                fontSize: tokens.typography.sizes.xs,
                outline: 'none'
              }}
            />
          </div>
          <textarea
            placeholder="Record contents..."
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            rows={3}
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '8px 12px',
              color: tokens.colors.text.primary,
              fontSize: tokens.typography.sizes.sm,
              resize: 'vertical',
              outline: 'none',
              fontFamily: tokens.typography.fontSans
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleCreateNote}
              style={{
                background: tokens.colors.accent.primary,
                border: 'none',
                borderRadius: tokens.radii.sm,
                padding: '8px 18px',
                color: tokens.colors.bg.canvas,
                fontWeight: 600,
                fontSize: tokens.typography.sizes.xs,
                cursor: 'pointer',
                fontFamily: tokens.typography.fontMono
              }}
            >
              SAVE RECORD
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '14px' }}>
        <input
          type="text"
          placeholder="Filter notes by title or content..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            background: tokens.colors.bg.surface,
            border: `1px solid ${tokens.colors.border.default}`,
            borderRadius: tokens.radii.sm,
            padding: '8px 14px',
            color: tokens.colors.text.primary,
            fontSize: tokens.typography.sizes.xs,
            boxSizing: 'border-box',
            outline: 'none'
          }}
        />
      </div>

      {/* Notes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
        {filteredNotes.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: tokens.colors.text.muted, fontSize: tokens.typography.sizes.sm }}>
            No notes recorded matching criteria.
          </div>
        ) : (
          filteredNotes.map(note => (
            <div
              key={note.id}
              style={{
                background: tokens.colors.bg.surface,
                border: `1px solid ${tokens.colors.border.subtle}`,
                borderRadius: tokens.radii.sm,
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary, marginBottom: '6px', fontFamily: tokens.typography.fontDisplay }}>
                  {note.title}
                </div>
                <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, lineHeight: '1.5', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'hidden' }}>
                  {note.content}
                </div>
              </div>

              <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${tokens.colors.border.subtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {note.tags?.map(t => (
                    <span
                      key={t}
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: tokens.radii.xs,
                        background: tokens.colors.bg.subtle,
                        border: `1px solid ${tokens.colors.border.subtle}`,
                        color: tokens.colors.accent.primary,
                        fontFamily: tokens.typography.fontMono
                      }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: '10px', color: tokens.colors.text.faint, fontFamily: tokens.typography.fontMono }}>
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
