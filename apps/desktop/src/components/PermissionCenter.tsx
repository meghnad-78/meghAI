import React, { useState, useEffect } from 'react';
import type { PermissionScope, PermissionMode, PermissionGrant } from '@meghai/shared-types';

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

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Safety & Permission Center</h2>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
          Authoritative 16-scope policy broker. Principle 3.3: User request is not unlimited permission.
        </p>
      </div>

      {/* Security Architecture Guarantees */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '20px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>HMAC IPC Auth</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Signed RPC tokens</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Path Traversal Guard</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Restricted to User Home</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Injection Defense</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>Fenced untrusted data</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#10b981', fontSize: '16px' }}>✓</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc' }}>Kill Switch Armed</div>
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>"STOP MEGH" priority</div>
          </div>
        </div>
      </div>

      {statusMsg && (
        <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', color: '#38bdf8', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '16px' }}>
          {statusMsg}
        </div>
      )}

      {/* 16 Scopes Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
        {ALL_SCOPES.map(scope => {
          const currentMode = getGrantForScope(scope);
          const isDenied = currentMode === 'DENIED';
          const isAllowed = currentMode === 'ALLOWED';

          return (
            <div
              key={scope}
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: `1px solid ${isDenied ? 'rgba(239, 68, 68, 0.3)' : isAllowed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                borderRadius: '10px',
                padding: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                  {scope}
                </div>
                <div style={{ fontSize: '11px', color: isDenied ? '#f87171' : isAllowed ? '#34d399' : '#fbbf24', marginTop: '2px', fontWeight: 600 }}>
                  Mode: {currentMode}
                </div>
              </div>
              <select
                value={currentMode}
                onChange={e => handleUpdateGrant(scope, e.target.value as PermissionMode)}
                style={{
                  background: 'rgba(7, 9, 14, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#f8fafc',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '12px'
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
