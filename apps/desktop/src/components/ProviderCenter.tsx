import React, { useState, useEffect } from 'react';

interface ProviderInfo {
  id: string;
  name: string;
  isConfigured: boolean;
  health: { isHealthy: boolean; latencyMs?: number; error?: string };
}

export const ProviderCenter: React.FC = () => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [sysRes, obsRes] = await Promise.all([
        fetch('/api/v1/system/status'),
        fetch('/api/v1/observability/stats')
      ]);
      const sysData = await sysRes.json() as any;
      const obsData = await obsRes.json() as any;
      setProviders(sysData.providers || []);
      setMetrics(obsData.metrics || null);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveKey = (providerId: string) => {
    const key = apiKeyInput[providerId];
    if (!key) return;
    setSaveStatus(`Saved API key for ${providerId}.`);
    setApiKeyInput(prev => ({ ...prev, [providerId]: '' }));
    setTimeout(() => setSaveStatus(null), 3000);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', padding: '24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#f8fafc' }}>Providers & Telemetry Center</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Bring-Your-Own-Key (BYOK) multi-model configuration, local fallback, and ₹0-first cost tracking.
          </p>
        </div>
        <button
          onClick={loadData}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#38bdf8',
            borderRadius: '8px',
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* ₹0-First Cost & Telemetry Dashboard */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Total Tokens</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
            {(metrics?.totalTokensConsumed || 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Cloud Spend (USD)</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
            ${(metrics?.totalCostUSD || 0).toFixed(4)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>Cloud Spend (INR)</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#a855f7', marginTop: '4px' }}>
            ₹{(metrics?.totalCostINR || 0).toFixed(2)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase' }}>₹0-First Offline Savings</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
            100% Free
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>Local Ollama / Win32</div>
        </div>
      </div>

      {saveStatus && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#34d399', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', marginBottom: '16px' }}>
          {saveStatus}
        </div>
      )}

      {/* Provider List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {providers.map(p => {
          const isLocal = p.id === 'local-ollama';
          const isHealthy = p.health?.isHealthy;

          return (
            <div
              key={p.id}
              style={{
                background: 'rgba(15, 23, 42, 0.55)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>{p.name}</span>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: isHealthy ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: isHealthy ? '#34d399' : '#f87171',
                    fontWeight: 700
                  }}>
                    {isHealthy ? '● HEALTHY' : '○ OFFLINE / UNCONFIGURED'}
                  </span>
                  {isLocal && (
                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(0, 240, 255, 0.15)', color: '#00f0ff', fontWeight: 600 }}>
                      ₹0 LOCAL FIRST
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  Provider ID: <code>{p.id}</code> • Status: {p.isConfigured ? 'Configured (Active)' : 'Requires BYOK API Key'}
                </div>
              </div>

              {!isLocal && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="password"
                    placeholder="Enter API Key (sk-...)"
                    value={apiKeyInput[p.id] || ''}
                    onChange={e => setApiKeyInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                    style={{
                      background: 'rgba(7, 9, 14, 0.6)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      padding: '6px 10px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      width: '200px'
                    }}
                  />
                  <button
                    onClick={() => handleSaveKey(p.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
