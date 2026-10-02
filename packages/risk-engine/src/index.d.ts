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
//# sourceMappingURL=index.d.ts.map