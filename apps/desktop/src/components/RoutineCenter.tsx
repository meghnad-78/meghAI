import React, { useState, useEffect } from 'react';
import type { RoutineEntry, DailyBrief } from '@meghai/shared-types';

export const RoutineCenter: React.FC = () => {
  const [routines, setRoutines] = useState<RoutineEntry[]>([]);
  const [budget, setBudget] = useState<{ interruptionsUsed: number; maxAllowed: number; isQuietHours: boolean } | null>(null);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
  const [isLoadingBrief, setIsLoadingBrief] = useState(false);
  const [execStatus, setExecStatus] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await fetch('/api/v1/routines');
      const data = await res.json() as any;
      setRoutines(data.routines || []);
      setBudget(data.budget || null);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerateBrief = async () => {
    setIsLoadingBrief(true);
    try {
      const res = await fetch('/api/v1/brief/daily');
      const data = await res.json() as DailyBrief;
      setDailyBrief(data);
    } catch (err) {
      setExecStatus(`Failed to generate brief: ${(err as Error).message}`);
    } finally {
      setIsLoadingBrief(false);
    }
  };

  const handleRunRoutine = async (id: string) => {
    try {
      const res = await fetch('/api/v1/routines/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json() as any;
      setExecStatus(`✓ ${data.message}`);
      setTimeout(() => setExecStatus(null), 3000);
      loadData();
    } catch (err) {
      setExecStatus(`Error running routine: ${(err as Error).message}`);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Daily Brief & Routines Center</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Scheduled automation, quiet hours policy, and truthful daily briefing.
          </p>
        </div>
        <button
          onClick={handleGenerateBrief}
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
          {isLoadingBrief ? 'Assembling Brief...' : '⚡ Generate Daily Brief'}
        </button>
      </div>

      {/* Proactivity Budget Card */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
            Proactivity Policy & Quiet Hours
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Quiet Hours: 22:00 – 07:00 • Max Interruptions: {budget?.maxAllowed || 3}/day
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{
            fontSize: '11px',
            padding: '4px 10px',
            borderRadius: '12px',
            background: budget?.isQuietHours ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: budget?.isQuietHours ? '#fbbf24' : '#34d399',
            fontWeight: 700
          }}>
            {budget?.isQuietHours ? '🌙 QUIET HOURS ACTIVE' : '☀️ ACTIVE WORK HOURS'}
          </span>
          <span style={{ fontSize: '12px', color: '#cbd5e1' }}>
            Budget Used: {budget?.interruptionsUsed || 0}/{budget?.maxAllowed || 3}
          </span>
        </div>
      </div>

      {execStatus && (
        <div style={{ background: 'rgba(0, 240, 255, 0.1)', border: '1px solid #00f0ff', color: '#00f0ff', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '16px' }}>
          {execStatus}
        </div>
      )}

      {/* Daily Brief Display */}
      {dailyBrief && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 8px 32px rgba(0, 240, 255, 0.08)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
              {dailyBrief.greeting}
            </span>
            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
              ✓ {dailyBrief.verificationStatus} OUTCOME
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '14px' }}>
            {/* Pending Tasks */}
            <div style={{ background: 'rgba(7, 9, 14, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                Pending Tasks ({dailyBrief.pendingTasks.length})
              </div>
              {dailyBrief.pendingTasks.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#64748b' }}>No pending tasks in queue.</div>
              ) : (
                dailyBrief.pendingTasks.map(t => (
                  <div key={t.id} style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>
                    • [{t.priority}] {t.title}
                  </div>
                ))
              )}
            </div>

            {/* Upcoming Schedule */}
            <div style={{ background: 'rgba(7, 9, 14, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#c084fc', marginBottom: '8px' }}>
                Upcoming Schedule
              </div>
              {dailyBrief.upcomingEvents.map((e, idx) => (
                <div key={idx} style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>
                  • {e.time}: {e.title}
                </div>
              ))}
            </div>

            {/* Recommended Focus */}
            <div style={{ background: 'rgba(7, 9, 14, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#34d399', marginBottom: '8px' }}>
                Recommended Action
              </div>
              {dailyBrief.recommendedActions.map((a, idx) => (
                <div key={idx} style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '4px' }}>
                  • {a}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Routines List */}
      <div style={{ fontSize: '13px', fontWeight: 700, color: '#cbd5e1', marginBottom: '12px' }}>
        Automated Routines
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {routines.map(r => (
          <div
            key={r.id}
            style={{
              background: 'rgba(15, 23, 42, 0.55)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>{r.name}</span>
                <span style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: r.triggerType === 'SCHEDULE' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: r.triggerType === 'SCHEDULE' ? '#38bdf8' : '#fbbf24',
                  fontWeight: 600
                }}>
                  {r.triggerType}
                </span>
                {r.scheduleCron && (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Cron: {r.scheduleCron}</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                {r.description}
              </div>
              {r.lastRunAt && (
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
                  Last run: {new Date(r.lastRunAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleRunRoutine(r.id)}
                style={{
                  background: 'rgba(0, 240, 255, 0.1)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  color: '#00f0ff',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                ▶ Run Routine
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
