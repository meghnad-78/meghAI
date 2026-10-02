import { describe, it, expect } from 'vitest';
import { ScreenAwarenessEngine } from '../../packages/vision/src/index';
import { PermissionBroker } from '../../packages/permissions/src/index';

describe('ScreenAwarenessEngine', () => {
  it('strictly blocks screen capture if SCREEN permission is not granted', async () => {
    const permissions = new PermissionBroker();
    // Default SCREEN mode is 'ASK' (granted = false)

    await expect(
      ScreenAwarenessEngine.analyzeScreen(permissions)
    ).rejects.toThrow(/Permission Denied: Screen awareness requires explicit 'SCREEN' permission/);
  });

  it('captures, detects errors, and proposes fixes when SCREEN permission is granted', async () => {
    const permissions = new PermissionBroker();
    permissions.grant('SCREEN', 'ALLOWED');

    const result = await ScreenAwarenessEngine.analyzeScreen(permissions, {
      activeApp: 'WindowsTerminal.exe',
      activeWindowTitle: 'PowerShell - npm test',
      mockOcrText: `TypeError: Cannot read properties of undefined (reading 'toLowerCase')
      at listVoices (packages/voice/src/index.ts:38:43)`
    });

    expect(result.captureId).toBeDefined();
    expect(result.activeApp).toBe('WindowsTerminal.exe');
    expect(result.detectedErrors.length).toBe(1);
    expect(result.detectedErrors[0].type).toBe('TypeError');
    expect(result.visualExplanation).toContain('TypeError');
    expect(result.proposedFix).toContain('optional chaining');
    expect(result.isEphemeral).toBe(true);
  });
});
