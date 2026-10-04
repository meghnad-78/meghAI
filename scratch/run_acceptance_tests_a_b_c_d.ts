import http from 'node:http';

interface TestResult {
  name: string;
  command: string;
  commandId: string;
  postResponse: any;
  sseEvents: any[];
  executionDetails: any;
}

function listenSSE(onEvent: (event: any) => void): http.ClientRequest {
  const req = http.request({
    hostname: 'localhost',
    port: 4820,
    path: '/api/v1/events/stream',
    method: 'GET',
    headers: { 'Accept': 'text/event-stream' }
  }, (res) => {
    let buffer = '';
    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent(data);
          } catch {}
        }
      }
    });
  });
  req.end();
  return req;
}

async function sendCommand(text: string, commandId: string): Promise<any> {
  const postData = JSON.stringify({
    text,
    commandId,
    source: 'TEXT'
  });

  return new Promise((resolve, reject) => {
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
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const allEvents: any[] = [];
  const sseConn = listenSSE((event) => {
    allEvents.push({ timestamp: Date.now(), ...event });
  });

  await new Promise(r => setTimeout(r, 600));

  console.log('================================================================');
  console.log('STARTING ACCEPTANCE TESTS A, B, C, D');
  console.log('================================================================\n');

  // TEST A: Open Calculator (fresh launch)
  console.log('>>> RUNNING TEST A: "Open Calculator." (Fresh Launch)...');
  const startIdxA = allEvents.length;
  const cmdIdA = 'cmd-test-a-' + Date.now();
  const resA = await sendCommand('Open Calculator.', cmdIdA);
  await new Promise(r => setTimeout(r, 1200));
  const eventsA = allEvents.slice(startIdxA);
  console.log('TEST A POST Response:', JSON.stringify(resA, null, 2));
  console.log('TEST A SSE Events Count:', eventsA.length);
  for (const e of eventsA) {
    if (e.type?.startsWith('ACTION_') || e.type?.startsWith('TOOL_') || e.type === 'TASK_COMPLETED') {
      console.log(`  - [${e.type}]:`, JSON.stringify(e.payload || e.data));
    }
  }

  // TEST B: Open Calculator (Repeat while Calculator is already running)
  console.log('\n>>> RUNNING TEST B: "Open Calculator." (While already running)...');
  const startIdxB = allEvents.length;
  const cmdIdB = 'cmd-test-b-' + Date.now();
  const resB = await sendCommand('Open Calculator.', cmdIdB);
  await new Promise(r => setTimeout(r, 1200));
  const eventsB = allEvents.slice(startIdxB);
  console.log('TEST B POST Response:', JSON.stringify(resB, null, 2));
  console.log('TEST B SSE Events Count:', eventsB.length);
  for (const e of eventsB) {
    if (e.type?.startsWith('ACTION_') || e.type?.startsWith('TOOL_') || e.type === 'TASK_COMPLETED') {
      console.log(`  - [${e.type}]:`, JSON.stringify(e.payload || e.data));
    }
  }

  // TEST C: Open Chrome and search for Java DSA roadmap.
  console.log('\n>>> RUNNING TEST C: "Open Chrome and search for Java DSA roadmap." ...');
  const startIdxC = allEvents.length;
  const cmdIdC = 'cmd-test-c-' + Date.now();
  const resC = await sendCommand('Open Chrome and search for Java DSA roadmap.', cmdIdC);
  await new Promise(r => setTimeout(r, 1500));
  const eventsC = allEvents.slice(startIdxC);
  console.log('TEST C POST Response:', JSON.stringify(resC, null, 2));
  console.log('TEST C SSE Events Count:', eventsC.length);
  for (const e of eventsC) {
    if (e.type?.startsWith('ACTION_') || e.type?.startsWith('TOOL_') || e.type === 'TASK_COMPLETED') {
      console.log(`  - [${e.type}]:`, JSON.stringify(e.payload || e.data));
    }
  }

  // TEST D: Open Chrome.
  console.log('\n>>> RUNNING TEST D: "Open Chrome." ...');
  const startIdxD = allEvents.length;
  const cmdIdD = 'cmd-test-d-' + Date.now();
  const resD = await sendCommand('Open Chrome.', cmdIdD);
  await new Promise(r => setTimeout(r, 1200));
  const eventsD = allEvents.slice(startIdxD);
  console.log('TEST D POST Response:', JSON.stringify(resD, null, 2));
  console.log('TEST D SSE Events Count:', eventsD.length);
  for (const e of eventsD) {
    if (e.type?.startsWith('ACTION_') || e.type?.startsWith('TOOL_') || e.type === 'TASK_COMPLETED') {
      console.log(`  - [${e.type}]:`, JSON.stringify(e.payload || e.data));
    }
  }

  sseConn.destroy();
  console.log('\n================================================================');
  console.log('ALL TESTS COMPLETED');
  console.log('================================================================');
}

run().catch(console.error);
