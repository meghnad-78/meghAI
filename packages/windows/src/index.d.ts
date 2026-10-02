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
export declare class WindowsSystem {
    static getSystemInfo(): SystemInfoResult;
    /**
     * Launch application safely with process registration
     */
    static launchApp(appName: string, args?: string[]): Promise<{
        pid: number;
        appName: string;
    }>;
    /**
     * Get Active Foreground Window in Windows
     */
    static getActiveWindow(): Promise<ActiveWindowInfo>;
    /**
     * Execute PowerShell with strict sanitization and timeout
     */
    static executePowerShell(command: string, timeoutMs?: number): Promise<string>;
    /**
     * Search files in permitted directory
     */
    static searchFiles(folderPath: string, query: string, maxResults?: number): Promise<string[]>;
    /**
     * Ephemeral Screen Capture via .NET
     */
    static captureScreen(destinationPath?: string): Promise<string>;
}
//# sourceMappingURL=index.d.ts.map