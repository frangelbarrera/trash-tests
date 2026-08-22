import type { Finding } from '../findings/Finding.js';
import type { RuleContext } from '../findings/RuleContext.js';
/**
 * Metadata for a rule. Every rule MUST export this.
 */
export interface RuleMetadata {
    /** Stable rule ID (kebab-case, e.g., "no-assertion"). */
    id: string;
    /** Display name (e.g., "No Assertion"). */
    name: string;
    /** Severity level. */
    severity: 'critical' | 'warning' | 'info';
    /** Category for grouping in docs. */
    category: 'assertion' | 'coverage' | 'mock' | 'mutation' | 'structure';
    /** One-line description, shown in terminal output. */
    description: string;
    /** Estimated false-positive rate (0-1). Used by the calibration script. */
    fpEstimate: number;
}
/**
 * Interface that all rules implement.
 */
export interface Rule {
    /** Static metadata. */
    readonly metadata: RuleMetadata;
    /**
     * Run the rule against a parsed file.
     * Returns an array of findings (empty if none).
     */
    run(ctx: RuleContext): Finding[];
}
/**
 * Registry of all known rules.
 */
export declare class RuleRegistry {
    private rules;
    register(rule: Rule): void;
    get(id: string): Rule | undefined;
    getAll(): Rule[];
    /** Returns only rules whose category matches. */
    getByCategory(category: RuleMetadata['category']): Rule[];
}
//# sourceMappingURL=Rule.d.ts.map