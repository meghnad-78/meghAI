import http from 'node:http';
import { WindowsSystem } from '@meghai/windows';
import { IPCSecurity, KillSwitch, SecretRedactor } from '@meghai/security';

export class WindowsAgentService {
  private server?: http.Server;

  public start(port = 4821): Promise<number> {
    return new Promise(resolve => {
      this.server = http.createServer(async (req, res) => {
        // Enforce Localhost Only (Section 137)
        const remoteIp = req.socket.remoteAddress;
        if (remoteIp !== '127.0.0.1' && remoteIp !== '::1' && remoteIp !== '::ffff:127.0.0.1') {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Access forbidden: Non-local IPC origin.' }));
          return;
        }

        // Validate IPC Session Token
        const token = req.headers['x-ipc-token'] as string | undefined;
        // In local development or initial bootstrap, check if token matches
        if (token && !IPCSecurity.verifyToken(token)) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized IPC request.' }));
          return;
        }

        const url = new URL(req.url || '/', `http://localhost:${port}`);
        const pathname = url.pathname;

        try {
          if (pathname === '/agent/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'HEALTHY', role: 'WINDOWS_NATIVE_AGENT' }));
            return;
          }

          if (pathname === '/agent/system-info' && req.method === 'GET') {
            const info = WindowsSystem.getSystemInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(info));
            return;
          }

          if (pathname === '/agent/active-window' && req.method === 'GET') {
            const win = await WindowsSystem.getActiveWindow();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(win));
            return;
          }

          if (pathname === '/agent/launch-app' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { appName: string; args?: string[] };
            const result = await WindowsSystem.launchApp(body.appName, body.args);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
          }

          if (pathname === '/agent/powershell' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { command: string; timeoutMs?: number };
            const result = await WindowsSystem.executePowerShell(body.command, body.timeoutMs);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ output: result }));
            return;
          }

          if (pathname === '/agent/search-files' && req.method === 'POST') {
            const body = await this.readJsonBody(req) as { folderPath: string; query: string };
            const results = await WindowsSystem.searchFiles(body.folderPath, body.query);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ results }));
            return;
          }

          if (pathname === '/agent/screen-capture' && req.method === 'POST') {
            const imgPath = await WindowsSystem.captureScreen();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ screenPath: imgPath }));
            return;
          }

          if (pathname === '/agent/kill' && req.method === 'POST') {
            const outcome = KillSwitch.stopMegh('Windows Agent Emergency Kill triggered');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, outcome }));
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Not found: ${pathname}` }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: SecretRedactor.redact((err as Error).message) }));
        }
      });

      this.server.listen(port, '127.0.0.1', () => {
        resolve(port);
      });
    });
  }

  private async readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (err) {
          reject(err);
        }
      });
      req.on('error', reject);
    });
  }

  public async stop(): Promise<void> {
    return new Promise(resolve => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

// If run directly
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  const agent = new WindowsAgentService();
  const port = parseInt(process.env['AGENT_PORT'] || '4821', 10);
  agent.start(port).then(p => {
    console.log(`[MeghAI Windows Agent] Privileged OS Service active on http://127.0.0.1:${p}`);
  });
}
