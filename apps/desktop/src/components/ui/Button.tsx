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
  const sizeStyles = {
    sm: {
      padding: '4px 10px',
      fontSize: tokens.typography.sizes.xs,
      gap: '5px',
      borderRadius: tokens.radii.xs
    },
    md: {
      padding: '6px 14px',
      fontSize: tokens.typography.sizes.sm,
      gap: '6px',
      borderRadius: tokens.radii.sm
    },
    lg: {
      padding: '9px 18px',
      fontSize: tokens.typography.sizes.base,
      gap: '8px',
      borderRadius: tokens.radii.md
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: tokens.colors.accent.primary,
          color: tokens.colors.text.inverse,
          border: '1px solid transparent',
          fontWeight: 600
        };
      case 'accent':
        return {
          backgroundColor: tokens.colors.accent.primarySubtle,
          color: tokens.colors.accent.primary,
          border: `1px solid ${tokens.colors.border.accent}`,
          fontWeight: 600
        };
      case 'danger':
        return {
          backgroundColor: tokens.colors.semantic.errorMuted,
          color: '#f8b4b0',
          border: `1px solid ${tokens.colors.semantic.error}`,
          fontWeight: 600
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: tokens.colors.text.secondary,
          border: '1px solid transparent',
          fontWeight: 500
        };
      case 'secondary':
      default:
        return {
          backgroundColor: tokens.colors.bg.elevated,
          color: tokens.colors.text.primary,
          border: `1px solid ${tokens.colors.border.default}`,
          fontWeight: 500
        };
    }
  };

  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: tokens.typography.fontSans,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: tokens.transitions.fast,
        userSelect: 'none',
        outline: 'none',
        ...sizeStyles[size],
        ...getVariantStyles(),
        ...style
      }}
      {...props}
    >
      {loading ? (
        <span style={{ fontSize: '11px', fontFamily: tokens.typography.fontMono }}>...</span>
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          {children}
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </button>
  );
};
