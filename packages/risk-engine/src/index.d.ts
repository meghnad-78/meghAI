import type { RiskLevel, RiskAssessment, ToolCategory } from '@meghai/shared-types';
export interface ActionPreviewCard {
    title: string;
    toolName: string;
    targetDescription: string;
    operationType: string;
    riskLevel: RiskLevel;
    reasons: string[];
    reversibility: 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE';
    payloadSummary: Record<string, unknown>;
    requiresExplicitConfirmation: boolean;
}
/**
 * 4-Tier Risk Engine & Action Preview Generator (Section 58 & 61)
 */
export declare class RiskEngine {
    private static readonly CRITICAL_COMMAND_PATTERNS;
    private static readonly HIGH_RISK_COMMAND_PATTERNS;
    static assess(toolName: string, args: Record<string, unknown>, category: ToolCategory, defaultRisk?: RiskLevel, rollbackStrategy?: 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE'): RiskAssessment;
    static generateActionPreview(toolName: string, args: Record<string, unknown>, assessment: RiskAssessment, rollbackStrategy?: 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE'): ActionPreviewCard;
    private static elevate;
}
import type { ActionConfirmationRequest } from '@meghai/shared-types';
/**
 * Central Confirmation Policy Manager (Section 6 & 61)
 * Enforces explicit user confirmation for high-risk, destructive, or external communication actions.
 */
export declare class ConfirmationManager {
    private pendingRequests;
    private confirmedPlans;
    private confirmedTokens;
    /**
     * Determine if an action category and risk level strictly requires confirmation.
     */
    static requiresConfirmation(toolName: string, riskLevel: RiskLevel, isDestructive?: boolean, isExternalCommunication?: boolean): boolean;
    createRequest(params: {
        planId: string;
        stepId?: string;
        actionSummary: string;
        target: string;
        riskLevel: RiskLevel;
        reversible: boolean;
        impact: string;
    }): ActionConfirmationRequest;
    confirm(token: string): boolean;
    reject(token: string): boolean;
    isPlanConfirmed(planId: string, stepId?: string): boolean;
    getPendingRequests(): ActionConfirmationRequest[];
    getRequestByToken(token: string): ActionConfirmationRequest | undefined;
    clear(): void;
}
//# sourceMappingURL=index.d.ts.map