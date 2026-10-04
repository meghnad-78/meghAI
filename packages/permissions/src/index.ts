import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type {
  PermissionScope,
  PermissionMode,
  PermissionGrant,
  RiskLevel,
  AutonomyLevel,
  SessionPermissionGrant,
  PersistentPermissionGrant,
  TrustedRoutineDefinition,
  AutonomousExecutionPolicy,
  PermissionAutoGrantedPayload,
  PermissionDecision,
  PermissionExplanation,
  PermissionEvaluationResult
} from '@meghai/shared-types';
import { PathValidator, KillSwitch } from '@meghai/security';

export type {
  PermissionDecision,
  PermissionExplanation,
  PermissionEvaluationResult
};

/**
 * Standard Default Auto-Allow Tools
 * Routine and low-risk actions authorized without asking (Section 2)
 */
export const DEFAULT_AUTO_ALLOW_TOOLS = new Set<string>([
  // Windows Apps / Control
  'windows.open_app',
  'windows.close_app',
  'windows.focus_app',
  'windows.list_apps',
  'windows.get_active_window',
  'windows.open_url',
  'windows.open_file',
  'windows.open_folder',
  'windows.get_system_info',

  // Browser Navigation & Reading
  'browser.open',
  'browser.navigate',
  'browser.back',
  'browser.forward',
  'browser.refresh',
  'browser.search',
  'browser.read_page',
  'browser.extract',
  'browser.scroll',
  'browser.get_tabs',
  'browser.switch_tab',

  // Windows File Reading & Exploration
  'windows.read_file',
  'windows.list_folder',
  'windows.search_files',
  'windows.get_file_metadata',
  'windows.clipboard.read',

  // Notes Management
  'notes.search',
  'notes.read',
  'notes.create',
  'notes.update',
  'notes.append',
  'note_create',
  'note_list',

  // Tasks Management
  'tasks.list',
  'tasks.search',
  'tasks.create',
  'tasks.update',
  'tasks.complete',
  'task_create',
  'task_list',

  // Safe developer commands
  'shell.safe_execute'
]);

/**
 * Trusted-Scope Reversible Filesystem Tools
 * Reversible modifications authorized automatically inside approved roots (Section 3)
 */
export const TRUSTED_SCOPE_FS_TOOLS = new Set<string>([
  'windows.create_file',
  'windows.write_file',
  'windows.append_file',
  'windows.create_folder',
  'windows.rename_file',
  'windows.move_file',
  'windows.copy_file'
]);

/**
 * High-Risk Actions that MUST still require explicit user confirmation (Section 4)
 */
export const CONFIRMATION_REQUIRED_TOOLS = new Set<string>([
  'windows.delete_file',
  'windows.delete_folder',
  'powershell.execute',
  'cmd.execute',
  'shell.execute',
  'email.send',
  'email.send_email',
  'messaging.send',
  'messaging.send_message',
  'browser.form.submit',
  'browser.submit_form',
  'credentials.modify',
  'system.config_change',
  'payments.purchase'
]);

/**
 * Read-Only Tools for STRICT_CONFIRMATION level
 */
export const READ_ONLY_TOOLS = new Set<string>([
  'windows.read_file',
  'windows.list_folder',
  'windows.search_files',
  'windows.get_file_metadata',
  'windows.get_system_info',
  'windows.list_apps',
  'windows.get_active_window',
  'browser.search',
  'browser.read_page',
  'browser.extract',
  'browser.get_tabs',
  'notes.search',
  'notes.read',
  'note_list',
  'tasks.list',
  'tasks.search',
  'task_list'
]);

/**
 * Hard-Blocked Security Invariants (Section 5)
 */
export const HARD_BLOCKED_PATTERNS = [
  /format\s+[a-z]:/i,
  /diskpart/i,
  /reg\s+(add|delete)/i,
  /rmdir\s+\/s\s+\/q/i,
  /rm\s+(-rf|-r|-f)\s+\//i,
  /curl.*\|\s*(bash|sh|cmd|powershell)/i,
  /wget.*-outfile.*start-process/i
];

/**
 * Sensitive System / Secret Directories that must NEVER be accessed autonomously
 */
export const SENSITIVE_DIRS = [
  '.ssh',
  '.aws',
  '.gnupg',
  '.azure',
  '.kube'
];

/**
 * Authoritative Permission Broker & Autonomous Execution Policy (Section 57, 59 & v0.4.1)
 * Evaluates whether a requested capability/scope is permitted for execution.
 * Enforces: BLOCK > EXPLICIT DENY > REQUIRED CONFIRMATION > USER GRANT > TRUSTED SCOPE > DEFAULT AUTO-ALLOW
 */
export class PermissionBroker {
  private grants: Map<PermissionScope, PermissionGrant> = new Map();
  private allowedRoots: string[] = [];
  private autonomyLevel: AutonomyLevel = 'FULL_SAFE_AUTOMATION';
  private sessionGrants: Map<string, SessionPermissionGrant> = new Map();
  private persistentGrants: Map<string, PersistentPermissionGrant> = new Map();
  private userOverrides: Map<string, 'ASK' | 'ALLOW' | 'DENY'> = new Map();
  private trustedRoutines: Map<string, TrustedRoutineDefinition> = new Map();
  private recentDecisions: PermissionAutoGrantedPayload[] = [];
  private storageFilePath?: string;

  constructor(initialAllowedRoots: string[] = [], storageFilePath?: string) {
    if (!initialAllowedRoots || initialAllowedRoots.length === 0) {
      this.allowedRoots = PathValidator.getStandardSafeRoots();
    } else {
      this.allowedRoots = initialAllowedRoots.map(r => path.resolve(r));
    }

    if (storageFilePath) {
      this.storageFilePath = storageFilePath;
    } else {
      const localAppData = process.env['LOCALAPPDATA'] || process.env['USERPROFILE'] || os.homedir();
      this.storageFilePath = path.join(localAppData, 'MeghAI', 'data', 'permissions.json');
    }

    this.initializeDefaults();
    this.loadPersistentState();
  }

  private initializeDefaults(): void {
    const now = new Date().toISOString();
    const defaults: Array<{ scope: PermissionScope; mode: PermissionMode }> = [
      { scope: 'MICROPHONE', mode: 'LOCAL_ONLY' },
      { scope: 'CAMERA', mode: 'DENIED' },
      { scope: 'SCREEN', mode: 'ASK' },
      { scope: 'FILESYSTEM', mode: 'SELECTED_FOLDERS' },
      { scope: 'BROWSER', mode: 'ALLOWED' },
      { scope: 'APPLICATIONS', mode: 'ALLOWED' },
      { scope: 'CLIPBOARD', mode: 'ALLOWED' },
      { scope: 'POWERSHELL', mode: 'ALLOWED_WITH_CONFIRMATION' },
      { scope: 'CMD', mode: 'ALLOWED_WITH_CONFIRMATION' },
      { scope: 'EMAIL', mode: 'ALLOWED_WITH_CONFIRMATION' },
      { scope: 'CALENDAR', mode: 'ALLOWED' },
      { scope: 'MESSAGING', mode: 'ALLOWED_WITH_CONFIRMATION' },
      { scope: 'CONTACTS', mode: 'ALLOWED' },
      { scope: 'NOTIFICATIONS', mode: 'ALLOWED' },
      { scope: 'CLOUD_PROVIDERS', mode: 'ALLOWED' },
      { scope: 'KNOWLEDGE_SOURCES', mode: 'ALLOWED' }
    ];

    for (const d of defaults) {
      this.grants.set(d.scope, {
        id: `grant-${d.scope.toLowerCase()}`,
        scope: d.scope,
        mode: d.mode,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  private loadPersistentState(): void {
    if (!this.storageFilePath) return;
    try {
      if (fs.existsSync(this.storageFilePath)) {
        const raw = fs.readFileSync(this.storageFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.autonomyLevel) {
          this.autonomyLevel = parsed.autonomyLevel;
        }
        if (Array.isArray(parsed.persistentGrants)) {
          for (const g of parsed.persistentGrants) {
            this.persistentGrants.set(g.id, g);
          }
        }
        if (parsed.userOverrides && typeof parsed.userOverrides === 'object') {
          for (const [k, v] of Object.entries(parsed.userOverrides)) {
            this.userOverrides.set(k, v as 'ASK' | 'ALLOW' | 'DENY');
          }
        }
      }
    } catch {
      // Memory fallback if persistent read is not possible
    }
  }

  private savePersistentState(): void {
    if (!this.storageFilePath) return;
    try {
      const dir = path.dirname(this.storageFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        autonomyLevel: this.autonomyLevel,
        persistentGrants: Array.from(this.persistentGrants.values()),
        userOverrides: Object.fromEntries(this.userOverrides)
      };
      fs.writeFileSync(this.storageFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Memory fallback if disk write is restricted
    }
  }

  // ---------------------------------------------------------------------------
  // Autonomy Policy Configuration
  // ---------------------------------------------------------------------------

  public getAutonomyPolicy(): AutonomousExecutionPolicy {
    return {
      level: this.autonomyLevel,
      defaultAutoAllowTools: Array.from(DEFAULT_AUTO_ALLOW_TOOLS),
      trustedRoots: [...this.allowedRoots],
      confirmationRequiredTools: Array.from(CONFIRMATION_REQUIRED_TOOLS),
      hardBlockedTools: [
        'system.format_drive',
        'system.modify_registry',
        'security.modify_credentials',
        'shell.execute_untrusted_binary'
      ],
      userOverrides: Object.fromEntries(this.userOverrides)
    };
  }

  public setAutonomyLevel(level: AutonomyLevel): void {
    this.autonomyLevel = level;
    this.savePersistentState();
  }

  public getAutonomyLevel(): AutonomyLevel {
    return this.autonomyLevel;
  }

  public setUserOverride(key: string, value: 'ASK' | 'ALLOW' | 'DENY' | 'ALWAYS_ALLOW' | 'ALWAYS_PROMPT' | 'ALWAYS_DENY'): void {
    let normalized: 'ASK' | 'ALLOW' | 'DENY';
    if (value === 'ALWAYS_ALLOW' || value === 'ALLOW') normalized = 'ALLOW';
    else if (value === 'ALWAYS_DENY' || value === 'DENY') normalized = 'DENY';
    else normalized = 'ASK';
    this.userOverrides.set(key, normalized);
    this.savePersistentState();
  }

  public clearUserOverride(key: string): void {
    this.userOverrides.delete(key);
    this.savePersistentState();
  }

  public getUserOverrides(): Record<string, 'ASK' | 'ALLOW' | 'DENY'> {
    return Object.fromEntries(this.userOverrides);
  }

  // ---------------------------------------------------------------------------
  // Roots Management
  // ---------------------------------------------------------------------------

  public setAllowedRoots(roots: string[]): void {
    this.allowedRoots = roots.map(r => path.resolve(r));
  }

  public getAllowedRoots(): string[] {
    return [...this.allowedRoots];
  }

  public addTrustedRoot(root: string): void {
    const resolved = path.resolve(root);
    if (!this.allowedRoots.includes(resolved)) {
      this.allowedRoots.push(resolved);
    }
  }

  public removeTrustedRoot(root: string): void {
    const resolved = path.resolve(root);
    this.allowedRoots = this.allowedRoots.filter(r => r !== resolved);
  }

  // ---------------------------------------------------------------------------
  // Session Trust
  // ---------------------------------------------------------------------------

  public createSessionGrant(
    grantOrTool: string | Omit<SessionPermissionGrant, 'id' | 'createdAt'>,
    targetRoot?: string,
    durationMs = 60000,
    sessionId = 'default'
  ): SessionPermissionGrant {
    const id = `sess-grant-${crypto.randomBytes(4).toString('hex')}`;
    let fullGrant: SessionPermissionGrant;
    if (typeof grantOrTool === 'string') {
      const now = Date.now();
      fullGrant = {
        id,
        sessionId,
        scope: this.getScopeForTool(grantOrTool),
        toolId: grantOrTool,
        targetRoot,
        target: targetRoot,
        riskCeiling: 'HIGH',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + durationMs).toISOString()
      };
    } else {
      fullGrant = {
        ...grantOrTool,
        id,
        createdAt: new Date().toISOString()
      };
    }
    this.sessionGrants.set(id, fullGrant);
    return fullGrant;
  }

  public listSessionGrants(sessionId?: string): SessionPermissionGrant[] {
    const now = Date.now();
    const active: SessionPermissionGrant[] = [];
    for (const [id, grant] of this.sessionGrants.entries()) {
      if (new Date(grant.expiresAt).getTime() < now) {
        this.sessionGrants.delete(id);
        continue;
      }
      if (!sessionId || grant.sessionId === sessionId) {
        active.push(grant);
      }
    }
    return active;
  }

  public clearSessionGrants(sessionId?: string): void {
    if (!sessionId) {
      this.sessionGrants.clear();
      return;
    }
    for (const [id, grant] of this.sessionGrants.entries()) {
      if (grant.sessionId === sessionId) {
        this.sessionGrants.delete(id);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Persistent Trust
  // ---------------------------------------------------------------------------

  public addPersistentGrant(
    grantOrTool: string | Omit<PersistentPermissionGrant, 'id' | 'createdAt'>,
    targetPattern?: string,
    grantedBy = 'user'
  ): PersistentPermissionGrant {
    const id = `perm-grant-${crypto.randomBytes(4).toString('hex')}`;
    let fullGrant: PersistentPermissionGrant;
    if (typeof grantOrTool === 'string') {
      fullGrant = {
        id,
        capability: grantOrTool,
        toolId: grantOrTool,
        scope: this.getScopeForTool(grantOrTool),
        targetPattern,
        targetRoot: targetPattern,
        grantedBy,
        createdAt: new Date().toISOString(),
        revoked: false
      };
    } else {
      fullGrant = {
        ...grantOrTool,
        id,
        createdAt: new Date().toISOString(),
        revoked: false
      };
    }
    this.persistentGrants.set(id, fullGrant);
    this.savePersistentState();
    return fullGrant;
  }

  public revokePersistentGrant(id: string): boolean {
    const grant = this.persistentGrants.get(id);
    if (grant) {
      grant.revoked = true;
      this.persistentGrants.delete(id);
      this.savePersistentState();
      return true;
    }
    return false;
  }

  public listPersistentGrants(): PersistentPermissionGrant[] {
    return Array.from(this.persistentGrants.values()).filter(g => !g.revoked);
  }

  // ---------------------------------------------------------------------------
  // Trusted Routines
  // ---------------------------------------------------------------------------

  public registerTrustedRoutine(routine: TrustedRoutineDefinition): void {
    this.trustedRoutines.set(routine.id, routine);
  }

  public getTrustedRoutine(id: string): TrustedRoutineDefinition | undefined {
    return this.trustedRoutines.get(id);
  }

  // ---------------------------------------------------------------------------
  // Audit Decisions Logging
  // ---------------------------------------------------------------------------

  public recordDecision(decision: PermissionAutoGrantedPayload): void {
    this.recentDecisions.unshift(decision);
    if (this.recentDecisions.length > 100) {
      this.recentDecisions.pop();
    }
  }

  public getRecentDecisions(limit = 50): PermissionAutoGrantedPayload[] {
    return this.recentDecisions.slice(0, limit);
  }

  // ---------------------------------------------------------------------------
  // Standard Scope Grants (Backwards Compatibility)
  // ---------------------------------------------------------------------------

  public grant(scope: PermissionScope, mode: PermissionMode, targets?: string[]): PermissionGrant {
    const existing = this.grants.get(scope);
    const now = new Date().toISOString();
    const grant: PermissionGrant = {
      id: existing?.id || `grant-${scope.toLowerCase()}`,
      scope,
      mode,
      allowedTargets: targets,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    this.grants.set(scope, grant);
    return grant;
  }

  public revoke(scope: PermissionScope): void {
    this.grant(scope, 'DENIED');
  }

  public listGrants(): PermissionGrant[] {
    return Array.from(this.grants.values());
  }

  public getGrant(scope: PermissionScope): PermissionGrant | undefined {
    return this.grants.get(scope);
  }

  /**
   * Helper: check if target path is strictly inside a root directory
   */
  private isPathInsideRoot(targetPath: string, rootDir: string): boolean {
    const normTarget = path.resolve(targetPath).toLowerCase();
    const normRoot = path.resolve(rootDir).toLowerCase();
    return normTarget === normRoot || normTarget.startsWith(normRoot + path.sep);
  }

  /**
   * Helper: check if path touches a sensitive system directory
   */
  private isSensitiveDirectory(targetPath: string): boolean {
    const lower = path.resolve(targetPath).toLowerCase();
    return SENSITIVE_DIRS.some(s => lower.includes(path.sep + s) || lower.endsWith(path.sep + s));
  }

  /**
   * Helper: map tool ID to canonical permission scope
   */
  public getScopeForTool(toolId: string): PermissionScope {
    if (toolId.startsWith('browser.')) return 'BROWSER';
    if (toolId.startsWith('notes.') || toolId.startsWith('tasks.') || toolId.startsWith('note_') || toolId.startsWith('task_')) return 'KNOWLEDGE_SOURCES';
    if (toolId.startsWith('windows.clipboard.')) return 'CLIPBOARD';
    if (toolId.startsWith('windows.read_file') || toolId.startsWith('windows.write_file') || toolId.startsWith('windows.create_') || toolId.startsWith('windows.delete_') || toolId.startsWith('windows.list_folder') || toolId.startsWith('windows.search_files') || toolId.startsWith('windows.get_file_') || toolId.startsWith('windows.rename_') || toolId.startsWith('windows.move_') || toolId.startsWith('windows.copy_') || toolId.startsWith('file_')) return 'FILESYSTEM';
    if (toolId.startsWith('windows.')) return 'APPLICATIONS';
    if (toolId.startsWith('powershell.')) return 'POWERSHELL';
    if (toolId.startsWith('cmd.')) return 'CMD';
    if (toolId.startsWith('shell.')) return 'POWERSHELL';
    if (toolId.startsWith('email.')) return 'EMAIL';
    if (toolId.startsWith('messaging.')) return 'MESSAGING';
    if (toolId.startsWith('calendar.')) return 'CALENDAR';
    return 'APPLICATIONS';
  }

  /**
   * Authoritative Action Evaluation Engine (Section 11 Precedence)
   * Enforces: BLOCK > EXPLICIT DENY > REQUIRED CONFIRMATION > USER GRANT > TRUSTED SCOPE > DEFAULT AUTO-ALLOW
   */
  public evaluateAction(
    toolId: string,
    target?: string,
    context?: {
      sessionId?: string;
      routineId?: string;
      riskLevel?: RiskLevel;
      isReversible?: boolean;
      userConfirmed?: boolean;
      commandArgs?: Record<string, unknown>;
    }
  ): PermissionEvaluationResult {
    const scope = this.getScopeForTool(toolId);
    const lowerTool = toolId.toLowerCase();

    // =========================================================================
    // 1. BLOCK (Hard Security Blocks - Highest Precedence)
    // =========================================================================
    if (KillSwitch.isActive()) {
      return {
        decision: 'BLOCK',
        granted: false,
        requiresConfirmation: false,
        reason: 'Emergency Kill Switch is active. All tool executions halted.',
        ruleMatched: 'KILL_SWITCH',
        effectiveRisk: 'CRITICAL',
        riskLevel: 'CRITICAL',
        scope,
        target
      };
    }

    // A. Check hard-blocked commands & patterns
    const cmdCandidates: string[] = [];
    if (context?.commandArgs) {
      const cmdStr = String(context.commandArgs['command'] || context.commandArgs['cmd'] || context.commandArgs['script'] || '');
      if (cmdStr) cmdCandidates.push(cmdStr);
    }
    if (target && typeof target === 'string') {
      cmdCandidates.push(target);
    }
    for (const cmd of cmdCandidates) {
      for (const pattern of HARD_BLOCKED_PATTERNS) {
        if (pattern.test(cmd)) {
          return {
            decision: 'BLOCK',
            granted: false,
            requiresConfirmation: false,
            reason: `HARD_SECURITY_BLOCK: Execution prohibited by pattern: ${pattern}`,
            ruleMatched: 'HARD_SECURITY_BLOCK',
            effectiveRisk: 'CRITICAL',
            riskLevel: 'CRITICAL',
            scope,
            target
          };
        }
      }
    }

    // B. Check system directories for any filesystem or modification action
    if (target && typeof target === 'string') {
      const validation = PathValidator.validatePath(target, []);
      if (!validation.isSafe && validation.error?.includes('protected Windows system location')) {
        return {
          decision: 'BLOCK',
          granted: false,
          requiresConfirmation: false,
          reason: `HARD_SECURITY_BLOCK: ${validation.error}`,
          ruleMatched: 'HARD_SECURITY_BLOCK',
          effectiveRisk: 'CRITICAL',
          riskLevel: 'CRITICAL',
          scope,
          target
        };
      }

      // Prohibit autonomous manipulation of sensitive credential dirs (.ssh, .aws, .gnupg)
      if (this.isSensitiveDirectory(target)) {
        return {
          decision: 'BLOCK',
          granted: false,
          requiresConfirmation: false,
          reason: 'HARD_SECURITY_BLOCK: Autonomous access to sensitive credential and identity directories is strictly prohibited.',
          ruleMatched: 'HARD_SECURITY_BLOCK',
          effectiveRisk: 'CRITICAL',
          riskLevel: 'CRITICAL',
          scope,
          target
        };
      }
    }

    // =========================================================================
    // 2. EXPLICIT DENY (User-Defined Explicit Blocks)
    // =========================================================================
    const toolOverride = this.userOverrides.get(toolId);
    const scopeOverride = this.userOverrides.get(scope.toLowerCase()) || this.userOverrides.get(scope);
    if (toolOverride === 'DENY' || scopeOverride === 'DENY') {
      return {
        decision: 'BLOCK',
        granted: false,
        requiresConfirmation: false,
        reason: `USER_OVERRIDE_DENY: Prohibited by explicit user override rule.`,
        ruleMatched: 'USER_OVERRIDE_DENY',
        effectiveRisk: 'HIGH',
        scope,
        target
      };
    }

    const grant = this.grants.get(scope);
    if (grant && grant.mode === 'DENIED') {
      return {
        decision: 'BLOCK',
        granted: false,
        requiresConfirmation: false,
        reason: `EXPLICIT_DENY: Scope '${scope}' is configured as DENIED.`,
        ruleMatched: 'EXPLICIT_DENY',
        effectiveRisk: 'HIGH',
        scope,
        target
      };
    }

    // =========================================================================
    // 4. USER GRANT (Trusted Routines, Session Trust & Persistent Grants)
    // Evaluated BEFORE general required confirmation for authorized grants!
    // =========================================================================
    // A. Trusted Routine Support
    if (context?.routineId) {
      const routine = this.trustedRoutines.get(context.routineId);
      if (routine && routine.enabled) {
        if (routine.allowedTools.includes(toolId) || routine.allowedScopes.includes(scope)) {
          return {
            decision: 'ALLOW',
            granted: true,
            requiresConfirmation: false,
            reason: `Auto-authorized under Trusted Routine '${routine.name}'.`,
            ruleMatched: 'TRUSTED_ROUTINE',
            effectiveRisk: 'LOW',
            autoAuthorized: true,
            policyRule: 'TRUSTED_ROUTINE',
            scope,
            target
          };
        }
      }
    }

    // B. Session Trust Support
    const activeSessionGrants = this.listSessionGrants(context?.sessionId);
    for (const sg of activeSessionGrants) {
      const matchTool = sg.scope === scope || sg.scope === toolId || sg.toolId === toolId;
      if (matchTool) {
        if ((sg.target || sg.targetRoot) && target) {
          const matchTarget = (sg.target === target) || (sg.targetRoot && (sg.targetRoot === target || this.isPathInsideRoot(target, sg.targetRoot)));
          if (!matchTarget) {
            continue;
          }
        }
        return {
          decision: 'ALLOW',
          granted: true,
          requiresConfirmation: false,
          reason: `Auto-authorized under active Session Trust Grant for session '${sg.sessionId}'.`,
          ruleMatched: 'SESSION_GRANT',
          effectiveRisk: 'LOW',
          autoAuthorized: true,
          policyRule: 'SESSION_GRANT',
          scope,
          target
        };
      }
    }

    // C. Persistent Scoped Trust Support
    const activePersistent = this.listPersistentGrants();
    for (const pg of activePersistent) {
      const matchTool = pg.capability === toolId || pg.toolId === toolId || pg.scope === scope;
      if (matchTool) {
        if (pg.targetPattern && target) {
          const regex = new RegExp('^' + pg.targetPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i');
          if (!regex.test(target) && !regex.test(path.basename(target))) {
            continue;
          }
        } else if (pg.targetRoot && target) {
          if (!this.isPathInsideRoot(target, pg.targetRoot)) {
            continue;
          }
        }
        return {
          decision: 'ALLOW',
          granted: true,
          requiresConfirmation: false,
          reason: `Auto-authorized under persistent user grant '${pg.capability || pg.toolId}'.`,
          ruleMatched: 'PERSISTENT_GRANT',
          effectiveRisk: 'LOW',
          autoAuthorized: true,
          policyRule: 'PERSISTENT_GRANT',
          scope,
          target
        };
      }
    }

    // =========================================================================
    // 3. REQUIRED CONFIRMATION (High-Risk or Destructive Actions)
    // =========================================================================
    // A. Check user overrides requiring confirmation
    const requiresUserAsk = toolOverride === 'ASK' || scopeOverride === 'ASK';

    // B. Check if tool is inherently high-risk / confirmation-required
    const isConfirmationRequiredTool = CONFIRMATION_REQUIRED_TOOLS.has(toolId);

    // C. Check strict confirmation level (everything non-read-only requires confirmation)
    const isStrictModeAsk = this.autonomyLevel === 'STRICT_CONFIRMATION' && !READ_ONLY_TOOLS.has(toolId);

    if (isConfirmationRequiredTool || requiresUserAsk || isStrictModeAsk) {
      if (context?.userConfirmed) {
        return {
          decision: 'ALLOW',
          granted: true,
          requiresConfirmation: false,
          reason: 'User explicitly confirmed high-impact action.',
          ruleMatched: 'USER_CONFIRMED',
          effectiveRisk: context?.riskLevel || 'HIGH',
          riskLevel: context?.riskLevel || 'HIGH',
          scope,
          target,
          autoAuthorized: false
        };
      }

      // Generate structured explanation (WHAT, TARGET, IMPACT, REVERSIBILITY)
      let what = `Execute ${toolId}`;
      let impact = 'High-impact operation requires user confirmation.';
      let reversibility = context?.isReversible ?? false;

      if (lowerTool.includes('delete')) {
        what = `Delete file or folder`;
        impact = `Deleting '${target || 'target'}' permanently removes data and cannot be undone.`;
        reversibility = false;
      } else if (lowerTool.includes('email.send')) {
        what = 'Send external email';
        impact = `Transmits email to external recipient.`;
        reversibility = false;
      } else if (lowerTool.includes('messaging.send')) {
        what = 'Send instant message';
        impact = `Transmits message over external messaging network.`;
        reversibility = false;
      } else if (lowerTool.includes('form.submit') || lowerTool.includes('submit_form')) {
        what = 'Submit web form';
        impact = `Submits form data to external web service.`;
        reversibility = false;
      } else if (lowerTool.includes('shell') || lowerTool.includes('cmd') || lowerTool.includes('powershell')) {
        what = 'Execute shell command';
        impact = `Runs script or binary on Windows operating system.`;
        reversibility = false;
      }

      return {
        decision: 'REQUIRE_CONFIRMATION',
        granted: false,
        requiresConfirmation: true,
        reason: `HIGH_RISK_CONFIRMATION: ${impact}`,
        ruleMatched: 'REQUIRED_CONFIRMATION_HIGH_RISK',
        effectiveRisk: context?.riskLevel || 'HIGH',
        riskLevel: context?.riskLevel || 'HIGH',
        scope,
        target,
        explanation: {
          what,
          target: target || 'System',
          impact,
          reversibility
        }
      };
    }

    // =========================================================================
    // 5. TRUSTED SCOPE (Reversible Filesystem Actions Inside Approved Roots)
    // =========================================================================
    if (TRUSTED_SCOPE_FS_TOOLS.has(toolId)) {
      if (target && typeof target === 'string') {
        const isInsideTrustedRoot = this.allowedRoots.some(root => this.isPathInsideRoot(target, root));
        if (isInsideTrustedRoot) {
          return {
            decision: 'ALLOW',
            granted: true,
            requiresConfirmation: false,
            reason: 'Auto-authorized under TRUSTED_SCOPE automation (reversible operation in approved directory).',
            ruleMatched: 'TRUSTED_SCOPE',
            effectiveRisk: 'MEDIUM',
            autoAuthorized: true,
            policyRule: 'TRUSTED_SCOPE_AUTOMATION',
            scope,
            target
          };
        } else {
          // Target is outside approved roots
          if (context?.userConfirmed) {
            return {
              decision: 'ALLOW',
              granted: true,
              requiresConfirmation: false,
              reason: 'User confirmed action outside approved roots.',
              ruleMatched: 'USER_CONFIRMED',
              effectiveRisk: 'MEDIUM',
              scope,
              target
            };
          }
          return {
            decision: 'REQUIRE_CONFIRMATION',
            granted: false,
            requiresConfirmation: true,
            reason: `Target path '${target}' resides outside approved roots. User confirmation required.`,
            ruleMatched: 'UNTRUSTED_SCOPE_CONFIRMATION',
            effectiveRisk: 'MEDIUM',
            riskLevel: 'MEDIUM',
            scope,
            target,
            explanation: {
              what: `Create or write file`,
              target,
              impact: `Accesses filesystem outside trusted roots.`,
              reversibility: true
            }
          };
        }
      }
    }

    // =========================================================================
    // 6. DEFAULT AUTO-ALLOW (Routine Non-Destructive Actions)
    // =========================================================================
    if (DEFAULT_AUTO_ALLOW_TOOLS.has(toolId)) {
      if (this.autonomyLevel === 'FULL_SAFE_AUTOMATION' || this.autonomyLevel === 'DEVELOPER_AUTOMATION') {
        return {
          decision: 'ALLOW',
          granted: true,
          requiresConfirmation: false,
          reason: 'Auto-authorized under DEFAULT_AUTO_ALLOW policy.',
          ruleMatched: 'DEFAULT_AUTO_ALLOW',
          effectiveRisk: 'LOW',
          autoAuthorized: true,
          policyRule: 'DEFAULT_AUTO_ALLOW',
          scope,
          target
        };
      }
      if (this.autonomyLevel === 'STRICT_CONFIRMATION') {
        if (READ_ONLY_TOOLS.has(toolId)) {
          return {
            decision: 'ALLOW',
            granted: true,
            requiresConfirmation: false,
            reason: 'Auto-authorized read-only action in strict mode.',
            ruleMatched: 'READ_ONLY_AUTO_ALLOW',
            effectiveRisk: 'LOW',
            autoAuthorized: true,
            policyRule: 'READ_ONLY_AUTO_ALLOW',
            scope,
            target
          };
        }
      }
    }

    // =========================================================================
    // 7. FALLBACK TO SCOPE EVALUATION (Backwards Compatibility)
    // =========================================================================
    return this.evaluate(scope, target);
  }

  /**
   * Evaluate whether an action is permitted by general scope (Backwards Compatibility)
   */
  public evaluate(scope: PermissionScope, target?: string): PermissionEvaluationResult {
    const grant = this.grants.get(scope);
    if (!grant || grant.mode === 'DENIED') {
      return {
        decision: 'BLOCK',
        granted: false,
        requiresConfirmation: false,
        reason: `Permission scope ${scope} is DENIED by user policy.`,
        scope
      };
    }

    if (grant.mode === 'ASK') {
      return {
        decision: 'REQUIRE_CONFIRMATION',
        granted: false,
        requiresConfirmation: true,
        reason: `Permission scope ${scope} requires user approval.`,
        scope
      };
    }

    if (grant.mode === 'ALLOWED_WITH_CONFIRMATION') {
      return {
        decision: 'REQUIRE_CONFIRMATION',
        granted: true,
        requiresConfirmation: true,
        reason: `Permission scope ${scope} is allowed, but high-impact action requires confirmation.`,
        scope
      };
    }

    if (grant.mode === 'SELECTED_FOLDERS' && scope === 'FILESYSTEM') {
      if (!target) {
        return { decision: 'ALLOW', granted: true, requiresConfirmation: false, reason: 'Filesystem permitted for selected folders.', scope };
      }
      const match = this.allowedRoots.some(r => this.isPathInsideRoot(target, r));

      if (!match) {
        return {
          decision: 'BLOCK',
          granted: false,
          requiresConfirmation: false,
          reason: `Target path '${target}' is outside configured permitted folders.`,
          scope,
          target
        };
      }
    }

    if (grant.mode === 'SELECTED_APPS' && scope === 'APPLICATIONS') {
      if (target && grant.allowedTargets && grant.allowedTargets.length > 0) {
        const isAllowedApp = grant.allowedTargets.some((app: string) => app.toLowerCase() === target.toLowerCase());
        if (!isAllowedApp) {
          return {
            decision: 'BLOCK',
            granted: false,
            requiresConfirmation: false,
            reason: `Target application '${target}' is not in the allowed applications list.`,
            scope,
            target
          };
        }
      }
    }

    return {
      decision: 'ALLOW',
      granted: true,
      requiresConfirmation: false,
      reason: `Permission scope ${scope} is ALLOWED.`,
      scope,
      target
    };
  }
}
