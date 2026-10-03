import React, { useEffect, useRef } from 'react';
import type { AIState, VoiceInputState } from '@meghai/shared-types';

interface AICoreProps {
  state: AIState;
  size?: number;
  micLevel?: number;
  voiceInputState?: VoiceInputState;
  personalityStyle?: string; // 'precise' | 'soft' | 'orbital' | 'breathing' | 'minimal'
  toolExecuting?: string | null;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  baseRadius: number;
  radius: number;
  alpha: number;
  targetAlpha: number;
  angle: number;
  orbitRadius: number;
  orbitSpeed: number;
  layer: number;
  color: string;
}

/**
 * MeghAI Signature State-Reactive AI Core (Sections 32-45, 60, 61)
 * Multi-layer physically-grounded particle system, neural filaments,
 * audio-reactive waveforms, and personality visual mapping.
 */
export const AICore: React.FC<AICoreProps> = ({
  state,
  size = 280,
  micLevel = 0,
  voiceInputState = 'IDLE',
  personalityStyle = 'orbital',
  toolExecuting = null
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    const width = size;
    const height = size;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const centerX = width / 2;
    const centerY = height / 2;
    const particleCount = prefersReducedMotion ? 35 : personalityStyle === 'minimal' ? 60 : 190;
    const particles: Particle[] = [];

    // State & Personality Color Palettes
    const getThemeColors = () => {
      if (voiceInputState === 'WAKE_CONFIRMED' || voiceInputState === 'WAKE_DETECTED' || (voiceInputState as any) === 'ACTIVATION') {
        return {
          primary: 'rgba(0, 240, 255, ',
          secondary: 'rgba(56, 189, 248, ',
          glow: 'rgba(0, 240, 255, 0.45)',
          pulseRate: 3.5
        };
      }
      if (voiceInputState === 'COMMAND_CAPTURE' || voiceInputState === 'COMMAND_LISTENING' || state === 'LISTENING') {
        return {
          primary: 'rgba(0, 240, 255, ',
          secondary: 'rgba(16, 185, 129, ',
          glow: 'rgba(0, 240, 255, 0.38)',
          pulseRate: 2.2
        };
      }
      if (voiceInputState === 'TRANSCRIBING') {
        return {
          primary: 'rgba(245, 158, 11, ',
          secondary: 'rgba(251, 191, 36, ',
          glow: 'rgba(245, 158, 11, 0.32)',
          pulseRate: 3.0
        };
      }

      switch (state) {
        case 'ROUTING':
        case 'PLANNING':
          return {
            primary: 'rgba(168, 85, 247, ',
            secondary: 'rgba(139, 92, 246, ',
            glow: 'rgba(168, 85, 247, 0.38)',
            pulseRate: 4.0
          };
        case 'RESPONDING':
          return {
            primary: 'rgba(56, 189, 248, ',
            secondary: 'rgba(168, 85, 247, ',
            glow: 'rgba(56, 189, 248, 0.35)',
            pulseRate: 3.2
          };
        case 'SPEAKING':
          return {
            primary: 'rgba(192, 132, 252, ',
            secondary: 'rgba(0, 240, 255, ',
            glow: 'rgba(192, 132, 252, 0.38)',
            pulseRate: 2.8
          };
        case 'EXECUTING':
          return {
            primary: 'rgba(59, 130, 246, ',
            secondary: 'rgba(16, 185, 129, ',
            glow: 'rgba(59, 130, 246, 0.35)',
            pulseRate: 2.6
          };
        case 'VERIFYING':
          return {
            primary: 'rgba(16, 185, 129, ',
            secondary: 'rgba(52, 211, 153, ',
            glow: 'rgba(16, 185, 129, 0.4)',
            pulseRate: 1.8
          };
        case 'FAILED':
        case 'CANCELLED':
          return {
            primary: 'rgba(239, 68, 68, ',
            secondary: 'rgba(248, 113, 113, ',
            glow: 'rgba(239, 68, 68, 0.25)',
            pulseRate: 1.0
          };
        case 'READY':
        default:
          if (personalityStyle === 'precise') {
            return {
              primary: 'rgba(56, 189, 248, ',
              secondary: 'rgba(148, 163, 184, ',
              glow: 'rgba(56, 189, 248, 0.2)',
              pulseRate: 1.1
            };
          }
          if (personalityStyle === 'soft') {
            return {
              primary: 'rgba(52, 211, 153, ',
              secondary: 'rgba(56, 189, 248, ',
              glow: 'rgba(52, 211, 153, 0.18)',
              pulseRate: 1.0
            };
          }
          if (personalityStyle === 'breathing') {
            return {
              primary: 'rgba(96, 165, 250, ',
              secondary: 'rgba(147, 197, 253, ',
              glow: 'rgba(96, 165, 250, 0.15)',
              pulseRate: 0.8
            };
          }
          if (personalityStyle === 'minimal') {
            return {
              primary: 'rgba(203, 213, 225, ',
              secondary: 'rgba(148, 163, 184, ',
              glow: 'rgba(203, 213, 225, 0.12)',
              pulseRate: 0.9
            };
          }
          // Default: orbital (futuristic companion)
          return {
            primary: 'rgba(0, 240, 255, ',
            secondary: 'rgba(168, 85, 247, ',
            glow: 'rgba(0, 240, 255, 0.2)',
            pulseRate: 1.3
          };
      }
    };

    // Initialize multi-tier particle orbits
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const layer = Math.floor(Math.random() * 3);
      const orbitBase = layer === 0 ? 25 + Math.random() * 30 : layer === 1 ? 55 + Math.random() * 45 : 100 + Math.random() * 35;
      const theme = getThemeColors();

      particles.push({
        x: centerX + Math.cos(angle) * orbitBase,
        y: centerY + Math.sin(angle) * orbitBase,
        z: Math.random() * 2 - 1,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.01,
        baseRadius: layer === 0 ? 1.0 + Math.random() * 1.4 : layer === 1 ? 1.4 + Math.random() * 1.8 : 0.8 + Math.random() * 1.2,
        radius: 1.5,
        alpha: layer === 2 ? 0.2 + Math.random() * 0.3 : 0.4 + Math.random() * 0.5,
        targetAlpha: 0.8,
        angle,
        orbitRadius: orbitBase,
        orbitSpeed: (0.006 + Math.random() * 0.012) * (layer === 0 ? 1.4 : layer === 1 ? 1.0 : 0.6) * (Math.random() > 0.5 ? 1 : -1),
        layer,
        color: layer === 1 && Math.random() > 0.6 ? theme.secondary : theme.primary
      });
    }

    let time = 0;

    const render = () => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      time += 0.016;
      ctx.clearRect(0, 0, width, height);

      const theme = getThemeColors();
      const isListening = state === 'LISTENING' || voiceInputState === 'COMMAND_CAPTURE' || voiceInputState === 'COMMAND_LISTENING';
      const isTranscribing = voiceInputState === 'TRANSCRIBING';
      const isThinking = state === 'ROUTING' || state === 'PLANNING' || state === 'RESPONDING';
      const isExecuting = state === 'EXECUTING' || !!toolExecuting;
      const isSpeaking = state === 'SPEAKING';
      const isWake = voiceInputState === 'WAKE_CONFIRMED' || voiceInputState === 'WAKE_DETECTED' || (voiceInputState as any) === 'ACTIVATION';
      const effectiveMicRms = Math.min(1.0, micLevel * 2.5);

      // --- LAYER 1: Deep Atmospheric Ambient Light Field ---
      const outerGlow = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, width * 0.48);
      outerGlow.addColorStop(0, `${theme.primary}0.16)`);
      outerGlow.addColorStop(0.35, `${theme.secondary}0.06)`);
      outerGlow.addColorStop(0.7, `${theme.primary}0.015)`);
      outerGlow.addColorStop(1, 'rgba(4, 6, 10, 0)');

      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, width * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // --- LAYER 2: Inner Resonant Energy Core ---
      const coreBreath = prefersReducedMotion ? 0 : Math.sin(time * theme.pulseRate) * (isThinking ? 6 : 3);
      const audioExpansion = isListening ? effectiveMicRms * 22 : isSpeaking ? Math.sin(time * 6) * 10 : 0;
      const coreRadius = Math.max(18, 32 + coreBreath + audioExpansion);

      const coreGlow = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, coreRadius * 2);
      coreGlow.addColorStop(0, `${theme.primary}0.55)`);
      coreGlow.addColorStop(0.4, `${theme.primary}0.2)`);
      coreGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, coreRadius * 2, 0, Math.PI * 2);
      ctx.fill();

      // --- LAYER 3: Precision Orbital Frequency Rings ---
      ctx.save();
      const ringCount = isThinking ? 3 : 2;
      for (let r = 0; r < ringCount; r++) {
        const ringRadius = coreRadius + (r + 1) * (isThinking ? 22 : 28);
        const rotationSpeed = (r % 2 === 0 ? 1 : -1) * (isThinking ? 0.02 : 0.008);
        const ringAngle = time * rotationSpeed * 10;

        ctx.strokeStyle = `${theme.primary}${0.18 - r * 0.05})`;
        ctx.lineWidth = 1;
        ctx.setLineDash(r === 0 ? [3, 8] : [2, 14]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, ringAngle, ringAngle + Math.PI * 1.8);
        ctx.stroke();
      }
      ctx.restore();

      // --- LAYER 4: Acoustic Waveform Ring (When Active Listening / Speaking) ---
      if (isListening || isSpeaking) {
        ctx.save();
        ctx.beginPath();
        const waveSegments = 48;
        const waveBaseRadius = coreRadius + 18;
        const waveAmp = isListening ? Math.max(4, effectiveMicRms * 24) : 8;

        for (let s = 0; s <= waveSegments; s++) {
          const theta = (s / waveSegments) * Math.PI * 2;
          const noise = Math.sin(theta * 7 + time * 12) * Math.cos(theta * 3 - time * 8);
          const r = waveBaseRadius + noise * waveAmp;
          const wx = centerX + Math.cos(theta) * r;
          const wy = centerY + Math.sin(theta) * r;
          if (s === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.closePath();
        ctx.strokeStyle = `${theme.primary}0.6)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      // --- LAYER 5: Directional Data Stream Flow (During STT Transcribing) ---
      if (isTranscribing && !prefersReducedMotion) {
        ctx.save();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 1.2;
        const streamCount = 6;
        for (let s = 0; s < streamCount; s++) {
          const baseA = (s / streamCount) * Math.PI * 2 + time * 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, coreRadius + 12 + s * 8, baseA, baseA + Math.PI * 0.4);
          ctx.stroke();
        }
        ctx.restore();
      }

      // --- LAYER 6: Tool/Agent Localized Execution Trails ---
      if (isExecuting && !prefersReducedMotion) {
        ctx.save();
        const nodeAngle = time * 1.5;
        const nodeDist = coreRadius + 45;
        const nodeX = centerX + Math.cos(nodeAngle) * nodeDist;
        const nodeY = centerY + Math.sin(nodeAngle) * nodeDist;

        // Trail from center to node
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(nodeX, nodeY);
        ctx.stroke();

        // Node circle
        ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- LAYER 7: Neural Connection Filaments (During Model Inference) ---
      if (isThinking && !prefersReducedMotion) {
        ctx.save();
        ctx.lineWidth = 0.6;
        for (let i = 0; i < 40; i++) {
          const p1 = particles[i];
          for (let j = i + 1; j < 40; j++) {
            const p2 = particles[j];
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            if (dist < 46) {
              const alpha = (1 - dist / 46) * 0.28;
              ctx.strokeStyle = `${theme.primary}${alpha})`;
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      // --- LAYER 8: Particles Simulation & Rendering ---
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.color = i % 3 === 0 ? theme.secondary : theme.primary;

        if (!prefersReducedMotion) {
          if (isWake) {
            p.orbitRadius = Math.max(20, p.orbitRadius - 1.2);
            p.angle += p.orbitSpeed * 2.5;
          } else if (isListening) {
            p.angle += p.orbitSpeed * 1.5;
            const acousticDisplace = Math.sin(time * 10 + p.angle * 4) * (effectiveMicRms * 12);
            p.orbitRadius = Math.max(25, p.orbitRadius + (acousticDisplace * 0.05));
          } else if (isThinking) {
            p.angle += p.orbitSpeed * (p.layer === 0 ? 3.5 : 2.2);
            p.orbitRadius = (p.orbitRadius + Math.sin(time * 3 + p.angle) * 0.4);
          } else if (isSpeaking) {
            p.angle += p.orbitSpeed * 1.2;
            const speakWave = Math.sin(time * 4 - p.orbitRadius * 0.08) * 6;
            p.orbitRadius = Math.max(24, p.orbitRadius + (speakWave * 0.05));
          } else {
            p.angle += p.orbitSpeed * 0.7;
          }

          const breathOffset = Math.sin(time * 1.2 + p.angle) * (isThinking ? 4 : 2);
          const currentRadius = p.orbitRadius + breathOffset;
          p.x = centerX + Math.cos(p.angle) * currentRadius;
          p.y = centerY + Math.sin(p.angle) * currentRadius;
        }

        const depthAlpha = p.alpha * (0.6 + (p.z + 1) * 0.2);
        ctx.fillStyle = `${p.color}${Math.max(0.1, Math.min(1.0, depthAlpha))})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.baseRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [state, size, micLevel, voiceInputState, personalityStyle, toolExecuting]);

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: size,
          height: size,
          display: 'block'
        }}
      />
    </div>
  );
};
