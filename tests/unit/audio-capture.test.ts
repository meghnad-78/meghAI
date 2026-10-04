import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  AudioCaptureService
} from '../../packages/voice/src/index';
import { PermissionBroker } from '../../packages/permissions/src/index';
import { EventBus } from '../../packages/events/src/index';
import { KillSwitch } from '../../packages/security/src/index';
import { MeghAIServer } from '../../apps/api/src/server';
import type { AudioFrame, MicrophoneState, MeghAIEvent } from '@meghai/shared-types';

describe('Real Windows Native Microphone Capture Subsystem', () => {
  let eventBus: EventBus;
  let permissionBroker: PermissionBroker;

  beforeEach(() => {
    KillSwitch.reset();
    eventBus = new EventBus();
    permissionBroker = new PermissionBroker(['c:\\Users']);
  });

  afterEach(() => {
    KillSwitch.reset();
  });

  describe('AudioCaptureService Static Metrics Computation', () => {
    it('computes zero metrics for silent audio buffer', () => {
      const silentBuffer = Buffer.alloc(3200); // 100ms silence
      const metrics = AudioCaptureService.computeAudioMetrics(silentBuffer);
      expect(metrics.rms).toBe(0);
      expect(metrics.peak).toBe(0);
      expect(metrics.normalizedLevel).toBe(0);
    });

    it('computes correct RMS and peak for synthetic square wave samples', () => {
      const buffer = Buffer.alloc(3200);
      const amplitude = 4000;
      for (let i = 0; i < 1600; i++) {
        const val = i % 2 === 0 ? amplitude : -amplitude;
        buffer.writeInt16LE(val, i * 2);
      }
      const metrics = AudioCaptureService.computeAudioMetrics(buffer);
      expect(metrics.rms).toBe(amplitude);
      expect(metrics.peak).toBe(amplitude);
      expect(metrics.normalizedLevel).toBeCloseTo(amplitude / 10000, 2);
    });

    it('caps normalizedLevel at 1.0 for loud samples exceeding 10000 RMS', () => {
      const buffer = Buffer.alloc(3200);
      for (let i = 0; i < 1600; i++) {
        buffer.writeInt16LE(25000, i * 2);
      }
      const metrics = AudioCaptureService.computeAudioMetrics(buffer);
      expect(metrics.normalizedLevel).toBe(1.0);
      expect(metrics.peak).toBe(25000);
    });

    it('handles empty buffers gracefully', () => {
      const emptyBuffer = Buffer.alloc(0);
      const metrics = AudioCaptureService.computeAudioMetrics(emptyBuffer);
      expect(metrics.rms).toBe(0);
      expect(metrics.peak).toBe(0);
      expect(metrics.normalizedLevel).toBe(0);
    });
  });

  describe('AudioCaptureService Lifecycle and AudioFrame Contract', () => {
    let captureService: AudioCaptureService;

    afterEach(async () => {
      if (captureService) {
        await captureService.stop('Test cleanup');
      }
    });

    it('initializes in MIC_OFF state and reports isCapturing=false', () => {
      captureService = new AudioCaptureService({ mockCapture: true });
      expect(captureService.getState()).toBe('MIC_OFF');
      expect(captureService.isCapturing()).toBe(false);
    });

    it('enumerates available audio input devices', async () => {
      captureService = new AudioCaptureService();
      const devices = await captureService.listInputDevices();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      expect(devices[0].name).toBeDefined();
      expect(typeof devices[0].channels).toBe('number');
    }, 15000);

    it('starts capturing and emits exact 100ms 16kHz mono 16-bit PCM frames', async () => {
      captureService = new AudioCaptureService({
        permissionBroker,
        eventBus,
        mockCapture: true
      });

      const receivedFrames: AudioFrame[] = [];
      captureService.onFrame(frame => {
        receivedFrames.push(frame);
      });

      await captureService.start();
      expect(captureService.getState()).toBe('MIC_LISTENING');
      expect(captureService.isCapturing()).toBe(true);

      // Wait for at least 3 frames (300-400ms)
      await new Promise(resolve => setTimeout(resolve, 450));

      expect(receivedFrames.length).toBeGreaterThanOrEqual(2);

      const firstFrame = receivedFrames[0];
      expect(firstFrame.sampleRate).toBe(16000);
      expect(firstFrame.channels).toBe(1);
      expect(firstFrame.format).toBe('pcm_s16le');
      expect(firstFrame.durationMs).toBe(100);
      expect(firstFrame.data).toBeInstanceOf(Buffer);
      expect(firstFrame.data.length).toBe(3200); // 1600 samples * 2 bytes
      expect(firstFrame.sequenceNumber).toBe(1);
      expect(typeof firstFrame.rms).toBe('number');
      expect(typeof firstFrame.peak).toBe('number');
      expect(typeof firstFrame.normalizedLevel).toBe('number');

      // Sequence numbers strictly increase
      for (let i = 1; i < receivedFrames.length; i++) {
        expect(receivedFrames[i].sequenceNumber).toBe(receivedFrames[i - 1].sequenceNumber + 1);
      }

      // Check diagnostics
      const diag = captureService.getDiagnostics();
      expect(diag.isLive).toBe(true);
      expect(diag.sampleRate).toBe(16000);
      expect(diag.channels).toBe(1);
      expect(diag.format).toBe('pcm_s16le');
      expect(diag.frameCount).toBeGreaterThanOrEqual(receivedFrames.length);
      expect(diag.totalBytes).toBeGreaterThanOrEqual(receivedFrames.length * 3200);

      await captureService.stop('Test complete');
      expect(captureService.getState()).toBe('MIC_OFF');
      expect(captureService.isCapturing()).toBe(false);
    });

    it('publishes lifecycle and throttled level events to EventBus', async () => {
      const busEvents: MeghAIEvent[] = [];
      eventBus.subscribe('*', evt => {
        if (evt.type.startsWith('MIC_')) {
          busEvents.push(evt);
        }
      });

      captureService = new AudioCaptureService({
        permissionBroker,
        eventBus,
        mockCapture: true
      });

      await captureService.start();
      await new Promise(resolve => setTimeout(resolve, 250));
      await captureService.stop('Normal user stop');

      const eventTypes = busEvents.map(e => e.type);
      expect(eventTypes).toContain('MIC_STARTING');
      expect(eventTypes).toContain('MIC_LISTENING');
      expect(eventTypes).toContain('MIC_LEVEL');
      expect(eventTypes).toContain('MIC_STOPPING');
      expect(eventTypes).toContain('MIC_OFF');
    });

    it('refuses start and transitions to MIC_ERROR when MICROPHONE permission is denied', async () => {
      permissionBroker.revoke('MICROPHONE');

      captureService = new AudioCaptureService({
        permissionBroker,
        eventBus,
        mockCapture: true
      });

      await expect(captureService.start()).rejects.toThrow(/permission denied/i);
      expect(captureService.getState()).toBe('MIC_ERROR');
      expect(captureService.isCapturing()).toBe(false);
    });

    it('handles multiple repeated start and stop calls gracefully', async () => {
      captureService = new AudioCaptureService({ mockCapture: true });

      await captureService.start();
      expect(captureService.getState()).toBe('MIC_LISTENING');

      // Calling start again while listening should be a no-op
      await captureService.start();
      expect(captureService.getState()).toBe('MIC_LISTENING');

      const stopped1 = await captureService.stop();
      expect(stopped1).toBe(true);
      expect(captureService.getState()).toBe('MIC_OFF');

      // Calling stop again should return false cleanly without error
      const stopped2 = await captureService.stop();
      expect(stopped2).toBe(false);
      expect(captureService.getState()).toBe('MIC_OFF');
    });
  });

  describe('Server API Endpoints Integration', () => {
    let server: MeghAIServer;
    let baseUrl: string;
    let actualPort: number;

    beforeEach(async () => {
      server = new MeghAIServer(':memory:');
      actualPort = await server.start(0);
      baseUrl = `http://localhost:${actualPort}`;
    });

    afterEach(async () => {
      if (server.audioCapture.isCapturing()) {
        await server.audioCapture.stop('Server teardown');
      }
      await server.stop();
    });

    it('GET /api/v1/voice/mic/devices returns list of input devices', async () => {
      const res = await fetch(`${baseUrl}/api/v1/voice/mic/devices`);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(Array.isArray(data.devices)).toBe(true);
      expect(data.devices.length).toBeGreaterThan(0);
      expect(data.count).toBe(data.devices.length);
    });

    it('GET /api/v1/voice/mic/status returns microphone state and diagnostics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/voice/mic/status`);
      expect(res.status).toBe(200);
      const data = await res.json() as any;
      expect(data.state).toBe('MIC_OFF');
      expect(data.isCapturing).toBe(false);
      expect(data.diagnostics).toBeDefined();
      expect(data.diagnostics.sampleRate).toBe(16000);
      expect(data.diagnostics.channels).toBe(1);
    });

    it('POST /api/v1/voice/mic/start and stop toggles capture state', async () => {
      // Start microphone capture
      const startRes = await fetch(`${baseUrl}/api/v1/voice/mic/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      expect(startRes.status).toBe(200);
      const startData = await startRes.json() as any;
      expect(startData.success).toBe(true);
      expect(startData.state).toBe('MIC_LISTENING');
      expect(startData.isCapturing).toBe(true);

      // Verify status endpoint reflects LISTENING
      const statusRes = await fetch(`${baseUrl}/api/v1/voice/mic/status`);
      const statusData = await statusRes.json() as any;
      expect(statusData.state).toBe('MIC_LISTENING');
      expect(statusData.isCapturing).toBe(true);

      // Stop microphone capture
      const stopRes = await fetch(`${baseUrl}/api/v1/voice/mic/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'API test stop' })
      });
      expect(stopRes.status).toBe(200);
      const stopData = await stopRes.json() as any;
      expect(stopData.success).toBe(true);
      expect(stopData.state).toBe('MIC_OFF');
      expect(stopData.isCapturing).toBe(false);
    }, 15000);

    it('emergency kill switch halts active microphone capture immediately', async () => {
      // Start capture
      await fetch(`${baseUrl}/api/v1/voice/mic/start`, { method: 'POST' });
      expect(server.audioCapture.isCapturing()).toBe(true);

      // Trigger STOP MEGH emergency kill switch
      const killRes = await fetch(`${baseUrl}/api/v1/system/kill`, { method: 'POST' });
      expect(killRes.status).toBe(200);

      // Verify microphone capture was halted immediately
      expect(server.audioCapture.isCapturing()).toBe(false);
      expect(server.audioCapture.getState()).toBe('MIC_OFF');

      const statusRes = await fetch(`${baseUrl}/api/v1/voice/mic/status`);
      const statusData = await statusRes.json() as any;
      expect(statusData.state).toBe('MIC_OFF');
      expect(statusData.isCapturing).toBe(false);
    });
  });
});
