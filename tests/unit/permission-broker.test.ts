import { describe, it, expect } from 'vitest';
import { PermissionBroker } from '../../packages/permissions/src/index.js';

describe('Authoritative Permission Broker', () => {
  it('denies camera access by default', () => {
    const broker = new PermissionBroker();
    const result = broker.evaluate('CAMERA');
    expect(result.granted).toBe(false);
    expect(result.reason).toContain('DENIED');
  });

  it('allows microphone in LOCAL_ONLY mode', () => {
    const broker = new PermissionBroker();
    const result = broker.evaluate('MICROPHONE');
    expect(result.granted).toBe(true);
  });

  it('enforces permitted roots for FILESYSTEM scope', () => {
    const broker = new PermissionBroker(['C:\\Users\\User\\Documents']);
    const allowedResult = broker.evaluate('FILESYSTEM', 'C:\\Users\\User\\Documents\\Project\\file.txt');
    expect(allowedResult.granted).toBe(true);

    const deniedResult = broker.evaluate('FILESYSTEM', 'C:\\Windows\\System32\\cmd.exe');
    expect(deniedResult.granted).toBe(false);
    expect(deniedResult.reason).toContain('outside configured permitted folders');
  });

  it('allows updating and revoking permission grants', () => {
    const broker = new PermissionBroker();
    broker.grant('CAMERA', 'ALLOWED');
    expect(broker.evaluate('CAMERA').granted).toBe(true);

    broker.revoke('CAMERA');
    expect(broker.evaluate('CAMERA').granted).toBe(false);
  });
});
