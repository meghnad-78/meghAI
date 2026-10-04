import React, { useState, useEffect } from 'react';
import type { RoutineEntry, DailyBrief } from '@meghai/shared-types';
import { tokens } from '../theme/tokens.js';
import { Icons } from './ui/Icons.js';

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
      setExecStatus(data.message || 'Routine executed');
      setTimeout(() => setExecStatus(null), 3000);
      loadData();
    } catch (err) {
      setExecStatus(`Error running routine: ${(err as Error).message}`);
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
              <Icons.Routine size={22} />
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
              Routines & Proactive Intelligence
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.secondary }}>
            Scheduled proactive routines, quiet hours policy governance, and daily synthesized briefings.
          </p>
        </div>
        <button
          onClick={handleGenerateBrief}
          disabled={isLoadingBrief}
          style={{
            background: tokens.colors.accent.primary,
            border: 'none',
            borderRadius: tokens.radii.sm,
            padding: '8px 16px',
            color: tokens.colors.bg.canvas,
            fontWeight: 600,
            fontSize: tokens.typography.sizes.xs,
            cursor: isLoadingBrief ? 'not-allowed' : 'pointer',
            fontFamily: tokens.typography.fontMono
          }}
        >
          {isLoadingBrief ? 'ASSEMBLING BRIEF...' : 'GENERATE DAILY BRIEF'}
        </button>
      </div>

      {/* Proactivity Budget Card */}
      <div
        style={{
          background: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.radii.md,
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <div style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
            Proactivity Governance & Interruption Budget
          </div>
          <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginTop: '2px' }}>
            Quiet Hours: 22:00 - 07:00 • Maximum Allowed Interruptions: {budget?.maxAllowed || 3}/day
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span
            style={{
              fontSize: tokens.typography.sizes.xs,
              padding: '3px 10px',
              borderRadius: tokens.radii.xs,
              background: budget?.isQuietHours ? tokens.colors.semantic.warningMuted : tokens.colors.semantic.successMuted,
              color: budget?.isQuietHours ? tokens.colors.semantic.warning : tokens.colors.semantic.success,
              border: `1px solid ${budget?.isQuietHours ? tokens.colors.semantic.warning : tokens.colors.semantic.success}`,
              fontFamily: tokens.typography.fontMono,
              fontWeight: 600
            }}
          >
            {budget?.isQuietHours ? 'QUIET HOURS ACTIVE' : 'ACTIVE WORK HOURS'}
          </span>
          <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, fontFamily: tokens.typography.fontMono }}>
            Budget Used: {budget?.interruptionsUsed || 0}/{budget?.maxAllowed || 3}
          </span>
        </div>
      </div>

      {execStatus && (
        <div
          style={{
            background: tokens.colors.accent.primarySubtle,
            border: `1px solid ${tokens.colors.accent.primary}`,
            color: tokens.colors.accent.primary,
            borderRadius: tokens.radii.sm,
            padding: '8px 14px',
            fontSize: tokens.typography.sizes.xs,
            marginBottom: '16px',
            fontFamily: tokens.typography.fontMono
          }}
        >
          {execStatus}
        </div>
      )}

      {/* Daily Brief Display */}
      {dailyBrief && (
        <div
          style={{
            background: tokens.colors.bg.elevated,
            border: `1px solid ${tokens.colors.border.strong}`,
            borderRadius: tokens.radii.md,
            padding: '20px',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={{ fontSize: tokens.typography.sizes.md, fontWeight: 600, color: tokens.colors.text.primary, fontFamily: tokens.typography.fontDisplay }}>
              {dailyBrief.greeting}
            </span>
            <span
              style={{
                fontSize: '11px',
                background: tokens.colors.semantic.successMuted,
                color: tokens.colors.semantic.success,
                padding: '2px 8px',
                borderRadius: tokens.radii.xs,
                fontWeight: 600,
                fontFamily: tokens.typography.fontMono
              }}
            >
              {dailyBrief.verificationStatus} OUTCOME
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {/* Pending Tasks */}
            <div style={{ background: tokens.colors.bg.surface, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radii.sm, padding: '14px' }}>
              <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.accent.primary, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
                Pending Tasks ({dailyBrief.pendingTasks.length})
              </div>
              {dailyBrief.pendingTasks.length === 0 ? (
                <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted }}>No pending tasks in queue.</div>
              ) : (
                dailyBrief.pendingTasks.map(t => (
                  <div key={t.id} style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, marginBottom: '4px' }}>
                    • [{t.priority}] {t.title}
                  </div>
                ))
              )}
            </div>

            {/* Upcoming Schedule */}
            <div style={{ background: tokens.colors.bg.surface, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radii.sm, padding: '14px' }}>
              <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.semantic.info, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
                Upcoming Schedule
              </div>
              {dailyBrief.upcomingEvents.map((e, idx) => (
                <div key={idx} style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, marginBottom: '4px' }}>
                  • {e.time}: {e.title}
                </div>
              ))}
            </div>

            {/* Recommended Focus */}
            <div style={{ background: tokens.colors.bg.surface, border: `1px solid ${tokens.colors.border.subtle}`, borderRadius: tokens.radii.sm, padding: '14px' }}>
              <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.semantic.success, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
                Recommended Action
              </div>
              {dailyBrief.recommendedActions.map((a, idx) => (
                <div key={idx} style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.secondary, marginBottom: '4px' }}>
                  • {a}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Routines List */}
      <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.muted, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
        Automated Routines
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {routines.map(r => (
          <div
            key={r.id}
            style={{
              background: tokens.colors.bg.surface,
              border: `1px solid ${tokens.colors.border.subtle}`,
              borderRadius: tokens.radii.md,
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
                  {r.name}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: tokens.radii.xs,
                    background: tokens.colors.bg.subtle,
                    color: r.triggerType === 'SCHEDULE' ? tokens.colors.accent.primary : tokens.colors.semantic.warning,
                    fontWeight: 600,
                    fontFamily: tokens.typography.fontMono
                  }}
                >
                  {r.triggerType}
                </span>
                {r.scheduleCron && (
                  <span style={{ fontSize: '11px', color: tokens.colors.text.muted, fontFamily: tokens.typography.fontMono }}>
                    Cron: {r.scheduleCron}
                  </span>
                )}
              </div>
              <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginTop: '4px' }}>
                {r.description}
              </div>
              {r.lastRunAt && (
                <div style={{ fontSize: '10px', color: tokens.colors.text.faint, marginTop: '3px', fontFamily: tokens.typography.fontMono }}>
                  Last executed: {new Date(r.lastRunAt).toLocaleTimeString()}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleRunRoutine(r.id)}
                style={{
                  background: tokens.colors.bg.subtle,
                  border: `1px solid ${tokens.colors.border.default}`,
                  color: tokens.colors.accent.primary,
                  borderRadius: tokens.radii.xs,
                  padding: '6px 14px',
                  fontSize: tokens.typography.sizes.xs,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: tokens.typography.fontMono
                }}
              >
                <Icons.Play size={11} />
                RUN NOW
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
