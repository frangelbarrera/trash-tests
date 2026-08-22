import { FindingCollector } from './findings/Finding.js';
import type { ScoreResult, ScoringWeights } from './scoring/ScoringEngine.js';
export interface OrchestratorOptions {
    /** Repository root (absolute). */
    repoRoot: string;
    /** Files to analyze (absolute paths). */
    files: string[];
    /** Coverage data path (optional, enables BC + EPC). */
    coveragePath?: string;
    /** Request mutation analysis when an integration is configured. */
    enableMutation?: boolean;
    /** Partial scoring weights; unset weights keep DEFAULT_WEIGHTS values. */
    weights?: Partial<ScoringWeights>;
    /** Rule identifiers disabled for the current repository. */
    disabledRuleIds?: string[];
    /** Explicit repository-relative finding suppressions. */
    suppressions?: Array<{
        ruleId: string;
        files: string;
        reason: string;
    }>;
    /** Logger. */
    log?: (level: 'debug' | 'info' | 'warn', message: string) => void;
}
export interface OrchestratorResult {
    score: ScoreResult;
    findings: ReturnType<FindingCollector['getAll']>;
    filesAnalyzed: number;
    testsAnalyzed: number;
    stats: {
        staticMs: number;
        mutationMs: number;
        totalMs: number;
    };
}
/**
 * Orchestrates the analysis pipeline:
 * 1. Parse each file via LanguageAdapter
 * 2. Run all rules on each file
 * 3. Compute subscores
 * 4. Compute final MTC
 */
export declare class Orchestrator {
    private adapter;
    private registry;
    private scoring;
    constructor(weights?: Partial<ScoringWeights>);
    analyze(options: OrchestratorOptions): Promise<OrchestratorResult>;
}
/**
 * Convenience: scan files matching a glob in a directory.
 */
export declare function findTestFiles(repoRoot: string, files: string[]): string[];
//# sourceMappingURL=orchestrator.d.ts.map