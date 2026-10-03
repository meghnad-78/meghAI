import React, { useState, useEffect } from 'react';
import { GlassSurface } from './ui/GlassSurface.js';
import { Button } from './ui/Button.js';
import { Badge } from './ui/Badge.js';
import { tokens } from '../theme/tokens.js';

interface ProviderInfo {
  id: string;
  name: string;
  isConfigured: boolean;
  health: {
    isHealthy?: boolean;
    available?: boolean;
    latencyMs?: number;
    error?: string;
    message?: string;
    status?: string;
  };
}

export const ProviderCenter: React.FC = () => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [sysRes, obsRes, diagRes] = await Promise.all([
        fetch('/api/v1/system/status'),
        fetch('/api/v1/observability/stats'),
        fetch('/api/v1/providers/diagnostics').catch(() => null)
      ]);
      const sysData = await sysRes.json() as any;
      const obsData = await obsRes.json() as any;
      const diagData = diagRes ? await diagRes.json() as any : null;

      const modelList = (sysData.providers || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        isConfigured: Boolean(m.isConfigured),
        health: {
          isHealthy: Boolean(m.health?.available ?? m.health?.isHealthy),
          available: m.health?.available,
          latencyMs: m.health?.latencyMs,
          message: m.health?.message,
          status: m.health?.status
        }
      }));
      const sttList = (diagData?.sttProviders || []).map((s: any) => ({
        id: s.id,
        name: `${s.name} (STT)`,
        isConfigured: s.isConfigured,
        health: {
          isHealthy: Boolean(s.health?.available),
          available: s.health?.available,
          latencyMs: s.health?.latencyMs,
          error: s.health?.message,
          message: s.health?.message,
          status: s.health?.status
        }
      }));

      const combined = [...modelList];
      for (const stt of sttList) {
        if (!combined.some(c => c.id === stt.id)) {
          combined.push(stt);
        }
      }

      setProviders(combined);
      setMetrics(obsData.metrics || null);
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveKey = async (providerId: string) => {
    const key = apiKeyInput[providerId];
    if (!key) return;
    try {
      const cleanId = providerId.replace(/\s*\(STT\)/i, '').replace(/-scribe/i, '').replace(/-whisper/i, '');
      const res = await fetch('/api/v1/providers/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: cleanId, apiKey: key })
      });
      if (res.ok) {
        setSaveStatus(`Saved & activated key for ${providerId}.`);
        setApiKeyInput(prev => ({ ...prev, [providerId]: '' }));
        await loadData();
      } else {
        setSaveStatus(`Error saving key for ${providerId}.`);
      }
    } catch {
      setSaveStatus(`Error saving key for ${providerId}.`);
    }
    setTimeout(() => setSaveStatus(null), 3500);
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '32px 40px',
        overflowY: 'auto',
        maxWidth: '1080px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: tokens.typography.sizes.xl, fontWeight: 700, color: tokens.colors.text.primary, letterSpacing: '-0.02em' }}>
            Provider Infrastructure & Telemetry
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.secondary }}>
            Bring-Your-Own-Key (BYOK) credential management, latency health monitoring, and ₹0-first cost tracking.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={loadData}>
          ↻ Refresh
        </Button>
      </div>

      {/* ₹0-First Cost & Telemetry Dashboard */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '28px'
        }}
      >
        <GlassSurface elevation="subtle" style={{ padding: '16px 20px', borderRadius: tokens.radii.lg }}>
          <div style={{ fontSize: '11px', color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Total Tokens Consumed
          </div>
          <div style={{ fontSize: tokens.typography.sizes.xxl, fontWeight: 700, color: tokens.colors.text.primary, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
            {(metrics?.totalTokensConsumed || 0).toLocaleString()}
          </div>
        </GlassSurface>

        <GlassSurface elevation="subtle" style={{ padding: '16px 20px', borderRadius: tokens.radii.lg }}>
          <div style={{ fontSize: '11px', color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Cloud Spend (USD)
          </div>
          <div style={{ fontSize: tokens.typography.sizes.xxl, fontWeight: 700, color: tokens.colors.accent.cyan, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
            ${(metrics?.totalCostUSD || 0).toFixed(4)}
          </div>
        </GlassSurface>

        <GlassSurface elevation="subtle" style={{ padding: '16px 20px', borderRadius: tokens.radii.lg }}>
          <div style={{ fontSize: '11px', color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            Cloud Spend (INR)
          </div>
          <div style={{ fontSize: tokens.typography.sizes.xxl, fontWeight: 700, color: tokens.colors.accent.purple, marginTop: '4px', fontFamily: tokens.typography.fontMono }}>
            ₹{(metrics?.totalCostINR || 0).toFixed(2)}
          </div>
        </GlassSurface>

        <GlassSurface elevation="subtle" style={{ padding: '16px 20px', borderRadius: tokens.radii.lg }}>
          <div style={{ fontSize: '11px', color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            ₹0-First Offline Savings
          </div>
          <div style={{ fontSize: tokens.typography.sizes.xxl, fontWeight: 700, color: tokens.colors.accent.emerald, marginTop: '4px' }}>
            100% Free
          </div>
          <div style={{ fontSize: '10px', color: tokens.colors.text.muted, marginTop: '2px' }}>Local Ollama / Win32</div>
        </GlassSurface>
      </div>

      {saveStatus && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: tokens.colors.accent.emerald,
            borderRadius: tokens.radii.md,
            padding: '10px 16px',
            fontSize: tokens.typography.sizes.sm,
            marginBottom: '20px'
          }}
        >
          {saveStatus}
        </div>
      )}

      {/* Provider List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {providers.map(p => {
          const isLocal = p.id === 'local-ollama';
          const isHealthy = Boolean(p.health?.isHealthy ?? p.health?.available);
          const status = p.health?.status;

          let badgeVariant: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
          let badgeText = 'OFFLINE / UNCONFIGURED';

          if (isHealthy) {
            badgeVariant = 'success';
            badgeText = 'HEALTHY';
          } else if (status === 'AUTHENTICATION_FAILED') {
            badgeVariant = 'warning';
            badgeText = 'AUTH FAILED';
          } else if (status === 'RATE_LIMITED') {
            badgeVariant = 'warning';
            badgeText = 'RATE LIMITED';
          } else if (status === 'PROVIDER_UNREACHABLE') {
            badgeVariant = 'danger';
            badgeText = 'UNREACHABLE';
          }

          return (
            <GlassSurface
              key={p.id}
              elevation="surface"
              style={{
                padding: '16px 20px',
                borderRadius: tokens.radii.lg,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: tokens.typography.sizes.md, fontWeight: 600, color: tokens.colors.text.primary }}>
                    {p.name}
                  </span>
                  <Badge variant={badgeVariant} size="sm">{badgeText}</Badge>
                  {isLocal && (
                    <Badge variant="accent" size="sm">₹0 LOCAL FIRST</Badge>
                  )}
                  {p.health?.latencyMs ? (
                    <span style={{ fontSize: '11px', color: tokens.colors.text.muted, fontFamily: tokens.typography.fontMono }}>
                      {p.health.latencyMs}ms
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginTop: '4px' }}>
                  ID: <code style={{ color: tokens.colors.text.secondary }}>{p.id}</code> • Status: {p.isConfigured ? 'Configured & Active' : 'Requires BYOK API Key'}
                  {p.health?.message ? ` • ${p.health.message}` : ''}
                </div>
              </div>

              {!isLocal && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="password"
                    placeholder="Enter API Key (sk-...)"
                    value={apiKeyInput[p.id] || ''}
                    onChange={e => setApiKeyInput(prev => ({ ...prev, [p.id]: e.target.value }))}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${tokens.colors.border.default}`,
                      borderRadius: tokens.radii.md,
                      padding: '7px 12px',
                      color: tokens.colors.text.primary,
                      fontSize: tokens.typography.sizes.xs,
                      width: '210px',
                      outline: 'none',
                      fontFamily: tokens.typography.fontMono
                    }}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleSaveKey(p.id)}
                  >
                    Save Key
                  </Button>
                </div>
              )}
            </GlassSurface>
          );
        })}
      </div>
    </div>
  );
};
