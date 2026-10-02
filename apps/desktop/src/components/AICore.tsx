import React, { useEffect, useRef } from 'react';
import type { AIState } from '@meghai/shared-types';

interface AICoreProps {
  state: AIState;
  size?: number;
}

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  targetAlpha: number;
  color: string;
  angle: number;
  orbitRadius: number;
  speed: number;
}

/**
 * Living Adaptive AI Core & Particle Motion Canvas (Section 100, 101, 212)
 */
export const AICore: React.FC<AICoreProps> = ({ state, size = 320 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = size;
    const height = size;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const centerX = width / 2;
    const centerY = height / 2;
    const particleCount = 140;
    const particles: Particle[] = [];

    // State Color Palettes (Cyan, Purple, Amber, Crimson)
    const getColorForState = (s: AIState) => {
      switch (s) {
        case 'LISTENING': return 'rgba(0, 240, 255, '; // Cyan
        case 'UNDERSTANDING': return 'rgba(138, 43, 226, '; // Violet
        case 'ROUTING':
        case 'PLANNING': return 'rgba(168, 85, 247, '; // Bright Purple
        case 'EXECUTING': return 'rgba(59, 130, 246, '; // Blue
        case 'VERIFYING': return 'rgba(16, 185, 129, '; // Emerald Green
        case 'RESPONDING': return 'rgba(236, 72, 153, '; // Pink/Magenta
        case 'WAITING_FOR_CONFIRMATION': return 'rgba(245, 158, 11, '; // Amber
        case 'FAILED':
        case 'CANCELLED': return 'rgba(239, 68, 68, '; // Crimson Red
        case 'SLEEPING': return 'rgba(100, 116, 139, '; // Slate Gray
        default: return 'rgba(0, 229, 255, '; // Idle Cyan
      }
    };

    // Initialize particles in orbital rings
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const orbit = 30 + Math.random() * 85;
      particles.push({
        x: centerX + Math.cos(angle) * orbit,
        y: centerY + Math.sin(angle) * orbit,
        originX: centerX,
        originY: centerY,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        radius: 1.2 + Math.random() * 2.2,
        alpha: 0.3 + Math.random() * 0.6,
        targetAlpha: 0.8,
        color: getColorForState(state),
        angle,
        orbitRadius: orbit,
        speed: 0.01 + Math.random() * 0.02
      });
    }

    let time = 0;

    const render = () => {
      time += 0.02;
      ctx.clearRect(0, 0, width, height);

      // Central Energy Core Halo
      const gradient = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, 110);
      const baseColor = getColorForState(state);
      gradient.addColorStop(0, `${baseColor}0.25)`);
      gradient.addColorStop(0.5, `${baseColor}0.08)`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 110, 0, Math.PI * 2);
      ctx.fill();

      // Inner Core Ring
      ctx.strokeStyle = `${baseColor}0.5)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const pulse = Math.sin(time * 2) * 4;
      ctx.arc(centerX, centerY, 38 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Render & Animate Particles according to AI State (Section 101)
      for (const p of particles) {
        p.color = baseColor;

        if (state === 'LISTENING') {
          // Particles converge toward the core with subtle waveform response
          p.orbitRadius = Math.max(30, p.orbitRadius - 0.5);
          p.angle += p.speed * 1.8;
          p.x = centerX + Math.cos(p.angle) * (p.orbitRadius + Math.sin(time * 8 + p.angle) * 8);
          p.y = centerY + Math.sin(p.angle) * (p.orbitRadius + Math.cos(time * 8 + p.angle) * 8);
        } else if (state === 'ROUTING' || state === 'PLANNING') {
          // Dense orbital vortex movement
          p.angle += p.speed * 3.0;
          p.x = centerX + Math.cos(p.angle) * p.orbitRadius;
          p.y = centerY + Math.sin(p.angle) * p.orbitRadius;
        } else if (state === 'EXECUTING') {
          // Directional tool-oriented streaming motion
          p.x += Math.cos(p.angle) * 2;
          p.y += Math.sin(p.angle) * 2;
          const dist = Math.hypot(p.x - centerX, p.y - centerY);
          if (dist > 120) {
            p.x = centerX;
            p.y = centerY;
          }
        } else if (state === 'VERIFYING') {
          // Closed-loop tight orbital motion
          p.angle += 0.04;
          const fixedOrbit = 55 + (p.orbitRadius % 25);
          p.x = centerX + Math.cos(p.angle) * fixedOrbit;
          p.y = centerY + Math.sin(p.angle) * fixedOrbit;
        } else if (state === 'RESPONDING') {
          // Controlled outward expansion wave
          p.orbitRadius = (p.orbitRadius + 0.8) % 120;
          p.angle += p.speed;
          p.x = centerX + Math.cos(p.angle) * p.orbitRadius;
          p.y = centerY + Math.sin(p.angle) * p.orbitRadius;
        } else if (state === 'CANCELLED' || state === 'FAILED') {
          // Particle dissipation outwards
          p.x += p.vx * 3;
          p.y += p.vy * 3;
          p.alpha = Math.max(0, p.alpha - 0.01);
        } else {
          // IDLE: Slow rhythmic breathing
          p.angle += p.speed * 0.8;
          const breathe = Math.sin(time) * 6;
          p.x = centerX + Math.cos(p.angle) * (p.orbitRadius + breathe);
          p.y = centerY + Math.sin(p.angle) * (p.orbitRadius + breathe);
        }

        // Draw particle
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, size]);

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <canvas ref={canvasRef} style={{ width: size, height: size }} />
      <div style={{
        position: 'absolute',
        bottom: 8,
        padding: '4px 12px',
        borderRadius: '12px',
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        backdropFilter: 'blur(8px)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        color: state === 'FAILED' || state === 'CANCELLED' ? '#f87171' : state === 'VERIFYING' ? '#34d399' : '#38bdf8'
      }}>
        {state}
      </div>
    </div>
  );
};
