import { describe, it, expect } from 'vitest';
import {
  DailyBriefService,
  RoutineEngine,
  ProactivityBudget,
  IntentEngine
} from '@meghai/ai-core';
import type { TaskEntry } from '@meghai/shared-types';

describe('Proactivity & Routines Engine (Section 94, 95)', () => {
  it('should generate a truthful, verified Daily Brief from task store and system metrics', () => {
    const mockTasks: TaskEntry[] = [
      {
        id: 't-1',
        userId: 'usr-1',
        title: 'Review pull request for MeghAI UI',
        status: 'RUNNING',
        priority: 'HIGH',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 't-2',
        userId: 'usr-1',
        title: 'Draft architecture RFC for voice model',
        status: 'QUEUED',
        priority: 'MEDIUM',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 't-3',
        userId: 'usr-1',
        title: 'Completed setup task',
        status: 'COMPLETED',
        priority: 'LOW',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const brief = DailyBriefService.generateBrief(
      mockTasks,
      { status: 'HEALTHY', details: 'All systems operational, CPU 4 cores, Memory 16GB' },
      'Meghnad'
    );

    expect(brief.greeting).toContain('Meghnad');
    expect(brief.pendingTasks.length).toBe(2);
    expect(brief.verificationStatus).toBe('VERIFIED');
    expect(brief.recommendedActions.length).toBeGreaterThan(0);
    expect(brief.recommendedActions[0]).toContain('critical tasks');
    expect(brief.systemHealth.status).toBe('HEALTHY');
    expect(brief.upcomingEvents.length).toBeGreaterThan(0);
  });

  it('should enforce quiet hours and daily interruption budget in ProactivityBudget', () => {
    // Quiet hours between 22:00 and 07:00
    const budget = new ProactivityBudget(22, 7, 2);

    // 1. Check afternoon at 14:00 (within active hours)
    const afternoon = new Date('2026-10-02T14:00:00');
    const afternoonCheck = budget.checkBudget(afternoon);
    expect(afternoonCheck.allowed).toBe(true);

    // 2. Consume interruptions up to limit (2)
    budget.recordInterruption();
    budget.recordInterruption();

    const limitCheck = budget.checkBudget(afternoon);
    expect(limitCheck.allowed).toBe(false);
    expect(limitCheck.reason).toContain('Daily proactive interruption limit');

    // 3. Test late night at 23:30 (Quiet Hours)
    const lateNight = new Date('2026-10-02T23:30:00');
    const quietCheck = budget.checkBudget(lateNight);
    expect(quietCheck.allowed).toBe(false);
    expect(quietCheck.reason).toContain('Quiet hours active');
  });

  it('should list, toggle, and execute recurring automation routines', () => {
    const routineEngine = new RoutineEngine();
    const routines = routineEngine.listRoutines();

    expect(routines.length).toBeGreaterThanOrEqual(3);
    const morningKickoff = routineEngine.getRoutine('morning-kickoff');
    expect(morningKickoff).toBeDefined();
    expect(morningKickoff?.isEnabled).toBe(true);

    // Toggle routine
    routineEngine.toggleRoutine('morning-kickoff', false);
    expect(routineEngine.getRoutine('morning-kickoff')?.isEnabled).toBe(false);

    // Execute routine
    const execResult = routineEngine.executeRoutine('focus-mode');
    expect(execResult.success).toBe(true);
    expect(execResult.routine.lastRunAt).toBeDefined();
  });

  it('should classify routine and daily brief requests as ROUTINE_OPERATION intent', () => {
    const input1 = IntentEngine.classify('Megh, give me my daily brief');
    expect(input1.primaryIntent).toBe('ROUTINE_OPERATION');

    const input2 = IntentEngine.classify('Hey Megh, aaj ka update aur morning briefing do');
    expect(input2.primaryIntent).toBe('ROUTINE_OPERATION');
  });
});
