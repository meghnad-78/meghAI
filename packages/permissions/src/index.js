/**
 * Authoritative Permission Broker (Section 57 & 59)
 * Evaluates whether a requested capability/scope is permitted for execution.
 */
export class PermissionBroker {
    grants = new Map();
    allowedRoots = [];
    constructor(initialAllowedRoots = []) {
        this.allowedRoots = initialAllowedRoots;
        this.initializeDefaults();
    }
    initializeDefaults() {
        const now = new Date().toISOString();
        const defaults = [
            { scope: 'MICROPHONE', mode: 'LOCAL_ONLY' }, // Local wake-word allowed
            { scope: 'CAMERA', mode: 'DENIED' },
            { scope: 'SCREEN', mode: 'ASK' }, // Screen awareness requires explicit user trigger/ask
            { scope: 'FILESYSTEM', mode: 'SELECTED_FOLDERS' },
            { scope: 'BROWSER', mode: 'ASK' },
            { scope: 'APPLICATIONS', mode: 'ALLOWED_WITH_CONFIRMATION' },
            { scope: 'CLIPBOARD', mode: 'ASK' },
            { scope: 'POWERSHELL', mode: 'ALLOWED_WITH_CONFIRMATION' },
            { scope: 'CMD', mode: 'ALLOWED_WITH_CONFIRMATION' },
            { scope: 'EMAIL', mode: 'ALLOWED_WITH_CONFIRMATION' },
            { scope: 'CALENDAR', mode: 'ALLOWED_WITH_CONFIRMATION' },
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
    setAllowedRoots(roots) {
        this.allowedRoots = roots;
    }
    getAllowedRoots() {
        return [...this.allowedRoots];
    }
    grant(scope, mode, targets) {
        const existing = this.grants.get(scope);
        const now = new Date().toISOString();
        const grant = {
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
    revoke(scope) {
        this.grant(scope, 'DENIED');
    }
    listGrants() {
        return Array.from(this.grants.values());
    }
    getGrant(scope) {
        return this.grants.get(scope);
    }
    /**
     * Evaluate whether an action is permitted.
     */
    evaluate(scope, target) {
        const grant = this.grants.get(scope);
        if (!grant || grant.mode === 'DENIED') {
            return {
                granted: false,
                requiresConfirmation: false,
                reason: `Permission scope ${scope} is DENIED by user policy.`
            };
        }
        if (grant.mode === 'ASK') {
            return {
                granted: false,
                requiresConfirmation: true,
                reason: `Permission scope ${scope} requires user approval.`
            };
        }
        if (grant.mode === 'ALLOWED_WITH_CONFIRMATION') {
            return {
                granted: true,
                requiresConfirmation: true,
                reason: `Permission scope ${scope} is allowed, but high-impact action requires confirmation.`
            };
        }
        if (grant.mode === 'SELECTED_FOLDERS' && scope === 'FILESYSTEM') {
            if (!target) {
                return { granted: true, requiresConfirmation: false, reason: 'Filesystem permitted for selected folders.' };
            }
            const lowerTarget = target.toLowerCase();
            const match = this.allowedRoots.some(r => {
                const lowerRoot = r.toLowerCase();
                return lowerTarget === lowerRoot || lowerTarget.startsWith(lowerRoot + '\\') || lowerTarget.startsWith(lowerRoot + '/');
            });
            if (!match) {
                return {
                    granted: false,
                    requiresConfirmation: false,
                    reason: `Target path '${target}' is outside configured permitted folders.`
                };
            }
        }
        if (grant.mode === 'SELECTED_APPS' && scope === 'APPLICATIONS') {
            if (target && grant.allowedTargets && grant.allowedTargets.length > 0) {
                const isAllowedApp = grant.allowedTargets.some((app) => app.toLowerCase() === target.toLowerCase());
                if (!isAllowedApp) {
                    return {
                        granted: false,
                        requiresConfirmation: false,
                        reason: `Target application '${target}' is not in the allowed applications list.`
                    };
                }
            }
        }
        return {
            granted: true,
            requiresConfirmation: false,
            reason: `Permission scope ${scope} is ALLOWED.`
        };
    }
}
//# sourceMappingURL=index.js.map