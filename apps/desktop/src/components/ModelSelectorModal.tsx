import React, { useEffect, useState } from 'react';
import { ModelIcon, CheckIcon, CloseIcon } from './ui/Icons.js';
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
        backgroundColor: tokens.colors.bg.overlay,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '24px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: tokens.colors.bg.surface,
          border: `1px solid ${tokens.colors.border.strong}`,
          borderRadius: tokens.radii.lg,
          overflow: 'hidden'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px 14px',
            borderBottom: `1px solid ${tokens.colors.border.subtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ModelIcon size={16} color={tokens.colors.accent.primary} />
              <span
                style={{
                  fontFamily: tokens.typography.fontDisplay,
                  fontSize: tokens.typography.sizes.lg,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: tokens.colors.text.primary
                }}
              >
                Model Provider Routing
              </span>
              {loading && (
                <span style={{ fontSize: '11px', color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
                  ● Checking...
                </span>
              )}
            </div>
            <div style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted, marginTop: '2px' }}>
              Directly routes typed and spoken commands to the selected provider
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: tokens.colors.text.muted,
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Provider List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
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
                  padding: '12px 14px',
                  borderRadius: tokens.radii.sm,
                  border: `1px solid ${isSelected ? tokens.colors.border.accent : tokens.colors.border.subtle}`,
                  backgroundColor: isSelected ? tokens.colors.accent.primarySubtle : tokens.colors.bg.elevated,
                  cursor: isAuto || isConfigured ? 'pointer' : 'default',
                  opacity: isAuto || isConfigured ? 1 : 0.45,
                  transition: tokens.transitions.fast
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: tokens.typography.sizes.sm,
                        color: isSelected ? tokens.colors.accent.primary : tokens.colors.text.primary
                      }}
                    >
                      {p.name}
                    </span>
                    {isSelected && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontFamily: tokens.typography.fontMono,
                          padding: '1px 5px',
                          borderRadius: tokens.radii.xs,
                          backgroundColor: tokens.colors.accent.primaryMuted,
                          color: tokens.colors.accent.primary,
                          border: `1px solid ${tokens.colors.border.accent}`,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <CheckIcon size={10} />
                        ACTIVE
                      </span>
                    )}
                    {p.badge && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontFamily: tokens.typography.fontMono,
                          padding: '1px 5px',
                          borderRadius: tokens.radii.xs,
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: tokens.colors.text.muted,
                          border: `1px solid ${tokens.colors.border.subtle}`
                        }}
                      >
                        {p.badge}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted }}>
                    {p.description}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isAuto ? (
                    <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.accent.primary, fontFamily: tokens.typography.fontMono }}>
                      Dynamic
                    </span>
                  ) : isConfigured ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          backgroundColor: isHealthy ? tokens.colors.semantic.success : tokens.colors.semantic.warning
                        }}
                      />
                      <span
                        style={{
                          fontSize: tokens.typography.sizes.xs,
                          fontFamily: tokens.typography.fontMono,
                          color: isHealthy ? tokens.colors.semantic.success : tokens.colors.semantic.warning
                        }}
                      >
                        {isHealthy ? (liveInfo?.health.latencyMs ? `${liveInfo.health.latencyMs}ms` : 'Ready') : 'Degraded'}
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: tokens.colors.text.faint, fontFamily: tokens.typography.fontMono }}>
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
            padding: '12px 24px',
            borderTop: `1px solid ${tokens.colors.border.subtle}`,
            backgroundColor: tokens.colors.bg.subtle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontSize: tokens.typography.sizes.xs, color: tokens.colors.text.muted }}>
            Configure API keys & inspect latency
          </span>
          <button
            onClick={() => {
              onClose();
              if (onOpenProviderCenter) onOpenProviderCenter();
            }}
            style={{
              background: 'transparent',
              border: `1px solid ${tokens.colors.border.default}`,
              borderRadius: tokens.radii.xs,
              padding: '4px 10px',
              color: tokens.colors.text.secondary,
              fontSize: tokens.typography.sizes.xs,
              cursor: 'pointer'
            }}
          >
            Open Provider Center →
          </button>
        </div>
      </div>
    </div>
  );
};
