import { describe, it, expect } from 'vitest';
import { RiskEngine } from '../../packages/risk-engine/src/index.js';

describe('Risk Engine & Action Previews', () => {
  it('classifies read-only queries as LOW risk', () => {
    const assessment = RiskEngine.assess('note_list', {}, 'NOTES', 'LOW');
    expect(assessment.level).toBe('LOW');
    expect(assessment.requiresConfirmation).toBe(false);
    expect(assessment.isDestructive).toBe(false);
  });

  it('classifies destructive file deletion as HIGH risk requiring confirmation', () => {
    const assessment = RiskEngine.assess('file_delete', { path: 'C:\\Users\\User\\Documents\\old.txt' }, 'FILES', 'MEDIUM');
    expect(assessment.level).toBe('HIGH');
    expect(assessment.requiresConfirmation).toBe(true);
    expect(assessment.isDestructive).toBe(true);
  });

  it('detects critical system modification commands in PowerShell', () => {
    const assessment = RiskEngine.assess('powershell_exec', { command: 'del /s /q C:\\data' }, 'SYSTEM', 'LOW');
    expect(assessment.level).toBe('CRITICAL');
    expect(assessment.requiresConfirmation).toBe(true);
    expect(assessment.isDestructive).toBe(true);
  });

  it('elevates external message sending to HIGH risk requiring confirmation', () => {
    const assessment = RiskEngine.assess('email_send', { to: 'boss@company.com', body: 'Report' }, 'EMAIL', 'LOW');
    expect(assessment.level).toBe('HIGH');
    expect(assessment.requiresConfirmation).toBe(true);
    expect(assessment.isExternalCommunication).toBe(true);
  });

  it('generates clear Action Preview cards for confirmation-required actions', () => {
    const assessment = RiskEngine.assess('email_send', { to: 'client@domain.com', message: 'Hello' }, 'EMAIL', 'HIGH');
    const preview = RiskEngine.generateActionPreview('email_send', { to: 'client@domain.com' }, assessment);
    expect(preview.title).toContain('Confirm Action: email_send');
    expect(preview.targetDescription).toBe('client@domain.com');
    expect(preview.requiresExplicitConfirmation).toBe(true);
  });
});
