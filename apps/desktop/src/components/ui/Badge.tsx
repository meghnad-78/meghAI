import React from 'react';
import { tokens } from '../../theme/tokens.js';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'purple';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  style
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'accent':
        return {
          backgroundColor: tokens.colors.accent.primarySubtle,
          border: `1px solid ${tokens.colors.border.accent}`,
          color: tokens.colors.accent.primary
        };
      case 'purple':
        return {
          backgroundColor: 'rgba(122, 142, 163, 0.12)',
          border: '1px solid rgba(122, 142, 163, 0.25)',
          color: '#d2dce6'
        };
      case 'success':
        return {
          backgroundColor: tokens.colors.semantic.successMuted,
          border: `1px solid ${tokens.colors.semantic.success}`,
          color: tokens.colors.semantic.success
        };
      case 'warning':
        return {
          backgroundColor: tokens.colors.semantic.warningMuted,
          border: `1px solid ${tokens.colors.semantic.warning}`,
          color: tokens.colors.semantic.warning
        };
      case 'danger':
        return {
          backgroundColor: tokens.colors.semantic.errorMuted,
          border: `1px solid ${tokens.colors.semantic.error}`,
          color: '#f8b4b0'
        };
      case 'neutral':
      default:
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          border: `1px solid ${tokens.colors.border.default}`,
          color: tokens.colors.text.secondary
        };
    }
  };

  const sizeStyles = {
    sm: {
      padding: '1px 6px',
      fontSize: '10px'
    },
    md: {
      padding: '2px 8px',
      fontSize: '11px'
    }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: tokens.radii.xs,
        fontFamily: tokens.typography.fontMono,
        fontWeight: 600,
        lineHeight: 1.3,
        letterSpacing: '0.02em',
        ...sizeStyles[size],
        ...getVariantStyles(),
        ...style
      }}
    >
      {icon && icon}
      {children}
    </span>
  );
};
