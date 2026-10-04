/**
 * MeghAI Master Design System Tokens
 * Architectural Art Direction: Dark Mineral Computational Environment
 * Restrained Palette, Pure Hairline Depth, Precision Instrumentation
 */

export const tokens = {
  colors: {
    // Canvas & Mineral Surface Hierarchy
    bg: {
      canvas: '#07080a',          // Near-black charcoal void
      subtle: '#0c0e12',          // Deep graphite sub-surface
      surface: '#11141a',         // Mineral charcoal surface
      elevated: '#171b22',        // Elevated graphite plane
      active: '#1d232c',          // Active focused substrate
      overlay: 'rgba(7, 8, 10, 0.88)', // Deep environmental veil
      glass: 'rgba(17, 20, 26, 0.82)',  // Layered mineral transparency
      glassElevated: 'rgba(23, 27, 34, 0.92)'
    },

    // Hairline Architectural Dividers & Outlines (No drop shadows)
    border: {
      subtle: 'rgba(255, 255, 255, 0.05)',
      default: 'rgba(255, 255, 255, 0.08)',
      strong: 'rgba(255, 255, 255, 0.15)',
      focus: 'rgba(79, 168, 181, 0.45)',
      accent: 'rgba(79, 168, 181, 0.35)',
      accentSubtle: 'rgba(79, 168, 181, 0.12)'
    },

    // Typography & Content Luminance
    text: {
      primary: '#e6e9ee',   // Primary light grey (high readability)
      secondary: '#9ba3af', // Secondary muted grey
      muted: '#616a78',     // Tertiary subdued grey
      faint: '#3f4551',     // Structural/timestamp grey
      inverse: '#07080a'    // Contrast on light indicator
    },

    // Single Restrained Functional Accent Family: Desaturated Steel Blue / Oxidized Teal
    accent: {
      primary: '#4fa8b5',          // Steel teal (non-neon, controlled luminance)
      primaryHover: '#5cb8c5',     // Slightly illuminated focus state
      primaryMuted: 'rgba(79, 168, 181, 0.12)',
      primarySubtle: 'rgba(79, 168, 181, 0.05)',
      cyan: '#4fa8b5',             // Alias for backward compatibility
      cyanHover: '#5cb8c5',
      cyanMuted: 'rgba(79, 168, 181, 0.12)'
    },

    // Controlled Restrained Semantic States
    semantic: {
      warning: '#c6994a',        // Desaturated amber
      warningMuted: 'rgba(198, 153, 74, 0.12)',
      error: '#bf5049',          // Restrained vermilion (STOP MEGH / Kill Switch)
      errorMuted: 'rgba(191, 80, 73, 0.14)',
      success: '#589e7c',        // Oxidized sage
      successMuted: 'rgba(88, 158, 124, 0.12)',
      info: '#5c8fa8',           // Slate blue
      infoMuted: 'rgba(92, 143, 168, 0.12)'
    },

    // AI Dynamic Operational States (Restrained)
    state: {
      ready: '#4fa8b5',
      listening: '#5cb8c5',
      transcribing: '#c6994a',
      routing: '#7a8ea3',
      planning: '#7a8ea3',
      executing: '#5c8fa8',
      verifying: '#589e7c',
      speaking: '#859bb0',
      failed: '#bf5049',
      cancelled: '#616a78'
    }
  },

  typography: {
    fontDisplay: "'Syne', 'Plus Jakarta Sans', sans-serif",
    fontSans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
    sizes: {
      xs: '11px',
      sm: '12.5px',
      base: '14px',
      md: '15.5px',
      lg: '17.5px',
      xl: '21px',
      xxl: '26px',
      display: '34px'
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    letterSpacing: {
      tight: '-0.025em',
      normal: '0',
      wide: '0.04em',
      display: '-0.035em'
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
    none: '0px',
    xs: '3px',
    sm: '5px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    pill: '9999px'
  },

  // Depth via Hairlines and Pure Contrast — NO DROP SHADOWS
  depth: {
    flat: 'none',
    surface: '0 0 0 1px rgba(255, 255, 255, 0.06)',
    elevated: '0 0 0 1px rgba(255, 255, 255, 0.09)',
    floating: '0 0 0 1px rgba(255, 255, 255, 0.12)',
    focus: '0 0 0 1px rgba(79, 168, 181, 0.5)'
  },

  // Backward compatibility alias: replaces drop shadows with clean border highlights
  shadows: {
    subtle: '0 0 0 1px rgba(255, 255, 255, 0.05)',
    elevated: '0 0 0 1px rgba(255, 255, 255, 0.08)',
    floating: '0 0 0 1px rgba(255, 255, 255, 0.12)',
    glowCyan: '0 0 0 1px rgba(79, 168, 181, 0.35)',
    glowPurple: '0 0 0 1px rgba(122, 142, 163, 0.35)',
    glowRose: '0 0 0 1px rgba(191, 80, 73, 0.35)'
  },

  transitions: {
    fast: 'all 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)',
    normal: 'all 0.20s cubic-bezier(0.2, 0.8, 0.2, 1)',
    slow: 'all 0.32s cubic-bezier(0.2, 0.8, 0.2, 1)'
  },

  zIndex: {
    base: 0,
    background: 1,
    surface: 5,
    panel: 10,
    header: 20,
    drawer: 30,
    modal: 40,
    popover: 50,
    toast: 60
  }
} as const;
