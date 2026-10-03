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
          background: 'rgba(0, 240, 255, 0.1)',
          border: '1px solid rgba(0, 240, 255, 0.25)',
          color: tokens.colors.accent.cyan
        };
      case 'purple':
        return {
          background: 'rgba(168, 85, 247, 0.12)',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          color: '#D8B4FE'
        };
      case 'success':
        return {
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          color: '#34D399'
        };
      case 'warning':
        return {
          background: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          color: '#FBBF24'
        };
      case 'danger':
        return {
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          color: '#F87171'
        };
      case 'neutral':
      default:
        return {
          background: 'rgba(255, 255, 255, 0.05)',
          border: `1px solid ${tokens.colors.border.default}`,
          color: tokens.colors.text.secondary
        };
    }
  };

  const sizeStyles = {
    sm: { padding: '2px 6px', fontSize: '10.5px', borderRadius: tokens.radii.xs, gap: '4px' },
    md: { padding: '3px 8px', fontSize: tokens.typography.sizes.xs, borderRadius: tokens.radii.sm, gap: '5px' }
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: tokens.typography.fontSans,
        fontWeight: 500,
        letterSpacing: '0.02em',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...sizeStyles[size],
        ...getVariantStyles(),
        ...style
      }}
    >
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </span>
  );
};
