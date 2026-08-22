import type { Finding } from '../findings/Finding.js';
/**
 * Default scoring weights. They are applied only to evidence that is available.
 *
 */
export interface ScoringWeights {
    assertionQuality: number;
    branchCoverage: number;
    mutationResistance: number;
    errorPathCoverage: number;
    mockSanity: number;
}
export declare const DEFAULT_WEIGHTS: ScoringWeights;
/** Raw Istanbul coverage-final.json shape emitted by c8, Vitest, and Jest. */
export interface IstanbulFileCoverage {
    path: string;
    /** Branch ID → execution count for each branch alternative. */
    b?: Record<string, number[]>;
    /** Function ID → hit count. */
    f?: Record<string, number>;
    /** Statement ID → hit count. */
    s?: Record<string, number>;
}
export type IstanbulCoverage = Record<string, IstanbulFileCoverage>;
export interface Subscores {
    assertionQuality: number | null;
    /** Repository production-code branch coverage. */
    branchCoverage: number | null;
    mutationResistance: number | null;
    errorPathCoverage: number | null;
    mockSanity: number | null;
}
export type AnalysisMode = 'static-only' | 'coverage-assisted' | 'multi-signal';
export type EvidenceConfidence = 'low' | 'medium' | 'high';
export interface ScoreResult {
    /** Weighted score, 0-100, calculated from measured signals. */
    mtc: number;
    /** Subscores. Null means the required evidence was unavailable. */
    subscores: Subscores;
    /** Active weights after unavailable signals are removed. */
    effectiveWeights: ScoringWeights;
    /** Whether unavailable signals caused the weights to be renormalized. */
    renormalized: boolean;
    /** The evidence collection mode used for this result. */
    analysisMode: AnalysisMode;
    /** Percentage of configured signals measured in this run. */
    evidenceCompleteness: number;
    /** A human-readable confidence level derived from available signals. */
    evidenceConfidence: EvidenceConfidence;
    /** Machine-readable list of signals that contributed to the result. */
    availableSignals: (keyof ScoringWeights)[];
    /** Machine-readable list of planned signals unavailable for this run. */
    missingSignals: (keyof ScoringWeights)[];
}
/**
 * Computes a weighted test-effectiveness score from measured signals.
 * Signals that are not measured are excluded from the calculation.
 */
export declare class ScoringEngine {
    private weights;
    constructor(weights?: Partial<ScoringWeights>);
    compute(subscores: Subscores): ScoreResult;
    /**
     * Assertion quality is a conservative static signal. A test with no detected
     * smell is not assumed to be semantically correct; it simply receives the
     * baseline point for this dimension.
     */
    static computeAssertionQuality(findings: Finding[], totalTests: number): number | null;
    /**
     * Computes branch coverage for non-test production files in an Istanbul map.
     * The value represents repository-wide production-code coverage.
     */
    static computeBranchCoverage(coverage: IstanbulCoverage | null | undefined, repoRoot: string): number | null;
}
//# sourceMappingURL=ScoringEngine.d.ts.map