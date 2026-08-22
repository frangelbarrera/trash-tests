/**
 * Finding emitted by a rule when it detects a decorative test pattern.
 *
 * Every finding MUST include all 7 fields. Findings without all fields are
 * bugs in the rule and will be rejected by the FindingCollector.
 */
export interface Finding {
  /** Rule ID that emitted this finding (e.g., "no-assertion"). */
  ruleId: string
  /** Severity level. `critical` blocks merge, `warning` is shown, `info` is informational only. */
  severity: 'critical' | 'warning' | 'info'
  /** Path to the test file (relative to repo root). */
  file: string
  /** Line number (1-indexed) of the test declaration. */
  line: number
  /** Name of the test (from `it()` / `test()` / `describe()` title). */
  testName: string
  /** Human-readable explanation of WHY this test was flagged. */
  reason: string
  /** Confidence score 0-1. How sure the rule is that this is a real problem. */
  confidence: number
  /** Actionable next step the developer can take. */
  suggestedFix: string
}

/**
 * Collector that dedupes and validates findings.
 */
export class FindingCollector {
  private findings: Finding[] = []

  add(finding: Finding): void {
    this.validate(finding)
    this.findings.push(finding)
  }

  addMany(findings: Finding[]): void {
    for (const f of findings) {
      this.add(f)
    }
  }

  getAll(): Finding[] {
    // Dedupe by (ruleId, file, line, testName) — same rule firing twice on same test is a bug.
    const seen = new Set<string>()
    const deduped: Finding[] = []
    for (const f of this.findings) {
      const key = `${f.ruleId}|${f.file}|${f.line}|${f.testName}`
      if (seen.has(key)) {
        continue
      }
      seen.add(key)
      deduped.push(f)
    }
    // Sort: critical first, then warning, then info. Within each tier, by file then line.
    const severityOrder = { critical: 0, warning: 1, info: 2 } as const
    deduped.sort((a, b) => {
      if (a.severity !== b.severity) {
        return severityOrder[a.severity] - severityOrder[b.severity]
      }
      if (a.file !== b.file) {
        return a.file.localeCompare(b.file)
      }
      return a.line - b.line
    })
    return deduped
  }

  private validate(finding: Finding): void {
    const required: (keyof Finding)[] = [
      'ruleId',
      'severity',
      'file',
      'line',
      'testName',
      'reason',
      'confidence',
      'suggestedFix',
    ]
    for (const key of required) {
      const value = finding[key]
      if (value === undefined || value === null || value === '') {
        throw new Error(
          `Finding is missing required field "${key}". Rule "${finding.ruleId}" has a bug.`,
        )
      }
    }
    if (finding.confidence < 0 || finding.confidence > 1) {
      throw new Error(
        `Finding confidence must be in [0, 1], got ${finding.confidence}. Rule "${finding.ruleId}" has a bug.`,
      )
    }
    if (finding.line < 1) {
      throw new Error(
        `Finding line must be ≥ 1, got ${finding.line}. Rule "${finding.ruleId}" has a bug.`,
      )
    }
  }

  clear(): void {
    this.findings = []
  }

  count(): number {
    return this.findings.length
  }
}
