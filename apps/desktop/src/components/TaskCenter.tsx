import React, { useState, useEffect } from 'react';
import type { TaskEntry } from '@meghai/shared-types';

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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Tasks & DAG Orchestration</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Actionable user tasks, multi-step agent plans, and persistent task continuity.
          </p>
        </div>
        <button
          onClick={loadTasks}
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

      {/* Add Task Box */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '10px' }}>
          + Create New Task
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Task description (e.g. Audit security rules for OAuth integrations)"
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
          <select
            value={newPriority}
            onChange={e => setNewPriority(e.target.value as any)}
            style={{
              background: 'rgba(7, 9, 14, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#cbd5e1',
              fontSize: '13px'
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
              background: 'rgba(7, 9, 14, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: '#cbd5e1',
              fontSize: '13px'
            }}
          />
          <button
            onClick={handleCreateTask}
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
            Add Task
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {['ALL', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'].map(st => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            style={{
              background: statusFilter === st ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${statusFilter === st ? '#00f0ff' : 'rgba(255, 255, 255, 0.08)'}`,
              color: statusFilter === st ? '#00f0ff' : '#94a3b8',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredTasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '13px' }}>
            No tasks found.
          </div>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: task.priority === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : task.priority === 'HIGH' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                    color: task.priority === 'CRITICAL' ? '#f87171' : task.priority === 'HIGH' ? '#fbbf24' : '#38bdf8',
                    fontWeight: 700
                  }}>
                    {task.priority}
                  </span>
                  <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.06)', color: '#94a3b8' }}>
                    {task.status}
                  </span>
                  {task.dueDate && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Due: {task.dueDate}</span>
                  )}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
                  {task.title}
                </div>
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {new Date(task.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
