import { MeghAIServer } from './server.js';

export { MeghAIServer };

// If executed directly, start server
if (process.argv[1] && (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'))) {
  const server = new MeghAIServer();
  const port = parseInt(process.env['PORT'] || '4820', 10);
  server.start(port).then(p => {
    console.log(`[MeghAI Server] Running on http://localhost:${p}`);
    console.log(`[MeghAI Server] SSE Stream available at http://localhost:${p}/api/v1/events/stream`);
  });
}
