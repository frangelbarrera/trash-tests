import type { ScoringWeights } from '../scoring/ScoringEngine.js';
/**
 * Shape of trashtests.config.ts — the optional configuration file read by the
 * CLI from the repository root.
 *
 * @see ../docs/configuration.md
 */
export interface TrashTestsConfig {
    /**
     * Scoring-related configuration.
     */
    scoring?: {
        /**
         * Custom relative weights. Unset dimensions keep the built-in defaults.
         * Only signals measured in a run participate in the score.
         */
        weights?: Partial<ScoringWeights>;
        /**
         * Repository-wide threshold (0-100). The CLI exits non-zero when the
         * score is below this value. `--fail-below` overrides it.
         */
        failBelow?: number;
    };
    /**
     * Rule-level controls for repository-specific exceptions.
     */
    rules?: {
        /** Rule identifiers to disable for the whole repository. */
        disabled?: string[];
        /** Explicit, reviewable suppressions for known exceptions. */
        suppressions?: Array<{
            /** Rule identifier to suppress. */
            ruleId: string;
            /** Glob matching repository-relative test files. */
            files: string;
            /** Reason retained in configuration for reviewers. */
            reason: string;
        }>;
    };
    /**
     * Glob of files to scan. Overridden by CLI positional arguments.
     */
    include?: string;
    /**
     * Glob of files to exclude.
     */
    exclude?: string;
    /**
     * Always scan the whole repository, ignoring the git diff.
     * Interacts with CLI `--scan-all` / `--diff`.
     */
    scanAll?: boolean;
}
//# sourceMappingURL=TrashTestsConfig.d.ts.map