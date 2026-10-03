import React from 'react';
import { tokens } from '../../theme/tokens.js';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  tooltip?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  variant = 'ghost',
  size = 'md',
  active = false,
  tooltip,
  disabled,
  style,
  ...props
}) => {
  const [hovered, setHovered] = React.useState(false);

  const sizeDimensions = {
    sm: { width: '28px', height: '28px', fontSize: '13px', borderRadius: tokens.radii.sm },
    md: { width: '34px', height: '34px', fontSize: '15px', borderRadius: tokens.radii.md },
    lg: { width: '42px', height: '42px', fontSize: '18px', borderRadius: tokens.radii.lg }
  };

  const getVariantStyles = () => {
    if (active) {
      return {
        background: tokens.colors.accent.cyanMuted,
        border: `1px solid ${tokens.colors.border.accent}`,
        color: tokens.colors.accent.cyan,
        boxShadow: tokens.shadows.glowCyan
      };
    }

    switch (variant) {
      case 'primary':
        return {
          background: hovered ? tokens.colors.accent.cyanHover : tokens.colors.accent.cyan,
          border: '1px solid transparent',
          color: tokens.colors.text.inverse
        };
      case 'accent':
        return {
          background: hovered ? 'rgba(0, 240, 255, 0.2)' : tokens.colors.accent.cyanMuted,
          border: `1px solid ${hovered ? tokens.colors.border.accent : 'transparent'}`,
          color: tokens.colors.accent.cyan
        };
      case 'danger':
        return {
          background: hovered ? 'rgba(239, 68, 68, 0.22)' : tokens.colors.accent.roseMuted,
          border: `1px solid ${hovered ? tokens.colors.accent.rose : 'rgba(239, 68, 68, 0.3)'}`,
          color: '#FCA5A5'
        };
      case 'secondary':
        return {
          background: hovered ? tokens.colors.bg.glassHover : tokens.colors.bg.glass,
          border: `1px solid ${hovered ? tokens.colors.border.hover : tokens.colors.border.default}`,
          color: hovered ? tokens.colors.text.primary : tokens.colors.text.secondary
        };
      case 'ghost':
      default:
        return {
          background: hovered ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
          border: '1px solid transparent',
          color: hovered ? tokens.colors.text.primary : tokens.colors.text.secondary
        };
    }
  };

  return (
    <button
      disabled={disabled}
      title={tooltip}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: tokens.transitions.fast,
        outline: 'none',
        flexShrink: 0,
        ...sizeDimensions[size],
        ...getVariantStyles(),
        ...style
      }}
      {...props}
    >
      {icon}
    </button>
  );
};
