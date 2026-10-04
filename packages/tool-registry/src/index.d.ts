import type { ToolDefinition, ToolCategory } from '@meghai/shared-types';
/**
 * Authoritative Tool Registry (Section 43)
 */
export declare class ToolRegistry {
    private tools;
    constructor();
    register(tool: ToolDefinition): void;
    get(name: string): ToolDefinition | undefined;
    list(category?: ToolCategory): ToolDefinition[];
    getToolsForAgent(agentRole: string): ToolDefinition[];
    private registerStandardP0Tools;
    private registerUniversalActionTools;
}
//# sourceMappingURL=index.d.ts.map