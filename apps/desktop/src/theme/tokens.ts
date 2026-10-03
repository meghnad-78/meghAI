/**
 * MeghAI Master Design System Tokens
 * Unified token architecture for a futuristic, cinematic, premium AI operating layer.
 */

export const tokens = {
  colors: {
    // Canvas & Surface Hierarchy
    bg: {
      canvas: '#04060A',
      subtle: '#080C14',
      surface: '#0E1420',
      elevated: '#141C2C',
      overlay: 'rgba(4, 6, 10, 0.82)',
      glass: 'rgba(14, 20, 32, 0.72)',
      glassHover: 'rgba(20, 28, 44, 0.85)',
      glassActive: 'rgba(24, 34, 52, 0.95)'
    },

    // Borders & Dividers
    border: {
      subtle: 'rgba(255, 255, 255, 0.05)',
      default: 'rgba(255, 255, 255, 0.08)',
      hover: 'rgba(255, 255, 255, 0.16)',
      accent: 'rgba(0, 240, 255, 0.35)',
      accentGlow: 'rgba(0, 240, 255, 0.6)'
    },

    // Typography & Content
    text: {
      primary: '#F8FAFC',
      secondary: '#94A3B8',
      muted: '#64748B',
      faint: '#475569',
      inverse: '#04060A'
    },

    // Accent & Luminous Spectrum (Restrained & Intentional)
    accent: {
      cyan: '#00F0FF',
      cyanHover: '#38BDF8',
      cyanMuted: 'rgba(0, 240, 255, 0.12)',
      purple: '#A855F7',
      purpleMuted: 'rgba(168, 85, 247, 0.14)',
      emerald: '#10B981',
      emeraldMuted: 'rgba(16, 185, 129, 0.14)',
      amber: '#F59E0B',
      amberMuted: 'rgba(245, 158, 11, 0.14)',
      rose: '#EF4444',
      roseMuted: 'rgba(239, 68, 68, 0.14)'
    },

    // AI Dynamic Visual States
    state: {
      ready: '#38BDF8',
      listening: '#00F0FF',
      transcribing: '#F59E0B',
      routing: '#A855F7',
      planning: '#8B5CF6',
      executing: '#3B82F6',
      verifying: '#10B981',
      speaking: '#C084FC',
      failed: '#EF4444',
      cancelled: '#64748B'
    }
  },

  typography: {
    fontSans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
    sizes: {
      xs: '11px',
      sm: '12px',
      base: '13.5px',
      md: '15px',
      lg: '17px',
      xl: '20px',
      xxl: '24px',
      display: '32px'
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
    xxxl: '48px'
  },

  radii: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '28px',
    pill: '9999px'
  },

  shadows: {
    subtle: '0 2px 8px rgba(0, 0, 0, 0.3)',
    elevated: '0 8px 24px -4px rgba(0, 0, 0, 0.5)',
    floating: '0 20px 48px -8px rgba(0, 0, 0, 0.75)',
    glowCyan: '0 0 24px rgba(0, 240, 255, 0.22)',
    glowPurple: '0 0 24px rgba(168, 85, 247, 0.22)',
    glowRose: '0 0 24px rgba(239, 68, 68, 0.25)'
  },

  transitions: {
    fast: 'all 0.14s cubic-bezier(0.16, 1, 0.3, 1)',
    normal: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
    slow: 'all 0.36s cubic-bezier(0.16, 1, 0.3, 1)'
  },

  zIndex: {
    base: 0,
    surface: 5,
    panel: 10,
    header: 20,
    drawer: 30,
    modal: 40,
    popover: 50,
    toast: 60
  }
} as const;
