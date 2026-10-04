import React, { useEffect, useRef } from 'react';
import type { AIState, VoiceInputState } from '@meghai/shared-types';

interface AmbientBackgroundProps {
  aiState: AIState;
  voiceInputState: VoiceInputState;
  micLevel?: number;
}

interface AmbientParticle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

export const AmbientBackground: React.FC<AmbientBackgroundProps> = ({
  aiState,
  voiceInputState,
  micLevel = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Global Pointer Coordinates & Velocity with Spring Inertia
    let targetPointerX = width / 2;
    let targetPointerY = height / 2;
    let smoothedPointerX = targetPointerX;
    let smoothedPointerY = targetPointerY;
    let lastRawPointerX = targetPointerX;
    let lastRawPointerY = targetPointerY;
    let pointerVelocity = 0;
    let smoothedVelocity = 0;

    const handleMouseMove = (e: MouseEvent) => {
      targetPointerX = e.clientX;
      targetPointerY = e.clientY;

      const dx = targetPointerX - lastRawPointerX;
      const dy = targetPointerY - lastRawPointerY;
      const dist = Math.hypot(dx, dy);
      pointerVelocity = Math.min(25, dist);
      lastRawPointerX = targetPointerX;
      lastRawPointerY = targetPointerY;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Initialize Subtle Ambient Particles
    const count = prefersReducedMotion ? 20 : 65;
    const particles: AmbientParticle[] = [];
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      particles.push({
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        size: 0.65 + Math.random() * 0.85,
        alpha: 0.08 + Math.random() * 0.16,
        phase: Math.random() * Math.PI * 2
      });
    }

    let time = 0;

    const render = () => {
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }

      time += 0.012;
      ctx.clearRect(0, 0, width, height);

      // Spring Interpolation for Pointer
      const spring = 0.06;
      smoothedPointerX += (targetPointerX - smoothedPointerX) * spring;
      smoothedPointerY += (targetPointerY - smoothedPointerY) * spring;

      // Pointer Velocity Decay
      pointerVelocity *= 0.88;
      smoothedVelocity += (pointerVelocity - smoothedVelocity) * 0.1;

      // State Influences
      const isListening = aiState === 'LISTENING' || voiceInputState === 'COMMAND_CAPTURE' || voiceInputState === 'COMMAND_LISTENING';
      const isSpeaking = aiState === 'SPEAKING';
      const isThinking = aiState === 'ROUTING' || aiState === 'PLANNING' || aiState === 'RESPONDING';
      const acousticEnergy = isListening ? Math.min(1.0, micLevel * 2.5) : isSpeaking ? 0.4 : 0;

      // 1. Atmospheric Baseline Fill
      ctx.fillStyle = '#07080a';
      ctx.fillRect(0, 0, width, height);

      // 2. Distant Depth Contours (Very subtle geometric field lines)
      ctx.save();
      ctx.lineWidth = 0.5;
      const gridSpacing = 160;
      const startX = 0;
      const startY = 0;

      for (let gx = startX; gx < width; gx += gridSpacing) {
        const dx = smoothedPointerX - gx;
        const distFromPointer = Math.abs(dx);
        const bend = distFromPointer < 220 ? ((220 - distFromPointer) / 220) * (smoothedVelocity * 0.4 + 2) : 0;
        const dir = dx > 0 ? 1 : -1;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.quadraticCurveTo(gx + bend * dir, smoothedPointerY, gx, height);
        ctx.stroke();
      }

      for (let gy = startY; gy < height; gy += gridSpacing) {
        const dy = smoothedPointerY - gy;
        const distFromPointer = Math.abs(dy);
        const bend = distFromPointer < 220 ? ((220 - distFromPointer) / 220) * (smoothedVelocity * 0.4 + 2) : 0;
        const dir = dy > 0 ? 1 : -1;

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.quadraticCurveTo(smoothedPointerX, gy + bend * dir, width, gy);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Ambient Particles (Responsive to Pointer Velocity & Audio)
      ctx.save();
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          // Boundary Wrap
          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          // Pointer Field Displacement with Inertia
          const pdx = p.x - smoothedPointerX;
          const pdy = p.y - smoothedPointerY;
          const pdist = Math.hypot(pdx, pdy);
          const influenceRadius = 140 + smoothedVelocity * 4;

          if (pdist < influenceRadius && pdist > 0.1) {
            const force = (1 - pdist / influenceRadius) * (0.8 + smoothedVelocity * 0.15);
            p.x += (pdx / pdist) * force;
            p.y += (pdy / pdist) * force;
          }

          // Subtle Acoustic Displacement when active
          if (acousticEnergy > 0.05) {
            p.x += Math.sin(time * 8 + p.phase) * (acousticEnergy * 0.4);
            p.y += Math.cos(time * 8 + p.phase) * (acousticEnergy * 0.4);
          }
        }

        const breatheAlpha = p.alpha + Math.sin(time + p.phase) * 0.04;
        const finalAlpha = Math.max(0.02, Math.min(0.35, breatheAlpha + (isThinking ? 0.05 : 0)));

        ctx.fillStyle = isThinking
          ? `rgba(122, 142, 163, ${finalAlpha})`
          : `rgba(230, 233, 238, ${finalAlpha})`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 4. Very Faint Pointer Luminance Interaction Trail (Expensive, Non-Glowing)
      if (!prefersReducedMotion) {
        ctx.save();
        const pointerField = ctx.createRadialGradient(
          smoothedPointerX, smoothedPointerY, 0,
          smoothedPointerX, smoothedPointerY, 180 + smoothedVelocity * 6
        );
        pointerField.addColorStop(0, 'rgba(79, 168, 181, 0.025)');
        pointerField.addColorStop(0.5, 'rgba(79, 168, 181, 0.008)');
        pointerField.addColorStop(1, 'rgba(7, 8, 10, 0)');

        ctx.fillStyle = pointerField;
        ctx.beginPath();
        ctx.arc(smoothedPointerX, smoothedPointerY, 180 + smoothedVelocity * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [aiState, voiceInputState, micLevel]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
};
