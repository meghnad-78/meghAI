import React, { useEffect, useState } from 'react';
import { GlassSurface } from './ui/GlassSurface.js';
import { Button } from './ui/Button.js';
import { Badge } from './ui/Badge.js';
import { tokens } from '../theme/tokens.js';

export interface ModelProviderInfo {
  id: string;
  name: string;
  isConfigured: boolean;
  health: {
    available: boolean;
    latencyMs: number;
    status?: string;
    message?: string;
  };
  modelCount?: number;
  defaultModel?: string;
}

interface ModelSelectorModalProps {
  isOpen: boolean;
  selectedProvider: string;
  onSelectProvider: (providerId: string, modelId?: string) => void;
  onClose: () => void;
  onOpenProviderCenter?: () => void;
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  selectedProvider,
  onSelectProvider,
  onClose,
  onOpenProviderCenter
}) => {
  const [providers, setProviders] = useState<ModelProviderInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch('/api/v1/system/status')
      .then(res => res.json())
      .then(data => {
        if (data.providers) {
          setProviders(data.providers);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const standardProviders = [
    {
      id: 'auto',
      name: 'Auto-Routing (ModelRouter)',
      description: 'Dynamic capability matching across latency, reasoning, tools & failover',
      badge: 'RECOMMENDED',
      isConfigured: true,
      available: true
    },
    {
      id: 'gemini',
      name: 'Google Gemini',
      description: 'Gemini 3.8 Flash — Multimodal, fast, 1M context window',
      modelId: 'gemini-3.8-flash'
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'GPT-4o Mini / GPT-4o — Reasoning & tool calling',
      modelId: 'gpt-4o-mini'
    },
    {
      id: 'local-ollama',
      name: 'Local Ollama',
      description: 'Llama 3.2 — 100% offline, private, zero cost ($0 / ₹0)',
      modelId: 'llama3.2:latest'
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Claude 3.5 Sonnet / Haiku — High nuance & code generation',
      modelId: 'claude-3-5-sonnet'
    },
    {
      id: 'deepseek',
      name: 'DeepSeek',
      description: 'DeepSeek-V3 / R1 — Deep multi-step technical reasoning',
      modelId: 'deepseek-chat'
    },
    {
      id: 'perplexity',
      name: 'Perplexity',
      description: 'Sonar Online — Web search citations & real-time grounding',
      modelId: 'sonar'
    }
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: tokens.zIndex.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(4, 6, 10, 0.78)',
        backdropFilter: 'blur(16px)',
        padding: '24px'
      }}
      onClick={onClose}
    >
      <GlassSurface
        elevation="floating"
        style={{
          width: '100%',
          maxWidth: '540px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: tokens.radii.xl
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: tokens.typography.sizes.lg, fontWeight: 700, color: tokens.colors.text.primary }}>
                Active Intelligence Model
              </span>
              {loading && (
                <span style={{ fontSize: '11px', color: tokens.colors.accent.cyan }}>● Checking...</span>
              )}
            </div>
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginTop: '2px' }}>
              Select dedicated provider or let MeghAI orchestrate automatically
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.colors.text.muted,
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: tokens.radii.sm
            }}
          >
            ✕
          </button>
        </div>

        {/* Provider List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {standardProviders.map(p => {
            const isSelected = selectedProvider === p.id;
            const liveInfo = providers.find(item => item.id === p.id);
            const isAuto = p.id === 'auto';
            const isOllama = p.id === 'local-ollama';
            const isConfigured = isAuto || isOllama ? true : (liveInfo ? liveInfo.isConfigured : false);
            const isHealthy = isAuto ? true : (liveInfo?.health?.available ?? (isOllama ? true : false));

            return (
              <div
                key={p.id}
                onClick={() => {
                  onSelectProvider(p.id, p.modelId);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: tokens.radii.md,
                  border: `1px solid ${isSelected ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                  background: isSelected
                    ? 'rgba(0, 240, 255, 0.08)'
                    : isConfigured
                    ? 'rgba(255, 255, 255, 0.02)'
                    : 'rgba(255, 255, 255, 0.005)',
                  cursor: isAuto || isConfigured ? 'pointer' : 'default',
                  opacity: isAuto || isConfigured ? 1 : 0.5,
                  transition: tokens.transitions.fast
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: tokens.typography.sizes.sm, color: isSelected ? tokens.colors.accent.cyan : tokens.colors.text.primary }}>
                      {p.name}
                    </span>
                    {isSelected && (
                      <Badge variant="accent" size="sm">ACTIVE</Badge>
                    )}
                    {p.badge && (
                      <Badge variant="purple" size="sm">{p.badge}</Badge>
                    )}
                  </div>
                  <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted }}>
                    {p.description}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isAuto ? (
                    <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.accent.cyan, fontWeight: 500 }}>
                      Dynamic
                    </span>
                  ) : isConfigured ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isHealthy ? tokens.colors.accent.emerald : tokens.colors.accent.amber
                        }}
                      />
                      <span style={{ fontSize: tokens.typography.sizes.xs, color: isHealthy ? tokens.colors.accent.emerald : tokens.colors.accent.amber }}>
                        {isHealthy ? (liveInfo?.health.latencyMs ? `${liveInfo.health.latencyMs}ms` : 'Ready') : 'Degraded'}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: tokens.colors.text.faint }}>
                      Unconfigured
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${tokens.colors.border.subtle}`,
            background: 'rgba(4, 6, 10, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted }}>
            Need to add or update API keys?
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onClose();
              if (onOpenProviderCenter) onOpenProviderCenter();
            }}
          >
            Open Provider Center →
          </Button>
        </div>
      </GlassSurface>
    </div>
  );
};
