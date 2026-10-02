import { describe, it, expect, beforeEach } from 'vitest';
import { KillSwitch } from '../../packages/security/src/index.js';

describe('Emergency Kill Switch ("STOP MEGH") (Section 55)', () => {
  beforeEach(() => {
    KillSwitch.reset();
  });

  it('aborts active task abort controllers immediately', () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);

    KillSwitch.registerAbortController(controller);
    expect(KillSwitch.isActive()).toBe(false);

    const outcome = KillSwitch.stopMegh('Emergency Test');
    expect(KillSwitch.isActive()).toBe(true);
    expect(controller.signal.aborted).toBe(true);
    expect(outcome.cancelledControllers).toBe(1);
  });

  it('terminates registered child processes', () => {
    let processKilled = false;
    KillSwitch.registerProcess({
      pid: 1234,
      kill: () => {
        processKilled = true;
      }
    });

    const outcome = KillSwitch.stopMegh('Testing Process Termination');
    expect(processKilled).toBe(true);
    expect(outcome.killedProcesses).toBe(1);
  });

  it('allows system reset back to operational state', () => {
    KillSwitch.stopMegh();
    expect(KillSwitch.isActive()).toBe(true);

    KillSwitch.reset();
    expect(KillSwitch.isActive()).toBe(false);
  });
});
