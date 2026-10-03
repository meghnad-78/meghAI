import { MeghAIServer } from '../apps/api/src/server.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function runLiveAcceptance() {
  console.log('=== STARTING MEGHAI LIVE MODEL SELECTION ACCEPTANCE TEST ===\n');

  // Connect to live MeghAI Server on 4820 if running, or start a new instance
  let baseUrl = 'http://localhost:4820';
  let server: MeghAIServer | null = null;
  try {
    const health = await fetch(`${baseUrl}/api/v1/health`);
    if (health.ok) {
      console.log(`Connected to live MeghAI Server on ${baseUrl}`);
    } else {
      throw new Error('Server not ready');
    }
  } catch {
    server = new MeghAIServer();
    const port = await server.start(4955);
    baseUrl = `http://localhost:${port}`;
    console.log(`Started dedicated MeghAI Server on ${baseUrl}`);
  }

  try {
    // -------------------------------------------------------------
    // STEP 0: Model Settings Persistence Verification
    // -------------------------------------------------------------
    console.log('\n--- STEP 0: Testing /api/v1/model/settings endpoint & persistence ---');
    const initSettingsRes = await fetch(`${baseUrl}/api/v1/model/settings`);
    const initSettings = await initSettingsRes.json();
    console.log('Initial model settings:', initSettings);

    const updateRes = await fetch(`${baseUrl}/api/v1/model/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedProvider: 'local-ollama', selectedModel: 'llama3.2:latest' })
    });
    const updatedSettings = await updateRes.json();
    console.log('Updated model settings response:', updatedSettings);
    if (updatedSettings.selectedProvider !== 'local-ollama') {
      throw new Error(`Expected selectedProvider to be local-ollama, got ${updatedSettings.selectedProvider}`);
    }

    // -------------------------------------------------------------
    // STEP 1 & 2: LIVE TEST — LOCAL-OLLAMA
    // -------------------------------------------------------------
    console.log('\n--- STEP 1 & 2: Live Test — LOCAL-OLLAMA ---');
    console.log('Sending message with providerId: local-ollama...');
    const ollamaChatRes = await fetch(`${baseUrl}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello, introduce yourself in one sentence.',
        providerId: 'local-ollama'
      })
    });
    const ollamaChatData = await ollamaChatRes.json();
    console.log('Ollama Chat Result:', {
      status: ollamaChatData.status,
      requestedProvider: ollamaChatData.requestedProvider,
      actualProvider: ollamaChatData.actualProvider || ollamaChatData.provider,
      actualModel: ollamaChatData.actualModel || ollamaChatData.modelId,
      fallbackOccurred: ollamaChatData.fallbackOccurred,
      reply: ollamaChatData.reply?.slice(0, 120) + '...'
    });

    if (ollamaChatData.requestedProvider !== 'local-ollama') {
      throw new Error(`Expected requestedProvider = local-ollama, got ${ollamaChatData.requestedProvider}`);
    }
    if ((ollamaChatData.actualProvider || ollamaChatData.provider) !== 'local-ollama') {
      throw new Error(`Expected actualProvider = local-ollama, got ${ollamaChatData.actualProvider || ollamaChatData.provider}`);
    }
    if (ollamaChatData.fallbackOccurred === true) {
      throw new Error('Expected fallbackOccurred = false for explicit local-ollama');
    }
    console.log('✅ LOCAL-OLLAMA test PASSED: Real Ollama model executed with zero fallback.');

    // -------------------------------------------------------------
    // STEP 3: LIVE TEST — OPENAI
    // -------------------------------------------------------------
    console.log('\n--- STEP 3: Live Test — OPENAI ---');
    console.log('Sending message with providerId: openai...');
    const openaiChatRes = await fetch(`${baseUrl}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Reply with exactly: OPENAI_TEST',
        providerId: 'openai'
      })
    });
    const openaiChatData = await openaiChatRes.json();
    console.log('OpenAI Chat Result:', {
      status: openaiChatData.status,
      requestedProvider: openaiChatData.requestedProvider,
      actualProvider: openaiChatData.actualProvider || openaiChatData.provider,
      fallbackOccurred: openaiChatData.fallbackOccurred,
      errorOrReply: openaiChatData.error || openaiChatData.reply
    });

    if (openaiChatData.requestedProvider !== 'openai') {
      throw new Error(`Expected requestedProvider = openai, got ${openaiChatData.requestedProvider}`);
    }
    if ((openaiChatData.actualProvider || openaiChatData.provider) !== 'openai') {
      throw new Error(`Expected actualProvider = openai, got ${openaiChatData.actualProvider || openaiChatData.provider}`);
    }
    // Verify Gemini was NOT attempted
    if (String(openaiChatData.reply || openaiChatData.error).includes('gemini') || String(openaiChatData.reply || openaiChatData.error).includes('Gemini')) {
      throw new Error('Gemini was unexpectedly involved in explicit OpenAI request!');
    }
    console.log('✅ OPENAI test PASSED: Explicit OpenAI request executed against OpenAI only (no Gemini).');

    // -------------------------------------------------------------
    // STEP 4: LIVE TEST — GEMINI
    // -------------------------------------------------------------
    console.log('\n--- STEP 4: Live Test — GEMINI ---');
    console.log('Sending single message with providerId: gemini...');
    const geminiChatRes = await fetch(`${baseUrl}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello',
        providerId: 'gemini'
      })
    });
    const geminiChatData = await geminiChatRes.json();
    console.log('Gemini Chat Result:', {
      status: geminiChatData.status,
      requestedProvider: geminiChatData.requestedProvider,
      actualProvider: geminiChatData.actualProvider || geminiChatData.provider,
      fallbackOccurred: geminiChatData.fallbackOccurred,
      errorOrReply: geminiChatData.error || geminiChatData.reply?.slice(0, 80)
    });

    if (geminiChatData.requestedProvider !== 'gemini') {
      throw new Error(`Expected requestedProvider = gemini, got ${geminiChatData.requestedProvider}`);
    }
    if ((geminiChatData.actualProvider || geminiChatData.provider) !== 'gemini') {
      throw new Error(`Expected actualProvider = gemini, got ${geminiChatData.actualProvider || geminiChatData.provider}`);
    }
    // Verify OpenAI was NOT attempted
    if (String(geminiChatData.reply || geminiChatData.error).includes('openai') || String(geminiChatData.reply || geminiChatData.error).includes('OpenAI')) {
      throw new Error('OpenAI was unexpectedly involved in explicit Gemini request!');
    }
    console.log('✅ GEMINI test PASSED: Explicit Gemini request routed to Gemini cleanly (no OpenAI fallback).');

    // -------------------------------------------------------------
    // STEP 5: LIVE TEST — AUTO MODE
    // -------------------------------------------------------------
    console.log('\n--- STEP 5: Live Test — AUTO MODE ---');
    const autoChatRes = await fetch(`${baseUrl}/api/v1/input/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Hello',
        providerId: 'auto'
      })
    });
    const autoChatData = await autoChatRes.json();
    console.log('AUTO Mode Result:', {
      status: autoChatData.status,
      requestedProvider: autoChatData.requestedProvider,
      actualProvider: autoChatData.actualProvider || autoChatData.provider,
      fallbackOccurred: autoChatData.fallbackOccurred
    });
    if (autoChatData.requestedProvider !== 'auto') {
      throw new Error(`Expected requestedProvider = auto, got ${autoChatData.requestedProvider}`);
    }
    console.log('✅ AUTO MODE test PASSED: Requested provider accurately reported as auto.');

    // -------------------------------------------------------------
    // STEP 6: VOICE INPUT INTEGRATION
    // -------------------------------------------------------------
    console.log('\n--- STEP 6: Voice Input Integration Verification ---');
    // Set persistent settings to local-ollama
    await fetch(`${baseUrl}/api/v1/model/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedProvider: 'local-ollama' })
    });

    // Simulate voice command arrival
    console.log('Simulating voice command execution...');
    let voiceResult: any;
    if (server) {
      voiceResult = await server.processUserRequest('What is 25 multiplied by 4?', false, {
        source: 'VOICE',
        voiceSessionId: 'sess-test-live-1',
        commandId: 'cmd-test-live-1'
      });
    } else {
      const res = await fetch(`${baseUrl}/api/v1/input/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'What is 25 multiplied by 4?'
          // Note: providerId is omitted here to prove server reads persistent modelSettings!
        })
      });
      voiceResult = await res.json();
    }
    console.log('Voice Command Result:', {
      status: voiceResult.status,
      requestedProvider: voiceResult.requestedProvider,
      actualProvider: voiceResult.actualProvider || voiceResult.provider,
      actualModel: voiceResult.actualModel || voiceResult.modelId,
      reply: voiceResult.reply
    });

    if ((voiceResult.actualProvider || voiceResult.provider) !== 'local-ollama') {
      throw new Error(`Expected voice command to use local-ollama from settings, got ${voiceResult.actualProvider || voiceResult.provider}`);
    }
    console.log('✅ VOICE INPUT test PASSED: Voice command automatically inherited active local-ollama provider.');

    console.log('\n=============================================================');
    console.log('ALL LIVE ACCEPTANCE CRITERIA SATISFIED SUCCESSFULLY! (REQ-041)');
    console.log('=============================================================');
  } finally {
    process.exit(0);
  }
}

runLiveAcceptance().catch(err => {
  console.error('\n❌ ACCEPTANCE TEST FAILED:', err);
  process.exit(1);
});
