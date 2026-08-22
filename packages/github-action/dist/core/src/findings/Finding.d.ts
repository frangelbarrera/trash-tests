/**
 * Finding emitted by a rule when it detects a decorative test pattern.
 *
 * Every finding MUST include all 7 fields. Findings without all fields are
 * bugs in the rule and will be rejected by the FindingCollector.
 */
export interface Finding {
    /** Rule ID that emitted this finding (e.g., "no-assertion"). */
    ruleId: string;
    /** Severity level. `critical` blocks merge, `warning` is shown, `info` is informational only. */
    severity: 'critical' | 'warning' | 'info';
    /** Path to the test file (relative to repo root). */
    file: string;
    /** Line number (1-indexed) of the test declaration. */
    line: number;
    /** Name of the test (from `it()` / `test()` / `describe()` title). */
    testName: string;
    /** Human-readable explanation of WHY this test was flagged. */
    reason: string;
    /** Confidence score 0-1. How sure the rule is that this is a real problem. */
    confidence: number;
    /** Actionable next step the developer can take. */
    suggestedFix: string;
}
/**
 * Collector that dedupes and validates findings.
 */
export declare class FindingCollector {
    private findings;
    add(finding: Finding): void;
    addMany(findings: Finding[]): void;
    getAll(): Finding[];
    private validate;
    clear(): void;
    count(): number;
}
//# sourceMappingURL=Finding.d.ts.map