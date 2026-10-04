import React, { useState, useEffect } from 'react';
import type { PermissionScope, PermissionMode, PermissionGrant } from '@meghai/shared-types';
import { tokens } from '../theme/tokens.js';
import { Icons } from './ui/Icons.js';

const ALL_SCOPES: PermissionScope[] = [
  'MICROPHONE',
  'CAMERA',
  'SCREEN',
  'FILESYSTEM',
  'BROWSER',
  'APPLICATIONS',
  'CLIPBOARD',
  'POWERSHELL',
  'CMD',
  'EMAIL',
  'CALENDAR',
  'MESSAGING',
  'CONTACTS',
  'NOTIFICATIONS',
  'CLOUD_PROVIDERS',
  'KNOWLEDGE_SOURCES'
];

export const PermissionCenter: React.FC = () => {
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadGrants = async () => {
    try {
      const res = await fetch('/api/v1/permissions');
      const data = await res.json();
      setGrants(data || []);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadGrants();
  }, []);

  const handleUpdateGrant = async (scope: PermissionScope, mode: PermissionMode) => {
    try {
      await fetch('/api/v1/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, mode })
      });
      setStatusMsg(`Updated '${scope}' policy to '${mode}'.`);
      setTimeout(() => setStatusMsg(null), 3000);
      loadGrants();
    } catch (err) {
      setStatusMsg(`Failed to update grant: ${(err as Error).message}`);
    }
  };

  const getGrantForScope = (scope: PermissionScope): PermissionMode => {
    const found = grants.find(g => g.scope === scope);
    return found ? found.mode : 'ASK';
  };

  const getModeColor = (mode: PermissionMode) => {
    switch (mode) {
      case 'DENIED':
        return tokens.colors.semantic.error;
      case 'ALLOWED':
        return tokens.colors.semantic.success;
      case 'ALLOWED_WITH_CONFIRMATION':
      case 'ASK':
        return tokens.colors.semantic.warning;
      case 'LOCAL_ONLY':
        return tokens.colors.accent.primary;
      default:
        return tokens.colors.text.muted;
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
          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
          paddingBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: tokens.colors.accent.primary, display: 'flex', alignItems: 'center' }}>
            <Icons.Security size={22} />
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
            Permission Broker & Safety Governance
          </h2>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.secondary }}>
          Authoritative 16-scope policy broker. Principle 3.3: User request is not unlimited permission.
        </p>
      </div>

      {/* Security Architecture Guarantees */}
      <div
        style={{
          background: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.radii.md,
          padding: '16px',
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: tokens.colors.semantic.success, display: 'flex', alignItems: 'center' }}>
            <Icons.Check size={16} />
          </span>
          <div>
            <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.primary }}>
              HMAC IPC Auth
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.muted }}>
              Signed RPC tokens
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: tokens.colors.semantic.success, display: 'flex', alignItems: 'center' }}>
            <Icons.Check size={16} />
          </span>
          <div>
            <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.primary }}>
              Path Traversal Guard
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.muted }}>
              Restricted user sandbox
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: tokens.colors.semantic.success, display: 'flex', alignItems: 'center' }}>
            <Icons.Check size={16} />
          </span>
          <div>
            <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.primary }}>
              Prompt Injection Defense
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.muted }}>
              Fenced external payloads
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ color: tokens.colors.semantic.success, display: 'flex', alignItems: 'center' }}>
            <Icons.Check size={16} />
          </span>
          <div>
            <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.primary }}>
              Kill Switch Armed
            </div>
            <div style={{ fontSize: '11px', color: tokens.colors.text.muted }}>
              "STOP MEGH" priority
            </div>
          </div>
        </div>
      </div>

      {statusMsg && (
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
          {statusMsg}
        </div>
      )}

      {/* 16 Scopes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '10px' }}>
        {ALL_SCOPES.map(scope => {
          const currentMode = getGrantForScope(scope);
          const color = getModeColor(currentMode);

          return (
            <div
              key={scope}
              style={{
                background: tokens.colors.bg.surface,
                border: `1px solid ${tokens.colors.border.subtle}`,
                borderRadius: tokens.radii.sm,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: tokens.typography.sizes.xs, fontWeight: 600, color: tokens.colors.text.primary, fontFamily: tokens.typography.fontMono }}>
                  {scope}
                </div>
                <div style={{ fontSize: '11px', color, marginTop: '2px', fontWeight: 600, fontFamily: tokens.typography.fontMono }}>
                  POLICY: {currentMode}
                </div>
              </div>
              <select
                value={currentMode}
                onChange={e => handleUpdateGrant(scope, e.target.value as PermissionMode)}
                style={{
                  background: tokens.colors.bg.subtle,
                  border: `1px solid ${tokens.colors.border.default}`,
                  color: tokens.colors.text.primary,
                  borderRadius: tokens.radii.xs,
                  padding: '5px 8px',
                  fontSize: tokens.typography.sizes.xs,
                  fontFamily: tokens.typography.fontMono
                }}
              >
                <option value="ALLOWED">ALLOWED</option>
                <option value="ASK">ASK (Prompt User)</option>
                <option value="ALLOWED_WITH_CONFIRMATION">CONFIRMATION</option>
                <option value="LOCAL_ONLY">LOCAL_ONLY</option>
                <option value="DENIED">DENIED (Blocked)</option>
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};
