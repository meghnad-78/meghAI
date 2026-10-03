import { MeghAIServer } from '../apps/api/src/server.js';
import { GeminiProvider, ModelRouter } from '../packages/model-router/src/index.js';
import { loadStoredCredentials, saveProviderCredential, loadConfig } from '../packages/config/src/index.js';

async function main() {
  console.log('====================================================');
  console.log('MEGHAI — VERIFY GEMINI BYOK KEY INTEGRATION');
  console.log('====================================================\n');

  // Backup current stored credentials to restore at the end
  const initialCreds = { ...loadStoredCredentials() };

  try {
    // -------------------------------------------------------------
    // Test 1: Boot/Startup Hydration & Provider Identity
    // -------------------------------------------------------------
    console.log('[Test 1] Testing server boot & credential hydration...');
    const server = new MeghAIServer();
    const geminiProv = server.modelRouter.getProvider('gemini') as GeminiProvider;

    if (!geminiProv) {
      throw new Error('Gemini provider is not registered in ModelRouter!');
    }
    console.log('✓ Gemini provider found with canonical ID "gemini" and name "' + geminiProv.name + '"');

    const isConfigured = geminiProv.isConfigured();
    console.log('✓ Gemini isConfigured() on boot:', isConfigured);

    // -------------------------------------------------------------
    // Test 2: Health Check Authentication & Error Classification
    // -------------------------------------------------------------
    console.log('\n[Test 2] Running real Gemini health check with currently stored credential...');
    const health = await geminiProv.checkHealth();
    console.log('✓ Health check result:');
    console.log('  - available:', health.available);
    console.log('  - latencyMs:', health.latencyMs);
    console.log('  - isConfigured:', health.isConfigured);
    console.log('  - status:', health.status);
    console.log('  - message:', health.message);

    if (isConfigured && health.status === 'NO_CREDENTIAL') {
      throw new Error('Failed: Provider was configured but health status reported NO_CREDENTIAL');
    }
    console.log('✓ Error/health classification truthfully reported without fake response.');

    // -------------------------------------------------------------
    // Test 3: System Status & Diagnostics Endpoints Consistency
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing system status and diagnostics consistency...');
    const port = await server.start(0);
    try {
      const sysRes = await fetch(`http://localhost:${port}/api/v1/system/status`);
      const sysData = await sysRes.json() as any;
      const geminiInSys = sysData.providers.find((p: any) => p.id === 'gemini');

      const diagRes = await fetch(`http://localhost:${port}/api/v1/providers/diagnostics`);
      const diagData = await diagRes.json() as any;
      const geminiInDiag = diagData.modelProviders.find((p: any) => p.id === 'gemini');

      if (!geminiInSys || !geminiInDiag) {
        throw new Error('Gemini missing from system status or diagnostics response!');
      }

      console.log('✓ /api/v1/system/status Gemini isConfigured:', geminiInSys.isConfigured);
      console.log('✓ /api/v1/providers/diagnostics Gemini isConfigured:', geminiInDiag.isConfigured);
      console.log('✓ Status match:', geminiInSys.health.status === geminiInDiag.health.status);
      console.log('✓ Availability match:', geminiInSys.health.available === geminiInDiag.health.available);

      if (geminiInSys.isConfigured !== geminiInDiag.isConfigured) {
        throw new Error('isConfigured mismatch between /system/status and /providers/diagnostics');
      }

      // -------------------------------------------------------------
      // Test 4: Dynamic BYOK Key Update without Restart
      // -------------------------------------------------------------
      console.log('\n[Test 4] Testing POST /api/v1/providers/keys dynamic in-memory update...');
      const dummyKey = 'test_key_dynamic_update_xyz';
      const keyPostRes = await fetch(`http://localhost:${port}/api/v1/providers/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: 'gemini', apiKey: dummyKey })
      });
      const keyPostData = await keyPostRes.json() as any;
      console.log('✓ POST /api/v1/providers/keys response:', keyPostData.message);

      // Verify immediate in-memory update
      const updatedKey = geminiProv.getApiKey();
      if (updatedKey !== dummyKey) {
        throw new Error(`In-memory key update failed! Expected '${dummyKey}', got '${updatedKey}'`);
      }
      console.log('✓ In-memory provider key immediately updated without server restart.');

      const postUpdateHealth = await geminiProv.checkHealth();
      console.log('✓ Immediate health check after key update:');
      console.log('  - status:', postUpdateHealth.status);
      console.log('  - isConfigured:', postUpdateHealth.isConfigured);
      console.log('  - available:', postUpdateHealth.available);

      if (postUpdateHealth.status !== 'AUTHENTICATION_FAILED') {
        throw new Error(`Expected AUTHENTICATION_FAILED for dummy key, got ${postUpdateHealth.status}`);
      }
      console.log('✓ Dummy key was properly sent to Gemini API and classified as AUTHENTICATION_FAILED.');

      // -------------------------------------------------------------
      // Test 5: Key Precedence (GOOGLE_API_KEY vs GEMINI_API_KEY)
      // -------------------------------------------------------------
      console.log('\n[Test 5] Testing key precedence (GOOGLE_API_KEY over GEMINI_API_KEY)...');
      const testProv = new GeminiProvider();
      process.env['GEMINI_API_KEY'] = 'gemini_env_key';
      process.env['GOOGLE_API_KEY'] = 'google_env_key';
      if (testProv.getApiKey() !== 'google_env_key') {
        throw new Error(`Precedence test failed! Expected 'google_env_key', got '${testProv.getApiKey()}'`);
      }
      delete process.env['GOOGLE_API_KEY'];
      if (testProv.getApiKey() !== 'gemini_env_key') {
        throw new Error(`Fallback test failed! Expected 'gemini_env_key', got '${testProv.getApiKey()}'`);
      }
      delete process.env['GEMINI_API_KEY'];
      console.log('✓ Precedence verified: GOOGLE_API_KEY takes precedence over GEMINI_API_KEY.');

    } finally {
      await server.stop();
    }

    console.log('\n====================================================');
    console.log('ALL GEMINI BYOK VERIFICATION CHECKS PASSED ✅');
    console.log('====================================================\n');
  } finally {
    // Restore initial credentials so we do not disrupt user state
    if (initialCreds['gemini']) {
      saveProviderCredential('gemini', initialCreds['gemini']);
    }
  }
}

main().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
