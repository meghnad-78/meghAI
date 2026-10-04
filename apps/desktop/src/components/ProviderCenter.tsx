import React, { useState, useEffect } from 'react';
import { GlassSurface } from './ui/GlassSurface.js';
import { Button } from './ui/Button.js';
import { Badge } from './ui/Badge.js';
import { tokens } from '../theme/tokens.js';
import { Icons } from './ui/Icons.js';

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
        setSaveStatus(`Saved & activated credentials for ${providerId}.`);
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
        maxWidth: '1100px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: `1px solid ${tokens.colors.border.subtle}`,
          paddingBottom: '20px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: tokens.colors.accent.primary, display: 'flex', alignItems: 'center' }}>
              <Icons.Model size={22} />
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
              Provider Infrastructure & BYOK Telemetry
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: tokens.typography.sizes.sm, color: tokens.colors.text.secondary }}>
            Bring-Your-Own-Key (BYOK) credential management, latency health monitoring, and ₹0-first cost tracking.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={loadData}>
          Refresh Diagnostics
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
        <GlassSurface elevation="subtle" style={{ padding: '16px 20px', borderRadius: tokens.radii.md }}>
          <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
            Total Tokens Consumed
          </div>
          <div style={{ fontSize: tokens.typography.sizes.xl, fontWeight: 600, color: tokens.colors.text.primary, marginTop: '6px', fontFamily: tokens.typography.fontMono }}>
            {(metrics?.totalTokensConsumed || 0).toLocaleString()}
          </div>
          <div style={{ fontSize: '11px', color: tokens.colors.text.faint, marginTop: '2px' }}>
            Cumulative inference tokens
          </div>
        </GlassSurface>

        <GlassSurface elevation="subtle" style={{ padding: '16px 20px', borderRadius: tokens.radii.md }}>
          <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
            Cloud Spend (USD)
          </div>
          <div style={{ fontSize: tokens.typography.sizes.xl, fontWeight: 600, color: tokens.colors.accent.primary, marginTop: '6px', fontFamily: tokens.typography.fontMono }}>
            ${(metrics?.totalCostUSD || 0).toFixed(4)}
          </div>
          <div style={{ fontSize: '11px', color: tokens.colors.text.faint, marginTop: '2px' }}>
            Direct provider billing
          </div>
        </GlassSurface>

        <GlassSurface elevation="subtle" style={{ padding: '16px 20px', borderRadius: tokens.radii.md }}>
          <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
            Cloud Spend (INR)
          </div>
          <div style={{ fontSize: tokens.typography.sizes.xl, fontWeight: 600, color: tokens.colors.semantic.info, marginTop: '6px', fontFamily: tokens.typography.fontMono }}>
            ₹{(metrics?.totalCostINR || 0).toFixed(2)}
          </div>
          <div style={{ fontSize: '11px', color: tokens.colors.text.faint, marginTop: '2px' }}>
            Normalized exchange rate
          </div>
        </GlassSurface>

        <GlassSurface elevation="subtle" style={{ padding: '16px 20px', borderRadius: tokens.radii.md }}>
          <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.wide }}>
            ₹0-First Offline Savings
          </div>
          <div style={{ fontSize: tokens.typography.sizes.xl, fontWeight: 600, color: tokens.colors.semantic.success, marginTop: '6px', fontFamily: tokens.typography.fontMono }}>
            100% Free
          </div>
          <div style={{ fontSize: '11px', color: tokens.colors.text.faint, marginTop: '2px' }}>
            Local Ollama + Windows OneCore
          </div>
        </GlassSurface>
      </div>

      {saveStatus && (
        <div
          style={{
            background: tokens.colors.semantic.successMuted,
            border: `1px solid ${tokens.colors.semantic.success}`,
            color: tokens.colors.semantic.success,
            borderRadius: tokens.radii.sm,
            padding: '10px 16px',
            fontSize: tokens.typography.sizes.sm,
            marginBottom: '20px',
            fontFamily: tokens.typography.fontMono
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
          let badgeText = 'UNCONFIGURED';

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
                borderRadius: tokens.radii.md,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: tokens.typography.sizes.sm, fontWeight: 600, color: tokens.colors.text.primary }}>
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
                  ID: <code style={{ color: tokens.colors.text.secondary, fontFamily: tokens.typography.fontMono }}>{p.id}</code> • Status: {p.isConfigured ? 'Active & Configured' : 'Requires API Key'}
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
                      background: tokens.colors.bg.subtle,
                      border: `1px solid ${tokens.colors.border.default}`,
                      borderRadius: tokens.radii.sm,
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
