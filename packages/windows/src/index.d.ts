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
     * Get Active Foreground Window in Windows
     */
    static getActiveWindow(): Promise<ActiveWindowInfo>;
    /**
     * Execute PowerShell with strict sanitization and timeout
     */
    static executePowerShell(command: string, timeoutMs?: number): Promise<string>;
    /**
     * Resolve well-known application aliases to standard Windows binaries/commands
     */
    static resolveAppCommand(appName: string): {
        command: string;
        args: string[];
    };
    /**
     * Check if an application is already running on the system
     */
    static isAppRunning(appName: string): Promise<{
        isRunning: boolean;
        pid?: number;
        processName: string;
    }>;
    /**
     * Attempt to focus an existing application window
     */
    static focusApp(appName: string): Promise<{
        focused: boolean;
        details: string;
    }>;
    /**
     * Launch application safely with alias resolution and process registration.
     * Truthfully detects and distinguishes if the application is already running vs newly spawned.
     */
    static launchApp(appName: string, args?: string[]): Promise<{
        pid: number;
        appName: string;
        alreadyRunning: boolean;
        action: 'LAUNCHED' | 'ALREADY_RUNNING';
    }>;
    /**
     * Close or terminate an application by process name or PID
     */
    static closeApp(processNameOrPid: string | number): Promise<{
        success: boolean;
        details: string;
    }>;
    /**
     * List running GUI applications with window titles
     */
    static listRunningApps(): Promise<Array<{
        processName: string;
        title: string;
        pid: number;
    }>>;
    /**
     * Open URL in default Windows browser
     */
    static openUrl(url: string): Promise<void>;
    /**
     * Open folder in Windows File Explorer
     */
    static openFolder(folderPath: string, allowedRoots?: string[]): Promise<void>;
    /**
     * Open file in default application
     */
    static openFile(filePath: string, allowedRoots?: string[]): Promise<void>;
    /**
     * Create file safely within permitted root directories
     */
    static createFile(filePath: string, content?: string, allowedRoots?: string[]): Promise<string>;
    /**
     * Read file safely within permitted root directories
     */
    static readFile(filePath: string, allowedRoots?: string[]): Promise<string>;
    /**
     * Write file safely within permitted root directories
     */
    static writeFile(filePath: string, content: string, allowedRoots?: string[]): Promise<string>;
    /**
     * Append content to file safely
     */
    static appendFile(filePath: string, content: string, allowedRoots?: string[]): Promise<string>;
    /**
     * Rename or move file safely
     */
    static moveFile(sourcePath: string, destPath: string, allowedRoots?: string[]): Promise<{
        source: string;
        destination: string;
    }>;
    /**
     * Copy file safely
     */
    static copyFile(sourcePath: string, destPath: string, allowedRoots?: string[]): Promise<{
        source: string;
        destination: string;
    }>;
    /**
     * Delete file safely
     */
    static deleteFile(filePath: string, allowedRoots?: string[]): Promise<string>;
    /**
     * Create folder safely
     */
    static createFolder(folderPath: string, allowedRoots?: string[]): Promise<string>;
    /**
     * List folder contents safely
     */
    static listFolder(folderPath: string, allowedRoots?: string[]): Promise<Array<{
        name: string;
        isDirectory: boolean;
        size?: number;
    }>>;
    /**
     * Get file metadata safely
     */
    static getFileMetadata(filePath: string, allowedRoots?: string[]): Promise<Record<string, unknown>>;
    /**
     * Read Windows Clipboard text
     */
    static readClipboard(): Promise<string>;
    /**
     * Write text to Windows Clipboard
     */
    static writeClipboard(text: string): Promise<void>;
    /**
     * Search files in permitted directory
     */
    static searchFiles(folderPath: string, query: string, maxResults?: number, allowedRoots?: string[]): Promise<string[]>;
    /**
     * Ephemeral Screen Capture via .NET
     */
    static captureScreen(destinationPath?: string): Promise<string>;
}
//# sourceMappingURL=index.d.ts.map