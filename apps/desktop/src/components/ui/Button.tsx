import React from 'react';
import { tokens } from '../../theme/tokens.js';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled,
  style,
  ...props
}) => {
  const [hovered, setHovered] = React.useState(false);

  const sizeStyles = {
    sm: {
      padding: '4px 10px',
      fontSize: tokens.typography.sizes.xs,
      gap: '6px',
      borderRadius: tokens.radii.sm
    },
    md: {
      padding: '7px 14px',
      fontSize: tokens.typography.sizes.sm,
      gap: '8px',
      borderRadius: tokens.radii.md
    },
    lg: {
      padding: '10px 20px',
      fontSize: tokens.typography.sizes.base,
      gap: '10px',
      borderRadius: tokens.radii.lg
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          background: hovered ? tokens.colors.accent.cyanHover : tokens.colors.accent.cyan,
          color: tokens.colors.text.inverse,
          border: '1px solid transparent',
          fontWeight: 600,
          boxShadow: hovered ? tokens.shadows.glowCyan : 'none'
        };
      case 'accent':
        return {
          background: hovered ? 'rgba(0, 240, 255, 0.22)' : tokens.colors.accent.cyanMuted,
          color: tokens.colors.accent.cyan,
          border: `1px solid ${hovered ? tokens.colors.border.accent : 'rgba(0, 240, 255, 0.2)'}`,
          fontWeight: 600
        };
      case 'danger':
        return {
          background: hovered ? 'rgba(239, 68, 68, 0.22)' : tokens.colors.accent.roseMuted,
          color: '#FCA5A5',
          border: `1px solid ${hovered ? tokens.colors.accent.rose : 'rgba(239, 68, 68, 0.3)'}`,
          fontWeight: 600
        };
      case 'ghost':
        return {
          background: hovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
          color: hovered ? tokens.colors.text.primary : tokens.colors.text.secondary,
          border: '1px solid transparent',
          fontWeight: 500
        };
      case 'secondary':
      default:
        return {
          background: hovered ? tokens.colors.bg.glassHover : tokens.colors.bg.glass,
          color: hovered ? tokens.colors.text.primary : tokens.colors.text.secondary,
          border: `1px solid ${hovered ? tokens.colors.border.hover : tokens.colors.border.default}`,
          fontWeight: 500
        };
    }
  };

  return (
    <button
      disabled={disabled || loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: tokens.typography.fontSans,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: tokens.transitions.fast,
        outline: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...sizeStyles[size],
        ...getVariantStyles(),
        ...style
      }}
      {...props}
    >
      {icon && iconPosition === 'left' && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children && <span>{children}</span>}
      {icon && iconPosition === 'right' && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
    </button>
  );
};
