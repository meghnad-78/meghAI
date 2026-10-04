import React, { useState, useEffect } from 'react';
import type { TaskEntry } from '@meghai/shared-types';
import { tokens } from '../theme/tokens.js';
import { Icons } from './ui/Icons.js';

export const TaskCenter: React.FC = () => {
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [newDueDate, setNewDueDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadTasks = async () => {
    try {
      const res = await fetch('/api/v1/tasks');
      const data = await res.json();
      setTasks(data || []);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreateTask = async () => {
    if (!newTitle.trim()) return;
    try {
      await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          priority: newPriority,
          dueDate: newDueDate || undefined
        })
      });
      setNewTitle('');
      setNewDueDate('');
      loadTasks();
    } catch {
      // Handle error
    }
  };

  const filteredTasks = tasks.filter(t => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return tokens.colors.semantic.error;
      case 'HIGH':
        return tokens.colors.semantic.warning;
      case 'MEDIUM':
        return tokens.colors.accent.primary;
      default:
        return tokens.colors.text.muted;
    }
  };

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
              <Icons.Tasks size={22} />
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
              Task Queue & Execution Plan
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.secondary }}>
            Autonomous agent tasks, step-by-step verified execution plans, and persistent DAG orchestration.
          </p>
        </div>
        <button
          onClick={loadTasks}
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

      {/* Add Task Box */}
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
          Queue New Execution Task
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Task description (e.g. Audit security rules for OAuth integrations)"
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
          <select
            value={newPriority}
            onChange={e => setNewPriority(e.target.value as any)}
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '8px 12px',
              color: tokens.colors.text.secondary,
              fontSize: tokens.typography.sizes.xs
            }}
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
          <input
            type="date"
            value={newDueDate}
            onChange={e => setNewDueDate(e.target.value)}
            style={{
              background: tokens.colors.bg.subtle,
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.sm,
              padding: '8px 12px',
              color: tokens.colors.text.secondary,
              fontSize: tokens.typography.sizes.xs
            }}
          />
          <button
            onClick={handleCreateTask}
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
            DISPATCH
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {['ALL', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'].map(st => {
          const isActive = statusFilter === st;
          return (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: isActive ? tokens.colors.accent.primarySubtle : tokens.colors.bg.subtle,
                border: `1px solid ${isActive ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                color: isActive ? tokens.colors.accent.primary : tokens.colors.text.muted,
                borderRadius: tokens.radii.xs,
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: tokens.typography.fontMono
              }}
            >
              {st}
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: tokens.colors.text.muted, fontSize: tokens.typography.sizes.sm }}>
            No tasks queued matching criteria.
          </div>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
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
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: tokens.radii.xs,
                      background: tokens.colors.bg.subtle,
                      color: getPriorityColor(task.priority),
                      fontWeight: 600,
                      fontFamily: tokens.typography.fontMono
                    }}
                  >
                    {task.priority}
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
                    {task.status}
                  </span>
                  {task.dueDate && (
                    <span style={{ fontSize: '11px', color: tokens.colors.text.muted, fontFamily: tokens.typography.fontMono }}>
                      Due: {task.dueDate}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 500, color: tokens.colors.text.primary }}>
                  {task.title}
                </div>
              </div>
              <span style={{ fontSize: '11px', color: tokens.colors.text.faint, fontFamily: tokens.typography.fontMono }}>
                {new Date(task.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
