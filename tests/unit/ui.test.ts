import { describe, it, expect } from 'vitest';
import {
  AI_STATE_THEMES,
  RISK_BADGE_STYLES,
  formatCurrencyINR,
  formatCurrencyUSD,
  formatDurationMs,
} from '../../packages/ui/src/index';

describe('@meghai/ui design tokens and formatting', () => {
  it('provides themes for all canonical AI states', () => {
    expect(AI_STATE_THEMES.READY.label).toBe('READY');
    expect(AI_STATE_THEMES.EXECUTING.primaryColor).toBe('#00ff88');
    expect(AI_STATE_THEMES.WAITING_FOR_CONFIRMATION.label).toBe('REQUIRES APPROVAL');
    expect(AI_STATE_THEMES.SLEEPING.label).toBe('SLEEPING');
  });

  it('provides risk badge styles for all 4 risk tiers', () => {
    expect(RISK_BADGE_STYLES.LOW.label).toBe('LOW RISK');
    expect(RISK_BADGE_STYLES.CRITICAL.border).toContain('255, 0, 85');
  });

  it('formats currencies and durations correctly', () => {
    expect(formatCurrencyINR(0)).toBe('₹0.00');
    expect(formatCurrencyINR(150.5)).toBe('₹150.50');
    expect(formatCurrencyUSD(0.0025)).toBe('$0.0025');
    expect(formatDurationMs(450)).toBe('450ms');
    expect(formatDurationMs(1500)).toBe('1.50s');
  });
});
