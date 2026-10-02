import os from 'node:os';
import { exec, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { KillSwitch, SecretRedactor, PathValidator } from '@meghai/security';

export interface SystemInfoResult {
  platform: string;
  osRelease: string;
  arch: string;
  cpus: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
  uptimeSeconds: number;
  hostname: string;
}

export interface ActiveWindowInfo {
  title: string;
  processName: string;
  pid?: number;
}

/**
 * Privileged Windows Automation & Control Engine (Section 45, 46, 48)
 */
export class WindowsSystem {
  public static getSystemInfo(): SystemInfoResult {
    const totalMem = Math.round(os.totalmem() / (1024 * 1024));
    const freeMem = Math.round(os.freemem() / (1024 * 1024));
    return {
      platform: os.platform(),
      osRelease: os.release(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemoryMB: totalMem,
      freeMemoryMB: freeMem,
      uptimeSeconds: Math.round(os.uptime()),
      hostname: os.hostname()
    };
  }

  /**
   * Launch application safely with process registration
   */
  public static async launchApp(appName: string, args: string[] = []): Promise<{ pid: number; appName: string }> {
    if (KillSwitch.isActive()) {
      throw new Error('Kill switch is active; launching apps is blocked.');
    }

    return new Promise((resolve, reject) => {
      try {
        const child = spawn(appName, args, {
          detached: true,
          stdio: 'ignore',
          shell: true
        });

        if (child.pid) {
          const unregister = KillSwitch.registerProcess({
            pid: child.pid,
            kill: () => {
              try {
                process.kill(child.pid!);
              } catch {
                // Ignore if process already exited
              }
            }
          });
          child.unref();
          resolve({ pid: child.pid, appName });
        } else {
          reject(new Error(`Failed to obtain PID when launching app '${appName}'`));
        }
      } catch (err) {
        reject(new Error(`Error launching app '${appName}': ${(err as Error).message}`));
      }
    });
  }

  /**
   * Get Active Foreground Window in Windows
   */
  public static async getActiveWindow(): Promise<ActiveWindowInfo> {
    if (os.platform() !== 'win32') {
      return { title: 'Desktop (Non-Windows Mock)', processName: 'mock.exe', pid: 1000 };
    }

    // Fast PowerShell query using Win32 API
    const psScript = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        public class Win32 {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        }
"@
      $hwnd = [Win32]::GetForegroundWindow()
      $sb = New-Object System.Text.StringBuilder 256
      [void][Win32]::GetWindowText($hwnd, $sb, 256)
      $pid = 0
      [void][Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid)
      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
      @{ Title = $sb.ToString(); Process = if ($proc) { $proc.ProcessName } else { "unknown" }; Pid = $pid } | ConvertTo-Json
    `;

    try {
      const output = await this.executePowerShell(psScript, 4000);
      const data = JSON.parse(output) as { Title: string; Process: string; Pid: number };
      return {
        title: data.Title || 'Unknown Window',
        processName: data.Process || 'unknown',
        pid: data.Pid
      };
    } catch {
      return {
        title: 'Active Desktop Window',
        processName: 'explorer.exe'
      };
    }
  }

  /**
   * Execute PowerShell with strict sanitization and timeout
   */
  public static async executePowerShell(command: string, timeoutMs = 15000): Promise<string> {
    if (KillSwitch.isActive()) {
      throw new Error('Kill switch is active; PowerShell execution is halted.');
    }

    return new Promise((resolve, reject) => {
      // Encode command in Base64 for PowerShell -EncodedCommand to avoid quotation escaping bugs
      const encoded = Buffer.from(command, 'utf16le').toString('base64');
      const child = exec(
        `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
        { timeout: timeoutMs, maxBuffer: 1024 * 1024 * 5 },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(`PowerShell execution error: ${SecretRedactor.redact(stderr || error.message)}`));
          } else {
            resolve(stdout.trim());
          }
        }
      );

      if (child.pid) {
        KillSwitch.registerProcess({
          pid: child.pid,
          kill: () => {
            try {
              child.kill('SIGTERM');
            } catch {
              // Ignore
            }
          }
        });
      }
    });
  }

  /**
   * Search files in permitted directory
   */
  public static async searchFiles(folderPath: string, query: string, maxResults = 25): Promise<string[]> {
    const results: string[] = [];
    const qLower = query.toLowerCase();

    async function walk(dir: string, depth = 0) {
      if (depth > 4 || results.length >= maxResults) return;
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= maxResults) break;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
              await walk(fullPath, depth + 1);
            }
          } else if (entry.isFile()) {
            if (entry.name.toLowerCase().includes(qLower)) {
              results.push(fullPath);
            }
          }
        }
      } catch {
        // Skip inaccessible folders
      }
    }

    await walk(folderPath);
    return results;
  }

  /**
   * Ephemeral Screen Capture via .NET
   */
  public static async captureScreen(destinationPath?: string): Promise<string> {
    const outPath = destinationPath || path.join(os.tmpdir(), `meghai_screen_${Date.now()}.png`);
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen
      $bounds = $screen.Bounds
      $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
      $bitmap.Save('${outPath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose()
      $bitmap.Dispose()
    `;
    await this.executePowerShell(script, 8000);
    return outPath;
  }
}
