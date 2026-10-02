import type { VerificationStrategy } from '@meghai/shared-types';
export interface VerificationResult {
    status: 'VERIFIED' | 'UNVERIFIED' | 'FAILED';
    proof?: string;
    details: string;
    timestamp: string;
}
/**
 * Truthful Outcome Verification Engine (Section 62, 63, 147)
 * Ensures tool success is not falsely equated to outcome success.
 */
export declare class VerificationEngine {
    /**
     * Verify file write by reopening the file and computing SHA-256 hash.
     */
    static verifyFileWrite(filePath: string, expectedContent?: string): Promise<VerificationResult>;
    /**
     * Verify database record creation by executing verification callback.
     */
    static verifyDatabaseRecord(entityName: string, recordId: string, fetchRecord: () => Promise<unknown | null>): Promise<VerificationResult>;
    /**
     * Verify API outcome by checking response confirmation ID.
     */
    static verifyApiConfirmation(serviceName: string, response: Record<string, unknown>, idField?: string): VerificationResult;
    /**
     * Fallback verification when outcome cannot be independently checked.
     */
    static markUnverified(strategy: VerificationStrategy, reason: string): VerificationResult;
}
//# sourceMappingURL=index.d.ts.map