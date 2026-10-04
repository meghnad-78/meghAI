import fs from 'node:fs/promises';
import crypto from 'node:crypto';
/**
 * Truthful Outcome Verification Engine (Section 62, 63, 147)
 * Ensures tool success is not falsely equated to outcome success.
 */
export class VerificationEngine {
    /**
     * Verify file write by reopening the file and computing SHA-256 hash.
     */
    static async verifyFileWrite(filePath, expectedContent) {
        const timestamp = new Date().toISOString();
        try {
            const fileBytes = await fs.readFile(filePath);
            const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');
            if (expectedContent !== undefined) {
                const actualContent = fileBytes.toString('utf-8');
                if (actualContent !== expectedContent) {
                    return {
                        status: 'FAILED',
                        details: `File exists at '${filePath}', but content does not match expected output.`,
                        timestamp
                    };
                }
            }
            return {
                status: 'VERIFIED',
                proof: `sha256:${hash} (bytes: ${fileBytes.length})`,
                details: `File verified on disk at '${filePath}'.`,
                timestamp
            };
        }
        catch (err) {
            return {
                status: 'FAILED',
                details: `Verification failed: File not found or unreadable at '${filePath}'. Error: ${err.message}`,
                timestamp
            };
        }
    }
    /**
     * Verify database record creation by executing verification callback.
     */
    static async verifyDatabaseRecord(entityName, recordId, fetchRecord) {
        const timestamp = new Date().toISOString();
        try {
            const record = await fetchRecord();
            if (!record) {
                return {
                    status: 'FAILED',
                    details: `Verification failed: ${entityName} with ID '${recordId}' was not found in database.`,
                    timestamp
                };
            }
            return {
                status: 'VERIFIED',
                proof: `db:${entityName}:${recordId}`,
                details: `${entityName} record '${recordId}' successfully verified in database.`,
                timestamp
            };
        }
        catch (err) {
            return {
                status: 'FAILED',
                details: `Database verification query error: ${err.message}`,
                timestamp
            };
        }
    }
    /**
     * Verify API outcome by checking response confirmation ID.
     */
    static verifyApiConfirmation(serviceName, response, idField = 'id') {
        const timestamp = new Date().toISOString();
        const idVal = response[idField] || response['messageId'] || response['eventId'];
        if (idVal) {
            return {
                status: 'VERIFIED',
                proof: `${serviceName}:${String(idVal)}`,
                details: `External operation verified by ${serviceName} with receipt ID '${idVal}'.`,
                timestamp
            };
        }
        return {
            status: 'UNVERIFIED',
            details: `${serviceName} returned a response, but no authoritative confirmation ID was provided.`,
            timestamp
        };
    }
    /**
     * Verify file existence.
     */
    static async verifyFileExists(filePath) {
        const timestamp = new Date().toISOString();
        try {
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
                return {
                    status: 'VERIFIED',
                    proof: `file_size:${stats.size}`,
                    details: `File verified to exist at '${filePath}' (${stats.size} bytes).`,
                    timestamp
                };
            }
            return {
                status: 'FAILED',
                details: `Path '${filePath}' exists but is not a regular file.`,
                timestamp
            };
        }
        catch {
            return {
                status: 'FAILED',
                details: `Verification failed: File '${filePath}' does not exist on disk.`,
                timestamp
            };
        }
    }
    /**
     * Verify file or folder has been deleted (is absent from disk).
     */
    static async verifyFileAbsent(filePath) {
        const timestamp = new Date().toISOString();
        try {
            await fs.stat(filePath);
            return {
                status: 'FAILED',
                details: `Verification failed: Target '${filePath}' still exists on disk after deletion.`,
                timestamp
            };
        }
        catch {
            return {
                status: 'VERIFIED',
                proof: `absent:${filePath}`,
                details: `Target verified to be absent from disk at '${filePath}'.`,
                timestamp
            };
        }
    }
    /**
     * Verify directory existence.
     */
    static async verifyFolderExists(folderPath) {
        const timestamp = new Date().toISOString();
        try {
            const stats = await fs.stat(folderPath);
            if (stats.isDirectory()) {
                return {
                    status: 'VERIFIED',
                    proof: `dir:${folderPath}`,
                    details: `Directory verified to exist at '${folderPath}'.`,
                    timestamp
                };
            }
            return {
                status: 'FAILED',
                details: `Path '${folderPath}' exists but is not a directory.`,
                timestamp
            };
        }
        catch {
            return {
                status: 'FAILED',
                details: `Verification failed: Directory '${folderPath}' does not exist on disk.`,
                timestamp
            };
        }
    }
    /**
     * Verify process or application launch.
     * Truthfully distinguishes freshly launched processes vs already running instances.
     */
    static verifyProcessLaunch(appName, pid, alreadyRunning = false) {
        const timestamp = new Date().toISOString();
        if (alreadyRunning && pid && pid > 0) {
            return {
                status: 'VERIFIED',
                proof: `existing_pid:${pid}`,
                details: `Application '${appName}' is already running (PID ${pid}). Focused existing instance.`,
                timestamp
            };
        }
        if (pid && pid > 0) {
            return {
                status: 'VERIFIED',
                proof: `pid:${pid}`,
                details: `Process '${appName}' successfully launched with PID ${pid}.`,
                timestamp
            };
        }
        return {
            status: 'UNVERIFIED',
            details: `Application '${appName}' was triggered, but process PID could not be confirmed.`,
            timestamp
        };
    }
    /**
     * Verify browser navigation URL or title.
     */
    static verifyBrowserState(expected, actualUrl, actualTitle) {
        const timestamp = new Date().toISOString();
        const matchesUrl = actualUrl.toLowerCase().includes(expected.toLowerCase());
        const matchesTitle = actualTitle.toLowerCase().includes(expected.toLowerCase());
        if (matchesUrl || matchesTitle) {
            return {
                status: 'VERIFIED',
                proof: `url:${actualUrl}`,
                details: `Browser state matches '${expected}' (Title: "${actualTitle}", URL: "${actualUrl}").`,
                timestamp
            };
        }
        return {
            status: 'FAILED',
            details: `Browser state does not match expected '${expected}'. Current URL: '${actualUrl}', Title: '${actualTitle}'.`,
            timestamp
        };
    }
    /**
     * Verify process exit code.
     */
    static verifyExitCode(exitCode, expectedCode = 0) {
        const timestamp = new Date().toISOString();
        if (exitCode === expectedCode) {
            return {
                status: 'VERIFIED',
                proof: `exitCode:${exitCode}`,
                details: `Process terminated with expected exit code ${exitCode}.`,
                timestamp
            };
        }
        return {
            status: 'FAILED',
            details: `Process exited with code ${exitCode}, expected ${expectedCode}.`,
            timestamp
        };
    }
    /**
     * Fallback verification when outcome cannot be independently checked.
     */
    static markUnverified(strategy, reason) {
        return {
            status: 'UNVERIFIED',
            details: `Operation unverified under strategy '${strategy}': ${reason}`,
            timestamp: new Date().toISOString()
        };
    }
}
//# sourceMappingURL=index.js.map