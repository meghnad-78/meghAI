// Live verification script for Windows native microphone capture
import http from 'node:http';

async function main() {
  console.log('=== MeghAI Real Windows Microphone Capture Live Verification ===\n');

  // 1. Health check
  console.log('1. Checking API Server Health...');
  const healthRes = await fetch('http://localhost:4820/api/v1/health');
  if (!healthRes.ok) {
    throw new Error(`API health check failed with status ${healthRes.status}`);
  }
  const healthData = await healthRes.json();
  console.log(`✓ API Server is online. AI State: ${healthData.aiState}`);

  // 2. Discover Input Devices
  console.log('\n2. Enumerating Windows Audio Input Devices...');
  const devRes = await fetch('http://localhost:4820/api/v1/voice/mic/devices');
  const devData = await devRes.json();
  console.log(`✓ Detected ${devData.count} input device(s):`);
  for (const d of devData.devices) {
    console.log(`   - [ID ${d.id}] ${d.name} (${d.channels} ch)`);
  }

  // 3. Initial Status
  console.log('\n3. Checking Initial Microphone Status...');
  const statusRes = await fetch('http://localhost:4820/api/v1/voice/mic/status');
  const statusData = await statusRes.json();
  console.log(`✓ Current State: ${statusData.state}, isCapturing: ${statusData.isCapturing}`);

  // 4. Start Microphone Capture
  console.log('\n4. Starting Real Windows Microphone Capture (waveIn / WASAPI)...');
  const startRes = await fetch('http://localhost:4820/api/v1/voice/mic/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  if (!startRes.ok) {
    const errData = await startRes.json();
    throw new Error(`Microphone start failed: ${errData.error}`);
  }
  const startData = await startRes.json();
  console.log(`✓ Start Response: state=${startData.state}, device=${startData.diagnostics?.activeDevice}`);

  // 5. Capture Live Frames for 2.5 seconds
  console.log('\n5. Capturing live acoustic frames from default Windows microphone for 2.5s...');
  const sampleMetrics = [];

  for (let i = 0; i < 5; i++) {
    await new Promise(r => setTimeout(r, 500));
    const sRes = await fetch('http://localhost:4820/api/v1/voice/mic/status');
    const sData = await sRes.json();
    const d = sData.diagnostics;
    sampleMetrics.push(d);
    console.log(`   [Snapshot ${i + 1}] Frames: ${d.frameCount}, Bytes: ${d.totalBytes}, RMS: ${d.currentRms}, Peak: ${d.peakLevel}, Level: ${(d.normalizedLevel * 100).toFixed(1)}%`);
  }

  // 6. Stop Microphone Capture
  console.log('\n6. Stopping Microphone Capture...');
  const stopRes = await fetch('http://localhost:4820/api/v1/voice/mic/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Verification complete' })
  });
  const stopData = await stopRes.json();
  console.log(`✓ Stop Response: state=${stopData.state}, isCapturing=${stopData.isCapturing}`);

  // 7. Final Diagnostics
  const finalStatusRes = await fetch('http://localhost:4820/api/v1/voice/mic/status');
  const finalStatus = await finalStatusRes.json();
  console.log('\n7. Final Subsystem Diagnostics:');
  console.log(`   - Final State: ${finalStatus.state}`);
  console.log(`   - Sample Rate: ${finalStatus.diagnostics.sampleRate} Hz`);
  console.log(`   - Channels: ${finalStatus.diagnostics.channels} (mono)`);
  console.log(`   - Format: ${finalStatus.diagnostics.format}`);
  console.log(`   - Total Frames Captured: ${finalStatus.diagnostics.frameCount}`);
  console.log(`   - Total Bytes: ${finalStatus.diagnostics.totalBytes} bytes (${(finalStatus.diagnostics.totalBytes / 1024).toFixed(1)} KB)`);
  console.log(`   - Active Device: ${finalStatus.diagnostics.activeDevice}`);

  if (finalStatus.diagnostics.frameCount > 0 && finalStatus.diagnostics.totalBytes > 0) {
    console.log('\n======================================================');
    console.log('✅ REAL WINDOWS MICROPHONE CAPTURE VERIFIED SUCCESSFULLY!');
    console.log('======================================================\n');
  } else {
    throw new Error('Verification failed: no frames were captured.');
  }
}

main().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
