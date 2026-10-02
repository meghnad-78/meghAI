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
export class RiskEngine {
  private static readonly CRITICAL_COMMAND_PATTERNS = [
    /rmdir\s+\/s/i,
    /del\s+\/[sfq]/i,
    /remove-item.*-recurse/i,
    /format\s+[a-z]:/i,
    /diskpart/i,
    /reg\s+(delete|add)/i,
    /set-executionpolicy/i,
    /net\s+user/i,
    /shutdown/i,
    /stop-computer/i
  ];

  private static readonly HIGH_RISK_COMMAND_PATTERNS = [
    /curl\s+.*\|\s*(bash|sh|powershell|iex)/i,
    /invoke-webrequest.*\|\s*iex/i,
    /stop-process/i,
    /taskkill/i,
    /npm\s+install\s+-g/i,
    /pip\s+install/i
  ];

  public static assess(
    toolName: string,
    args: Record<string, unknown>,
    category: ToolCategory,
    defaultRisk: RiskLevel = 'LOW',
    rollbackStrategy: 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE' = 'IRREVERSIBLE'
  ): RiskAssessment {
    const reasons: string[] = [];
    let isDestructive = false;
    let isExternalCommunication = false;
    let computedLevel: RiskLevel = defaultRisk;

    const lowerTool = toolName.toLowerCase();

    // 1. Check Destructive File Operations
    if (lowerTool.includes('delete') || lowerTool.includes('remove') || lowerTool.includes('truncate') || lowerTool.includes('drop')) {
      isDestructive = true;
      reasons.push('Action deletes or removes existing data.');
      computedLevel = this.elevate(computedLevel, 'HIGH');
    }

    // 2. Check Bulk Operations
    const pathArg = (args['path'] || args['targetPath'] || args['filePath'] || '') as string;
    if (pathArg && (pathArg === '/' || pathArg.toLowerCase() === 'c:\\' || pathArg.includes('*'))) {
      isDestructive = true;
      reasons.push('Target involves root or wildcard path pattern.');
      computedLevel = 'CRITICAL';
    }

    // 3. Shell / PowerShell Command Inspection
    const commandArg = (args['command'] || args['commandLine'] || args['script'] || '') as string;
    if (commandArg && typeof commandArg === 'string') {
      if (this.CRITICAL_COMMAND_PATTERNS.some(p => p.test(commandArg))) {
        computedLevel = 'CRITICAL';
        isDestructive = true;
        reasons.push('Command contains critical system modification or bulk deletion commands.');
      } else if (this.HIGH_RISK_COMMAND_PATTERNS.some(p => p.test(commandArg))) {
        computedLevel = this.elevate(computedLevel, 'HIGH');
        reasons.push('Command executes external scripts or process termination.');
      } else {
        computedLevel = this.elevate(computedLevel, 'MEDIUM');
        reasons.push('Shell command execution carries inherent medium system risk.');
      }
    }

    // 4. External Communications (Email, Messaging, WhatsApp)
    if (category === 'EMAIL' || category === 'MESSAGING' || lowerTool.includes('email') || lowerTool.includes('message') || lowerTool.includes('whatsapp')) {
      isExternalCommunication = true;
      if (lowerTool.includes('send') || lowerTool.includes('post') || lowerTool.includes('publish')) {
        computedLevel = this.elevate(computedLevel, 'HIGH');
        reasons.push('Sending an external message to an outside recipient cannot be undone.');
      } else {
        computedLevel = this.elevate(computedLevel, 'LOW'); // Draft / Read
        reasons.push('Drafting or reading messages is low impact.');
      }
    }

    // 5. System Settings / Admin Operations
    if (category === 'SYSTEM' && (lowerTool.includes('reboot') || lowerTool.includes('shutdown') || lowerTool.includes('service'))) {
      computedLevel = 'CRITICAL';
      reasons.push('Action affects overall Windows system availability.');
    }

    const requiresConfirmation = computedLevel === 'HIGH' || computedLevel === 'CRITICAL';
    const rollbackPossible = rollbackStrategy === 'REVERSIBLE' || rollbackStrategy === 'PARTIALLY_REVERSIBLE';

    if (!requiresConfirmation && reasons.length === 0) {
      reasons.push('Standard read-only or low-impact local operation.');
    }

    return {
      level: computedLevel,
      reasons,
      requiresConfirmation,
      isDestructive,
      isExternalCommunication,
      impactScope: category,
      rollbackPossible
    };
  }

  public static generateActionPreview(
    toolName: string,
    args: Record<string, unknown>,
    assessment: RiskAssessment,
    rollbackStrategy: 'REVERSIBLE' | 'PARTIALLY_REVERSIBLE' | 'IRREVERSIBLE' = 'IRREVERSIBLE'
  ): ActionPreviewCard {
    let target = 'System';
    if (args['targetPath'] || args['path'] || args['filePath']) {
      target = String(args['targetPath'] || args['path'] || args['filePath']);
    } else if (args['recipient'] || args['to'] || args['phone']) {
      target = String(args['recipient'] || args['to'] || args['phone']);
    } else if (args['url']) {
      target = String(args['url']);
    } else if (args['title']) {
      target = String(args['title']);
    }

    return {
      title: `Confirm Action: ${toolName}`,
      toolName,
      targetDescription: target,
      operationType: assessment.isExternalCommunication ? 'EXTERNAL_SEND' : assessment.isDestructive ? 'DESTRUCTIVE_CHANGE' : 'EXECUTE',
      riskLevel: assessment.level,
      reasons: assessment.reasons,
      reversibility: rollbackStrategy,
      payloadSummary: { ...args },
      requiresExplicitConfirmation: assessment.requiresConfirmation
    };
  }

  private static elevate(current: RiskLevel, target: RiskLevel): RiskLevel {
    const ranks: Record<RiskLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    return ranks[target] > ranks[current] ? target : current;
  }
}
