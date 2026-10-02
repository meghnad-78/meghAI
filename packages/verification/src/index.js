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