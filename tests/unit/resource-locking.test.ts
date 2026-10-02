import { describe, it, expect } from 'vitest';
import { ResourceLockManager } from '@meghai/tool-runtime';

describe('ResourceLockManager (Phase 1.16)', () => {
  it('manages scoped leases and prevents agent conflicts over system resources', () => {
    const lockManager = new ResourceLockManager();

    // 1. Agent A acquires screen lock
    const resA = lockManager.acquireLease('SCREEN', 'primary_monitor', 'VisionAgent', 5000);
    expect(resA.success).toBe(true);
    expect(resA.lease?.holderAgent).toBe('VisionAgent');
    expect(lockManager.isLocked('primary_monitor')).toBe(true);

    // 2. Agent B attempts to acquire same screen lock -> must be rejected
    const resB = lockManager.acquireLease('SCREEN', 'primary_monitor', 'BrowserAgent', 5000);
    expect(resB.success).toBe(false);
    expect(resB.holder).toBe('VisionAgent');
    expect(resB.reason).toContain("held by agent 'VisionAgent'");

    // 3. Agent A re-enters lock -> allowed extension
    const resAReenter = lockManager.acquireLease('SCREEN', 'primary_monitor', 'VisionAgent', 10000);
    expect(resAReenter.success).toBe(true);

    // 4. Agent B tries to release Agent A's lock -> denied
    const releaseByB = lockManager.releaseLease('SCREEN', 'primary_monitor', 'BrowserAgent');
    expect(releaseByB).toBe(false);
    expect(lockManager.isLocked('primary_monitor')).toBe(true);

    // 5. Agent A releases lock
    const releaseByA = lockManager.releaseLease('SCREEN', 'primary_monitor', 'VisionAgent');
    expect(releaseByA).toBe(true);
    expect(lockManager.isLocked('primary_monitor')).toBe(false);

    // 6. Now Agent B can acquire
    const resBAfter = lockManager.acquireLease('SCREEN', 'primary_monitor', 'BrowserAgent', 5000);
    expect(resBAfter.success).toBe(true);
    expect(resBAfter.lease?.holderAgent).toBe('BrowserAgent');
  });

  it('coordinates multi-resource locking across files and browser profiles', () => {
    const lockManager = new ResourceLockManager();

    const fileLock = lockManager.acquireLease('FILE', 'C:\\config.json', 'CodingAgent', 20000);
    const browserLock = lockManager.acquireLease('BROWSER_PROFILE', 'user_default', 'BrowserAgent', 20000);

    expect(fileLock.success).toBe(true);
    expect(browserLock.success).toBe(true);

    const activeLocks = lockManager.listActiveLocks();
    expect(activeLocks.length).toBe(2);
  });
});
