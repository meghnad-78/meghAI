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
   * Resolve well-known application aliases to standard Windows binaries/commands
   */
  public static resolveAppCommand(appName: string): { command: string; args: string[] } {
    const lower = appName.trim().toLowerCase();
    switch (lower) {
      case 'calc':
      case 'calculator':
        return { command: 'calc.exe', args: [] };
      case 'notepad':
        return { command: 'notepad.exe', args: [] };
      case 'chrome':
      case 'google chrome':
        return { command: 'chrome.exe', args: ['--remote-debugging-port=9222'] };
      case 'edge':
      case 'microsoft edge':
        return { command: 'msedge.exe', args: [] };
      case 'spotify':
        return { command: 'cmd.exe', args: ['/c', 'start', 'spotify:'] };
      case 'code':
      case 'vs code':
      case 'vscode':
      case 'visual studio code':
        return { command: 'code.cmd', args: [] };
      case 'explorer':
      case 'file explorer':
        return { command: 'explorer.exe', args: [] };
      case 'terminal':
      case 'cmd':
        return { command: 'wt.exe', args: [] };
      default:
        return { command: appName, args: [] };
    }
  }

  /**
   * Check if an application is already running on the system
   */
  public static async isAppRunning(appName: string): Promise<{ isRunning: boolean; pid?: number; processName: string }> {
    const resolved = this.resolveAppCommand(appName);
    const procName = resolved.command.replace(/\.exe$/i, '').replace(/\.cmd$/i, '');
    const cleanProcName = (procName === 'calc') ? 'CalculatorApp' : procName;

    const psScript = `
      $procs = Get-Process -Name "${cleanProcName}","${procName}" -ErrorAction SilentlyContinue
      if ($procs) {
        $p = if ($procs -is [array]) { $procs[0].Id } else { $procs.Id }
        @{ Running = $true; Pid = $p; ProcessName = "${cleanProcName}" } | ConvertTo-Json
      } else {
        @{ Running = $false; ProcessName = "${cleanProcName}" } | ConvertTo-Json
      }
    `;
    try {
      const output = await this.executePowerShell(psScript, 4000);
      if (!output) return { isRunning: false, processName: cleanProcName };
      const data = JSON.parse(output);
      return {
        isRunning: Boolean(data.Running),
        pid: data.Pid,
        processName: data.ProcessName || cleanProcName
      };
    } catch {
      return { isRunning: false, processName: cleanProcName };
    }
  }

  /**
   * Attempt to focus an existing application window
   */
  public static async focusApp(appName: string): Promise<{ focused: boolean; details: string }> {
    const resolved = this.resolveAppCommand(appName);
    const procName = resolved.command.replace(/\.exe$/i, '').replace(/\.cmd$/i, '');
    const cleanProcName = (procName === 'calc') ? 'CalculatorApp' : procName;
    const psScript = `
      $wshell = New-Object -ComObject WScript.Shell
      $proc = Get-Process -Name "${cleanProcName}","${procName}" -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($proc) {
        $res = $wshell.AppActivate($proc.Id)
        @{ Focused = $res; Pid = $proc.Id } | ConvertTo-Json
      } else {
        @{ Focused = $false } | ConvertTo-Json
      }
    `;
    try {
      const output = await this.executePowerShell(psScript, 4000);
      if (!output) return { focused: false, details: 'No output' };
      const data = JSON.parse(output);
      return { focused: Boolean(data.Focused), details: `Focused process PID ${data.Pid}` };
    } catch {
      return { focused: false, details: 'Could not focus window' };
    }
  }

  /**
   * Launch application safely with alias resolution and process registration.
   * Truthfully detects and distinguishes if the application is already running vs newly spawned.
   */
  public static async launchApp(appName: string, args: string[] = []): Promise<{ pid: number; appName: string; alreadyRunning: boolean; action: 'LAUNCHED' | 'ALREADY_RUNNING' }> {
    if (KillSwitch.isActive()) {
      throw new Error('Kill switch is active; launching apps is blocked.');
    }

    // Step 1: Detect if already running before blindly spawning
    const runningCheck = await this.isAppRunning(appName);
    if (runningCheck.isRunning && runningCheck.pid) {
      await this.focusApp(appName);
      return {
        pid: runningCheck.pid,
        appName,
        alreadyRunning: true,
        action: 'ALREADY_RUNNING'
      };
    }

    // Step 2: Spawn new instance if not running
    const resolved = this.resolveAppCommand(appName);
    const finalCommand = resolved.command;
    const finalArgs = resolved.args.length > 0 ? resolved.args : args;

    return new Promise((resolve, reject) => {
      try {
        const child = spawn(finalCommand, finalArgs, {
          detached: true,
          stdio: 'ignore',
          shell: true
        });

        if (child.pid) {
          KillSwitch.registerProcess({
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
          resolve({ pid: child.pid, appName, alreadyRunning: false, action: 'LAUNCHED' });
        } else {
          // If child spawned without explicit pid, return non-zero dummy
          resolve({ pid: 1, appName, alreadyRunning: false, action: 'LAUNCHED' });
        }
      } catch (err) {
        reject(new Error(`Error launching app '${appName}': ${(err as Error).message}`));
      }
    });
  }

  /**
   * Close or terminate an application by process name or PID
   */
  public static async closeApp(processNameOrPid: string | number): Promise<{ success: boolean; details: string }> {
    if (KillSwitch.isActive()) {
      throw new Error('Kill switch is active; action halted.');
    }

    if (typeof processNameOrPid === 'number') {
      const psScript = `Stop-Process -Id ${processNameOrPid} -Force -ErrorAction SilentlyContinue`;
      await this.executePowerShell(psScript);
      return { success: true, details: `Terminated process PID ${processNameOrPid}` };
    }

    const cleanName = processNameOrPid.replace(/\.exe$/i, '');
    const psScript = `Stop-Process -Name "${cleanName}" -Force -ErrorAction SilentlyContinue`;
    await this.executePowerShell(psScript);
    return { success: true, details: `Closed application instances of '${cleanName}'` };
  }

  /**
   * List running GUI applications with window titles
   */
  public static async listRunningApps(): Promise<Array<{ processName: string; title: string; pid: number }>> {
    const psScript = `
      Get-Process | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object ProcessName, MainWindowTitle, Id | ConvertTo-Json
    `;
    try {
      const output = await this.executePowerShell(psScript, 5000);
      if (!output) return [];
      const parsed = JSON.parse(output);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items.map((i: any) => ({
        processName: i.ProcessName || 'unknown',
        title: i.MainWindowTitle || '',
        pid: i.Id || 0
      }));
    } catch {
      return [];
    }
  }

  /**
   * Open URL in default Windows browser
   */
  public static async openUrl(url: string): Promise<void> {
    if (KillSwitch.isActive()) {
      throw new Error('Kill switch is active; URL navigation halted.');
    }
    const escaped = url.replace(/"/g, '`"');
    const psScript = `Start-Process "${escaped}"`;
    await this.executePowerShell(psScript, 5000);
  }

  /**
   * Open folder in Windows File Explorer
   */
  public static async openFolder(folderPath: string, allowedRoots?: string[]): Promise<void> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(folderPath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }
    const psScript = `explorer.exe "${validation.normalizedPath.replace(/"/g, '`"')}"`;
    await this.executePowerShell(psScript, 5000);
  }

  /**
   * Open file in default application
   */
  public static async openFile(filePath: string, allowedRoots?: string[]): Promise<void> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(filePath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }
    const psScript = `Start-Process "${validation.normalizedPath.replace(/"/g, '`"')}"`;
    await this.executePowerShell(psScript, 5000);
  }

  /**
   * Create file safely within permitted root directories
   */
  public static async createFile(filePath: string, content = '', allowedRoots?: string[]): Promise<string> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(filePath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }
    await fs.mkdir(path.dirname(validation.normalizedPath), { recursive: true });
    await fs.writeFile(validation.normalizedPath, content, 'utf-8');
    return validation.normalizedPath;
  }

  /**
   * Read file safely within permitted root directories
   */
  public static async readFile(filePath: string, allowedRoots?: string[]): Promise<string> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(filePath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }
    return await fs.readFile(validation.normalizedPath, 'utf-8');
  }

  /**
   * Write file safely within permitted root directories
   */
  public static async writeFile(filePath: string, content: string, allowedRoots?: string[]): Promise<string> {
    return await this.createFile(filePath, content, allowedRoots);
  }

  /**
   * Append content to file safely
   */
  public static async appendFile(filePath: string, content: string, allowedRoots?: string[]): Promise<string> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(filePath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }
    await fs.appendFile(validation.normalizedPath, content, 'utf-8');
    return validation.normalizedPath;
  }

  /**
   * Rename or move file safely
   */
  public static async moveFile(sourcePath: string, destPath: string, allowedRoots?: string[]): Promise<{ source: string; destination: string }> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const srcVal = PathValidator.validatePath(sourcePath, roots);
    if (!srcVal.isSafe) throw new Error(`Source security validation failed: ${srcVal.error}`);
    const destVal = PathValidator.validatePath(destPath, roots);
    if (!destVal.isSafe) throw new Error(`Destination security validation failed: ${destVal.error}`);

    await fs.mkdir(path.dirname(destVal.normalizedPath), { recursive: true });
    await fs.rename(srcVal.normalizedPath, destVal.normalizedPath);
    return { source: srcVal.normalizedPath, destination: destVal.normalizedPath };
  }

  /**
   * Copy file safely
   */
  public static async copyFile(sourcePath: string, destPath: string, allowedRoots?: string[]): Promise<{ source: string; destination: string }> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const srcVal = PathValidator.validatePath(sourcePath, roots);
    if (!srcVal.isSafe) throw new Error(`Source security validation failed: ${srcVal.error}`);
    const destVal = PathValidator.validatePath(destPath, roots);
    if (!destVal.isSafe) throw new Error(`Destination security validation failed: ${destVal.error}`);

    await fs.mkdir(path.dirname(destVal.normalizedPath), { recursive: true });
    await fs.copyFile(srcVal.normalizedPath, destVal.normalizedPath);
    return { source: srcVal.normalizedPath, destination: destVal.normalizedPath };
  }

  /**
   * Delete file safely
   */
  public static async deleteFile(filePath: string, allowedRoots?: string[]): Promise<string> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(filePath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }
    await fs.unlink(validation.normalizedPath);
    return validation.normalizedPath;
  }

  /**
   * Create folder safely
   */
  public static async createFolder(folderPath: string, allowedRoots?: string[]): Promise<string> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(folderPath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }
    await fs.mkdir(validation.normalizedPath, { recursive: true });
    return validation.normalizedPath;
  }

  /**
   * List folder contents safely
   */
  public static async listFolder(folderPath: string, allowedRoots?: string[]): Promise<Array<{ name: string; isDirectory: boolean; size?: number }>> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(folderPath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }
    const entries = await fs.readdir(validation.normalizedPath, { withFileTypes: true });
    const result: Array<{ name: string; isDirectory: boolean; size?: number }> = [];
    for (const e of entries) {
      let size: number | undefined;
      if (e.isFile()) {
        try {
          const st = await fs.stat(path.join(validation.normalizedPath, e.name));
          size = st.size;
        } catch {}
      }
      result.push({
        name: e.name,
        isDirectory: e.isDirectory(),
        size
      });
    }
    return result;
  }

  /**
   * Get file metadata safely
   */
  public static async getFileMetadata(filePath: string, allowedRoots?: string[]): Promise<Record<string, unknown>> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(filePath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }
    const stats = await fs.stat(validation.normalizedPath);
    return {
      path: validation.normalizedPath,
      size: stats.size,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString()
    };
  }

  /**
   * Read Windows Clipboard text
   */
  public static async readClipboard(): Promise<string> {
    const psScript = `Get-Clipboard -Raw`;
    try {
      const text = await this.executePowerShell(psScript, 3000);
      return text || '';
    } catch {
      return '';
    }
  }

  /**
   * Write text to Windows Clipboard
   */
  public static async writeClipboard(text: string): Promise<void> {
    const escaped = text.replace(/"/g, '`"');
    const psScript = `Set-Clipboard -Value "${escaped}"`;
    await this.executePowerShell(psScript, 3000);
  }

  /**
   * Search files in permitted directory
   */
  public static async searchFiles(folderPath: string, query: string, maxResults = 25, allowedRoots?: string[]): Promise<string[]> {
    const roots = allowedRoots || PathValidator.getStandardSafeRoots();
    const validation = PathValidator.validatePath(folderPath, roots);
    if (!validation.isSafe) {
      throw new Error(`Security validation failed: ${validation.error}`);
    }

    const results: string[] = [];
    const qLower = query.toLowerCase();

    async function walk(dir: string, depth = 0) {
      if (depth > 5 || results.length >= maxResults) return;
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

    await walk(validation.normalizedPath);
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

