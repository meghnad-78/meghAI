import type { AIState, RiskLevel } from '@meghai/shared-types';

export const MEGHAI_COLORS = {
  bgVoid: '#030712',
  bgCard: 'rgba(15, 23, 42, 0.75)',
  bgGlass: 'rgba(255, 255, 255, 0.03)',
  borderMuted: 'rgba(255, 255, 255, 0.08)',
  borderActive: 'rgba(0, 240, 255, 0.35)',

  // Accents
  cyanPrimary: '#00f0ff',
  blueSky: '#38bdf8',
  greenNeon: '#00ff88',
  greenEmerald: '#10b981',
  purpleCore: '#8b5cf6',
  purpleNeon: '#a855f7',
  amberWarning: '#f59e0b',
  redDanger: '#ef4444',
  redCritical: '#ff0055',
  offlineGrey: '#64748b',
} as const;

export const AI_STATE_THEMES: Record<
  AIState,
  { primaryColor: string; glowColor: string; label: string; animationSpeed: number }
> = {
  SLEEPING: {
    primaryColor: MEGHAI_COLORS.offlineGrey,
    glowColor: 'rgba(100, 116, 139, 0.2)',
    label: 'SLEEPING',
    animationSpeed: 0.3,
  },
  READY: {
    primaryColor: MEGHAI_COLORS.cyanPrimary,
    glowColor: 'rgba(0, 240, 255, 0.25)',
    label: 'READY',
    animationSpeed: 1.0,
  },
  LISTENING: {
    primaryColor: MEGHAI_COLORS.blueSky,
    glowColor: 'rgba(56, 189, 248, 0.45)',
    label: 'LISTENING',
    animationSpeed: 1.5,
  },
  TRANSCRIBING: {
    primaryColor: MEGHAI_COLORS.blueSky,
    glowColor: 'rgba(56, 189, 248, 0.55)',
    label: 'TRANSCRIBING',
    animationSpeed: 1.8,
  },
  UNDERSTANDING: {
    primaryColor: MEGHAI_COLORS.purpleNeon,
    glowColor: 'rgba(168, 85, 247, 0.55)',
    label: 'UNDERSTANDING',
    animationSpeed: 2.0,
  },
  RETRIEVING: {
    primaryColor: MEGHAI_COLORS.purpleCore,
    glowColor: 'rgba(139, 92, 246, 0.5)',
    label: 'RETRIEVING',
    animationSpeed: 1.8,
  },
  PLANNING: {
    primaryColor: MEGHAI_COLORS.purpleCore,
    glowColor: 'rgba(139, 92, 246, 0.45)',
    label: 'PLANNING DAG',
    animationSpeed: 1.8,
  },
  ROUTING: {
    primaryColor: MEGHAI_COLORS.cyanPrimary,
    glowColor: 'rgba(0, 240, 255, 0.4)',
    label: 'MODEL ROUTING',
    animationSpeed: 1.6,
  },
  EXECUTING: {
    primaryColor: MEGHAI_COLORS.greenNeon,
    glowColor: 'rgba(0, 255, 136, 0.55)',
    label: 'EXECUTING',
    animationSpeed: 2.5,
  },
  VERIFYING: {
    primaryColor: MEGHAI_COLORS.greenEmerald,
    glowColor: 'rgba(16, 185, 129, 0.5)',
    label: 'VERIFYING OUTCOME',
    animationSpeed: 2.0,
  },
  RESPONDING: {
    primaryColor: MEGHAI_COLORS.cyanPrimary,
    glowColor: 'rgba(0, 240, 255, 0.5)',
    label: 'RESPONDING',
    animationSpeed: 2.0,
  },
  WAITING_FOR_CONFIRMATION: {
    primaryColor: MEGHAI_COLORS.amberWarning,
    glowColor: 'rgba(245, 158, 11, 0.6)',
    label: 'REQUIRES APPROVAL',
    animationSpeed: 1.2,
  },
  PAUSED: {
    primaryColor: MEGHAI_COLORS.amberWarning,
    glowColor: 'rgba(245, 158, 11, 0.4)',
    label: 'PAUSED',
    animationSpeed: 0.5,
  },
  COMPLETED: {
    primaryColor: MEGHAI_COLORS.greenEmerald,
    glowColor: 'rgba(16, 185, 129, 0.4)',
    label: 'COMPLETED',
    animationSpeed: 1.0,
  },
  FAILED: {
    primaryColor: MEGHAI_COLORS.redDanger,
    glowColor: 'rgba(239, 68, 68, 0.6)',
    label: 'FAILED',
    animationSpeed: 0.8,
  },
  CANCELLED: {
    primaryColor: MEGHAI_COLORS.redCritical,
    glowColor: 'rgba(255, 0, 85, 0.7)',
    label: 'CANCELLED',
    animationSpeed: 0.5,
  },
};

export const RISK_BADGE_STYLES: Record<
  RiskLevel,
  { bg: string; text: string; border: string; label: string }
> = {
  LOW: {
    bg: 'rgba(16, 185, 129, 0.12)',
    text: '#10b981',
    border: 'rgba(16, 185, 129, 0.3)',
    label: 'LOW RISK',
  },
  MEDIUM: {
    bg: 'rgba(56, 189, 248, 0.12)',
    text: '#38bdf8',
    border: 'rgba(56, 189, 248, 0.3)',
    label: 'MEDIUM RISK',
  },
  HIGH: {
    bg: 'rgba(245, 158, 11, 0.15)',
    text: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.4)',
    label: 'HIGH RISK',
  },
  CRITICAL: {
    bg: 'rgba(255, 0, 85, 0.2)',
    text: '#ff0055',
    border: 'rgba(255, 0, 85, 0.6)',
    label: 'CRITICAL RISK',
  },
};

export function formatCurrencyINR(amountINR: number): string {
  return `₹${amountINR.toFixed(2)}`;
}

export function formatCurrencyUSD(amountUSD: number): string {
  return `$${amountUSD.toFixed(4)}`;
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
