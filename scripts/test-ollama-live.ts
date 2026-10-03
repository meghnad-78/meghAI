import { ModelRouter } from '../packages/model-router/src/index.js';

async function main() {
  const router = new ModelRouter();

  console.log('Testing route() with explicit providerId: local-ollama');
  const decision = await router.route({
    messages: [{ role: 'user', content: 'Hello' }],
    providerId: 'local-ollama'
  });
  console.log('Routing decision:', decision);

  console.log('Testing completeWithFallback with providerId: local-ollama');
  const res = await router.completeWithFallback({
    messages: [{ role: 'user', content: 'Reply with exactly: OLLAMA_ROUTER_OK' }],
    providerId: 'local-ollama'
  });
  console.log('Response:', {
    providerId: res.providerId,
    modelId: res.modelId,
    content: res.content.trim(),
    fallbackOccurred: res.fallbackOccurred
  });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
