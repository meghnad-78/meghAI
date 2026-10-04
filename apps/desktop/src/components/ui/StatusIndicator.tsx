import React from 'react';
import type { AIState } from '@meghai/shared-types';
import { tokens } from '../../theme/tokens.js';

interface StatusIndicatorProps {
  state: AIState;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  pulsing?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  state,
  showLabel = true,
  size = 'md',
  pulsing = true
}) => {
  const getColor = (): string => {
    switch (state) {
      case 'LISTENING': return tokens.colors.state.listening;
      case 'UNDERSTANDING': return tokens.colors.state.transcribing;
      case 'ROUTING':
      case 'PLANNING': return tokens.colors.state.routing;
      case 'EXECUTING': return tokens.colors.state.executing;
      case 'VERIFYING': return tokens.colors.state.verifying;
      case 'RESPONDING': return tokens.colors.accent.primary;
      case 'SPEAKING': return tokens.colors.state.speaking;
      case 'WAITING_FOR_CONFIRMATION': return tokens.colors.semantic.warning;
      case 'FAILED':
      case 'CANCELLED': return tokens.colors.state.failed;
      default: return tokens.colors.state.ready;
    }
  };

  const getLabel = (): string => {
    switch (state) {
      case 'READY': return 'Ready';
      case 'LISTENING': return 'Listening';
      case 'UNDERSTANDING': return 'Processing';
      case 'ROUTING': return 'Routing';
      case 'PLANNING': return 'Planning';
      case 'EXECUTING': return 'Executing';
      case 'VERIFYING': return 'Verifying';
      case 'RESPONDING': return 'Thinking';
      case 'SPEAKING': return 'Speaking';
      case 'WAITING_FOR_CONFIRMATION': return 'Action Approval';
      case 'FAILED': return 'Failed';
      case 'CANCELLED': return 'Stopped';
      default: return state;
    }
  };

  const dotSizes = {
    sm: 6,
    md: 8,
    lg: 10
  };

  const color = getColor();
  const dotSize = dotSizes[size];

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '7px',
        fontFamily: tokens.typography.fontSans,
        userSelect: 'none'
      }}
    >
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          width: `${dotSize}px`,
          height: `${dotSize}px`
        }}
      >
        {pulsing && (state === 'LISTENING' || state === 'RESPONDING' || state === 'SPEAKING' || state === 'PLANNING') && (
          <span
            style={{
              position: 'absolute',
              inset: '-3px',
              borderRadius: '50%',
              backgroundColor: color,
              opacity: 0.4,
              animation: 'megh-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite'
            }}
          />
        )}
        <span
          style={{
            position: 'relative',
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`
          }}
        />
      </span>

      {showLabel && (
        <span
          style={{
            fontSize: size === 'sm' ? tokens.typography.sizes.xs : tokens.typography.sizes.sm,
            fontWeight: 500,
            color: tokens.colors.text.secondary,
            letterSpacing: '0.01em'
          }}
        >
          {getLabel()}
        </span>
      )}
    </div>
  );
};
