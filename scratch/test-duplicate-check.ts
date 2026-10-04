import http from 'node:http';

async function main() {
  const sseEvents: any[] = [];
  
  // 1. Connect to SSE
  const sseReq = http.request({
    hostname: 'localhost',
    port: 4820,
    path: '/api/v1/events/stream',
    method: 'GET',
    headers: { 'Accept': 'text/event-stream' }
  }, (res) => {
    res.on('data', (chunk) => {
      const text = chunk.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            sseEvents.push({ receivedAt: Date.now(), data });
          } catch {}
        }
      }
    });
  });
  sseReq.end();

  // Wait 500ms for SSE connection to establish
  await new Promise(r => setTimeout(r, 500));

  // 2. Post Open Calculator
  console.log('Sending POST /api/v1/input/process ...');
  const postData = JSON.stringify({ text: 'Open Calculator.' });
  
  const postResult: any = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 4820,
      path: '/api/v1/input/process',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body), completedAt: Date.now() }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });

  // Wait 1000ms to collect all SSE events
  await new Promise(r => setTimeout(r, 1000));
  sseReq.destroy();

  console.log('POST Response:', postResult);
  console.log('\nSSE Events Received (' + sseEvents.length + '):');
  for (const e of sseEvents) {
    if (e.data.type === 'TASK_COMPLETED' || e.data.type === 'ACTION_TOOL_COMPLETED' || e.data.type === 'TOOL_REQUESTED' || e.data.type === 'TOOL_COMPLETED' || e.data.type === 'ACTION_PLAN_CREATED') {
      console.log(`- [${e.data.type}] at ${e.receivedAt}:`, JSON.stringify(e.data.payload || e.data));
    }
  }
}

main().catch(console.error);
