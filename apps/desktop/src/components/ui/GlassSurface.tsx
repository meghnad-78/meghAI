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
  blur = 16,
  radius = 'md',
  style,
  className,
  ...props
}) => {
  const bgMap = {
    subtle: tokens.colors.bg.subtle,
    surface: tokens.colors.bg.glass,
    elevated: tokens.colors.bg.glassElevated,
    floating: tokens.colors.bg.elevated
  };

  const borderMap = {
    subtle: tokens.colors.border.subtle,
    surface: tokens.colors.border.default,
    elevated: tokens.colors.border.strong,
    floating: glow ? tokens.colors.border.focus : tokens.colors.border.strong
  };

  return (
    <div
      style={{
        backgroundColor: bgMap[elevation],
        backdropFilter: `blur(${blur}px)`,
        WebkitBackdropFilter: `blur(${blur}px)`,
        border: border ? `1px solid ${glow ? tokens.colors.border.accent : borderMap[elevation]}` : 'none',
        borderRadius: tokens.radii[radius],
        transition: tokens.transitions.fast,
        ...style
      }}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
};
