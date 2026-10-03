import React from 'react';
import { tokens } from '../../theme/tokens.js';

interface GlassSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  elevation?: 'subtle' | 'surface' | 'elevated' | 'floating';
  border?: boolean;
  glow?: boolean;
  blur?: number;
  radius?: keyof typeof tokens.radii;
}

export const GlassSurface: React.FC<GlassSurfaceProps> = ({
  children,
  elevation = 'surface',
  border = true,
  glow = false,
  blur = 20,
  radius = 'lg',
  style,
  className,
  ...props
}) => {
  const bgMap = {
    subtle: tokens.colors.bg.subtle,
    surface: tokens.colors.bg.glass,
    elevated: tokens.colors.bg.glassHover,
    floating: tokens.colors.bg.elevated
  };

  const shadowMap = {
    subtle: tokens.shadows.subtle,
    surface: tokens.shadows.elevated,
    elevated: tokens.shadows.floating,
    floating: '0 24px 60px -12px rgba(0, 0, 0, 0.85)'
  };

  return (
    <div
      style={{
        background: bgMap[elevation],
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        border: border ? `1px solid ${glow ? tokens.colors.border.accent : tokens.colors.border.default}` : 'none',
        borderRadius: tokens.radii[radius],
        boxShadow: glow ? `${shadowMap[elevation]}, ${tokens.shadows.glowCyan}` : shadowMap[elevation],
        transition: tokens.transitions.normal,
        ...style
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};
