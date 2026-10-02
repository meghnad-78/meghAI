import { describe, it, expect } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { VerificationEngine } from '../../packages/verification/src/index.js';

describe('Verification Engine & No False Success Guarantee (Section 62 & 147)', () => {
  it('cryptographically verifies file write by inspecting file existence and SHA-256 hash', async () => {
    const testFile = path.join(os.tmpdir(), `meghai_test_verify_${Date.now()}.txt`);
    const content = 'MeghAI Verified Outcome Test Content';
    await fs.writeFile(testFile, content, 'utf-8');

    const result = await VerificationEngine.verifyFileWrite(testFile, content);
    expect(result.status).toBe('VERIFIED');
    expect(result.proof).toContain('sha256:');

    await fs.unlink(testFile);
  });

  it('fails verification if file content does not match expected output (No False Success)', async () => {
    const testFile = path.join(os.tmpdir(), `meghai_test_mismatch_${Date.now()}.txt`);
    await fs.writeFile(testFile, 'Corrupted data', 'utf-8');

    const result = await VerificationEngine.verifyFileWrite(testFile, 'Expected clean data');
    expect(result.status).toBe('FAILED');
    expect(result.details).toContain('content does not match expected output');

    await fs.unlink(testFile);
  });

  it('fails verification if target file does not exist', async () => {
    const nonExistent = path.join(os.tmpdir(), `meghai_ghost_${Date.now()}.txt`);
    const result = await VerificationEngine.verifyFileWrite(nonExistent);
    expect(result.status).toBe('FAILED');
  });

  it('marks unverified when API does not provide an authoritative confirmation receipt', () => {
    const result = VerificationEngine.verifyApiConfirmation('ExternalService', { status: 'sent_maybe' });
    expect(result.status).toBe('UNVERIFIED');
  });

  it('verifies API confirmation when message ID receipt is present', () => {
    const result = VerificationEngine.verifyApiConfirmation('EmailProvider', { id: 'msg_9847293' });
    expect(result.status).toBe('VERIFIED');
    expect(result.proof).toBe('EmailProvider:msg_9847293');
  });
});
