import React, { useEffect, useRef } from 'react';
import type { AIState, VoiceInputState } from '@meghai/shared-types';

interface AICoreProps {
  state: AIState;
  size?: number;
  micLevel?: number;
  voiceInputState?: VoiceInputState;
  personalityStyle?: string; // 'precise' | 'soft' | 'orbital' | 'breathing' | 'technical' | 'network' | 'dynamic' | 'minimal'
  toolExecuting?: string | null;
}

interface ParticleStream {
  angle: number;
  radius: number;
  baseRadius: number;
  speed: number;
  size: number;
  alpha: number;
  layer: number;
  decay: number;
}

/**
 * MeghAI Signature Computational AI Core
 * Multi-layer generative topology, vector flow field, resonant audio deformation,
 * and state-driven algorithmic convergence.
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

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animId: number;
    const width = size;
    const height = size;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const cx = width / 2;
    const cy = height / 2;

    // Multi-tier stream particles
    const streamCount = prefersReducedMotion ? 30 : personalityStyle === 'minimal' ? 45 : 120;
    const streams: ParticleStream[] = [];
    for (let i = 0; i < streamCount; i++) {
      const layer = i % 3; // 0: inner core, 1: midground flow, 2: outer horizon
      const baseR = layer === 0 ? 22 + Math.random() * 26 : layer === 1 ? 52 + Math.random() * 40 : 96 + Math.random() * 32;
      streams.push({
        angle: Math.random() * Math.PI * 2,
        radius: baseR,
        baseRadius: baseR,
        speed: (0.005 + Math.random() * 0.01) * (layer === 0 ? 1.4 : layer === 1 ? 0.9 : 0.5) * (i % 2 === 0 ? 1 : -1),
        size: layer === 0 ? 1.0 + Math.random() * 0.8 : layer === 1 ? 1.2 + Math.random() * 1.0 : 0.75 + Math.random() * 0.75,
        alpha: layer === 2 ? 0.15 + Math.random() * 0.2 : 0.35 + Math.random() * 0.45,
        layer,
        decay: Math.random() * 0.02
      });
    }

    let time = 0;

    // Color Palette Resolution (Restrained Mineral Steel Teal Architecture)
    const getPalette = () => {
      // Wake & Activation
      if (voiceInputState === 'WAKE_CONFIRMED' || voiceInputState === 'WAKE_DETECTED' || (voiceInputState as any) === 'ACTIVATION') {
        return {
          stroke: 'rgba(92, 184, 197, ',
          fill: 'rgba(79, 168, 181, ',
          highlight: 'rgba(230, 233, 238, 0.85)',
          speedMultiplier: 2.8,
          corePulse: 4.2
        };
      }
      // Listening
      if (voiceInputState === 'COMMAND_CAPTURE' || voiceInputState === 'COMMAND_LISTENING' || state === 'LISTENING') {
        return {
          stroke: 'rgba(92, 184, 197, ',
          fill: 'rgba(79, 168, 181, ',
          highlight: 'rgba(180, 220, 228, 0.7)',
          speedMultiplier: 1.5,
          corePulse: 2.2
        };
      }
      // Transcribing
      if (voiceInputState === 'TRANSCRIBING') {
        return {
          stroke: 'rgba(198, 153, 74, ',
          fill: 'rgba(198, 153, 74, ',
          highlight: 'rgba(230, 200, 140, 0.75)',
          speedMultiplier: 2.2,
          corePulse: 3.0
        };
      }
      // Model Thinking & Planning
      if (state === 'ROUTING' || state === 'PLANNING' || state === 'RESPONDING') {
        return {
          stroke: 'rgba(122, 142, 163, ',
          fill: 'rgba(92, 143, 168, ',
          highlight: 'rgba(210, 220, 230, 0.7)',
          speedMultiplier: 3.2,
          corePulse: 3.6
        };
      }
      // Speaking
      if (state === 'SPEAKING') {
        return {
          stroke: 'rgba(133, 155, 176, ',
          fill: 'rgba(79, 168, 181, ',
          highlight: 'rgba(200, 220, 235, 0.8)',
          speedMultiplier: 1.8,
          corePulse: 2.6
        };
      }
      // Executing Tool
      if (state === 'EXECUTING' || !!toolExecuting) {
        return {
          stroke: 'rgba(92, 143, 168, ',
          fill: 'rgba(88, 158, 124, ',
          highlight: 'rgba(180, 225, 205, 0.75)',
          speedMultiplier: 2.0,
          corePulse: 2.5
        };
      }
      // Error
      if (state === 'FAILED' || state === 'CANCELLED') {
        return {
          stroke: 'rgba(191, 80, 73, ',
          fill: 'rgba(191, 80, 73, ',
          highlight: 'rgba(235, 170, 165, 0.65)',
          speedMultiplier: 0.6,
          corePulse: 1.0
        };
      }
      // Idle / Default based on Personality
      if (personalityStyle === 'technical') {
        return {
          stroke: 'rgba(122, 142, 163, ',
          fill: 'rgba(79, 168, 181, ',
          highlight: 'rgba(220, 225, 232, 0.5)',
          speedMultiplier: 0.9,
          corePulse: 1.2
        };
      }
      if (personalityStyle === 'soft') {
        return {
          stroke: 'rgba(88, 158, 124, ',
          fill: 'rgba(79, 168, 181, ',
          highlight: 'rgba(200, 230, 215, 0.45)',
          speedMultiplier: 0.7,
          corePulse: 0.9
        };
      }
      if (personalityStyle === 'minimal') {
        return {
          stroke: 'rgba(155, 163, 175, ',
          fill: 'rgba(97, 106, 120, ',
          highlight: 'rgba(230, 233, 238, 0.4)',
          speedMultiplier: 0.5,
          corePulse: 0.7
        };
      }
      // Standard Idle
      return {
        stroke: 'rgba(79, 168, 181, ',
        fill: 'rgba(122, 142, 163, ',
        highlight: 'rgba(200, 225, 230, 0.45)',
        speedMultiplier: 0.75,
        corePulse: 1.0
      };
    };

    const render = () => {
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }

      time += 0.014;
      ctx.clearRect(0, 0, width, height);

      const palette = getPalette();
      const isListening = state === 'LISTENING' || voiceInputState === 'COMMAND_CAPTURE' || voiceInputState === 'COMMAND_LISTENING';
      const isTranscribing = voiceInputState === 'TRANSCRIBING';
      const isThinking = state === 'ROUTING' || state === 'PLANNING' || state === 'RESPONDING';
      const isExecuting = state === 'EXECUTING' || !!toolExecuting;
      const isSpeaking = state === 'SPEAKING';
      const isWake = voiceInputState === 'WAKE_CONFIRMED' || voiceInputState === 'WAKE_DETECTED' || (voiceInputState as any) === 'ACTIVATION';
      const acousticRms = Math.min(1.0, micLevel * 2.8);

      // --- LAYER 1: Deep Vector Horizon Mesh (Atmospheric Boundary) ---
      ctx.save();
      ctx.lineWidth = 0.5;
      const ringSteps = personalityStyle === 'minimal' ? 2 : 4;
      for (let r = 1; r <= ringSteps; r++) {
        const rad = 28 + r * 28;
        ctx.strokeStyle = `${palette.stroke}${0.05 - r * 0.008})`;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // --- LAYER 2: Topological Deforming Contours (Flowing Ribbons) ---
      ctx.save();
      const contourCount = isThinking ? 4 : 3;
      for (let c = 0; c < contourCount; c++) {
        const baseRadius = 38 + c * 24;
        const speed = (c % 2 === 0 ? 1 : -1) * (0.4 + c * 0.2);
        const segmentCount = 64;

        ctx.beginPath();
        for (let s = 0; s <= segmentCount; s++) {
          const theta = (s / segmentCount) * Math.PI * 2;
          const harmonic1 = Math.sin(theta * 3 + time * speed * palette.speedMultiplier) * (isThinking ? 6 : 2.5);
          const harmonic2 = Math.cos(theta * 5 - time * 0.8) * (isListening ? acousticRms * 14 : isSpeaking ? 5 : 1.5);
          const r = baseRadius + harmonic1 + harmonic2;
          const px = cx + Math.cos(theta) * r;
          const py = cy + Math.sin(theta) * r;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle = `${palette.stroke}${0.16 - c * 0.03})`;
        ctx.lineWidth = c === 0 ? 1.0 : 0.65;
        ctx.stroke();
      }
      ctx.restore();

      // --- LAYER 3: Central Computational Structure (Geometric Dynamic Engine) ---
      ctx.save();
      const coreBreath = prefersReducedMotion ? 0 : Math.sin(time * palette.corePulse) * (isThinking ? 4.5 : 2.0);
      const acousticShift = isListening ? acousticRms * 16 : isSpeaking ? Math.sin(time * 8) * 6 : 0;
      const coreRadius = Math.max(16, 26 + coreBreath + acousticShift);

      // Rotating Crystalline Arcs
      const arcRotation = time * 0.8 * palette.speedMultiplier;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `${palette.stroke}0.45)`;
      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, arcRotation, arcRotation + Math.PI * 0.8);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius, arcRotation + Math.PI, arcRotation + Math.PI * 1.8);
      ctx.stroke();

      // Inner Precision Axis Nodes
      const axisLen = coreRadius * 0.6;
      ctx.strokeStyle = `${palette.stroke}0.3)`;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(cx - axisLen, cy);
      ctx.lineTo(cx + axisLen, cy);
      ctx.moveTo(cx, cy - axisLen);
      ctx.lineTo(cx, cy + axisLen);
      ctx.stroke();

      // Center Geometric Monolith
      ctx.fillStyle = palette.highlight;
      ctx.beginPath();
      ctx.arc(cx, cy, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- LAYER 4: Acoustic Resonant Field (During Listening or Speaking) ---
      if (isListening || isSpeaking) {
        ctx.save();
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = `${palette.stroke}0.7)`;
        const waveCount = 36;
        const waveBaseR = coreRadius + 14;
        const waveAmp = isListening ? Math.max(3, acousticRms * 22) : 6;

        ctx.beginPath();
        for (let w = 0; w <= waveCount; w++) {
          const a = (w / waveCount) * Math.PI * 2;
          const n = Math.sin(a * 8 + time * 14) * waveAmp;
          const wx = cx + Math.cos(a) * (waveBaseR + n);
          const wy = cy + Math.sin(a) * (waveBaseR + n);
          if (w === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }

      // --- LAYER 5: Directional Stream Filaments (During Transcribing) ---
      if (isTranscribing && !prefersReducedMotion) {
        ctx.save();
        ctx.strokeStyle = 'rgba(198, 153, 74, 0.45)';
        ctx.lineWidth = 1.0;
        const lineCount = 8;
        for (let l = 0; l < lineCount; l++) {
          const startA = (l / lineCount) * Math.PI * 2 + time * 3;
          ctx.beginPath();
          ctx.arc(cx, cy, coreRadius + 8 + l * 6, startA, startA + Math.PI * 0.35);
          ctx.stroke();
        }
        ctx.restore();
      }

      // --- LAYER 6: Tool/Subsystem Directed Arcs (During Real Tool Execution) ---
      if (isExecuting && !prefersReducedMotion) {
        ctx.save();
        const targetA = time * 1.6;
        const targetR = coreRadius + 52;
        const tx = cx + Math.cos(targetA) * targetR;
        const ty = cy + Math.sin(targetA) * targetR;

        ctx.strokeStyle = 'rgba(92, 143, 168, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.fillStyle = 'rgba(92, 143, 168, 0.85)';
        ctx.beginPath();
        ctx.arc(tx, ty, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- LAYER 7: Neural Dynamic Connections (During Model Reasoning) ---
      if (isThinking && !prefersReducedMotion) {
        ctx.save();
        ctx.lineWidth = 0.5;
        const count = Math.min(streams.length, 36);
        for (let i = 0; i < count; i++) {
          const s1 = streams[i];
          const px1 = cx + Math.cos(s1.angle) * s1.radius;
          const py1 = cy + Math.sin(s1.angle) * s1.radius;

          for (let j = i + 1; j < count; j++) {
            const s2 = streams[j];
            const px2 = cx + Math.cos(s2.angle) * s2.radius;
            const py2 = cy + Math.sin(s2.angle) * s2.radius;
            const d = Math.hypot(px1 - px2, py1 - py2);

            if (d < 44) {
              const alpha = (1 - d / 44) * 0.28;
              ctx.strokeStyle = `${palette.stroke}${alpha})`;
              ctx.beginPath();
              ctx.moveTo(px1, py1);
              ctx.lineTo(px2, py2);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
      }

      // --- LAYER 8: Stream Particles Simulation & Spatial Rendering ---
      ctx.save();
      for (let i = 0; i < streams.length; i++) {
        const s = streams[i];

        if (!prefersReducedMotion) {
          if (isWake) {
            s.radius = Math.max(16, s.radius - 1.5);
            s.angle += s.speed * 3.0;
          } else if (isListening) {
            s.angle += s.speed * 1.6;
            const acousticDisplace = Math.sin(time * 12 + s.angle * 4) * (acousticRms * 10);
            s.radius = Math.max(20, s.baseRadius + acousticDisplace);
          } else if (isThinking) {
            s.angle += s.speed * (s.layer === 0 ? 3.8 : 2.2);
            s.radius = s.baseRadius + Math.sin(time * 3 + s.angle) * 3;
          } else if (isSpeaking) {
            s.angle += s.speed * 1.3;
            s.radius = s.baseRadius + Math.sin(time * 5 - s.radius * 0.08) * 4;
          } else {
            s.angle += s.speed * palette.speedMultiplier;
            s.radius = s.baseRadius + Math.sin(time * 1.2 + s.angle) * 1.8;
          }
        }

        const px = cx + Math.cos(s.angle) * s.radius;
        const py = cy + Math.sin(s.angle) * s.radius;

        ctx.fillStyle = `${palette.stroke}${s.alpha})`;
        ctx.beginPath();
        ctx.arc(px, py, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
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
