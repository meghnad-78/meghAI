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

  await new Promise(r => setTimeout(r, 500));

  console.log('Sending POST /api/v1/input/process with compound command ...');
  const postData = JSON.stringify({ text: 'Open Chrome and search for Java DSA roadmap.' });
  
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

  await new Promise(r => setTimeout(r, 1000));
  sseReq.destroy();

  console.log('POST Response:', JSON.stringify(postResult, null, 2));
  console.log('\nRelevant SSE Events Received:');
  for (const e of sseEvents) {
    const type = e.data.type;
    if (type && (type.startsWith('ACTION_') || type.startsWith('TOOL_') || type === 'TASK_COMPLETED' || type === 'INTENT_CLASSIFIED')) {
      console.log(`- [${type}]:`, JSON.stringify(e.data.payload || e.data));
    }
  }
}

main().catch(console.error);
