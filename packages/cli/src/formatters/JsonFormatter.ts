import type { OrchestratorResult } from '@trash-tests/core'

export interface JsonFormatContext {
  repoRoot: string
  diff: { base: string; head: string }
  coveragePath?: string
}

export class JsonFormatter {
  static format(result: OrchestratorResult, ctx: JsonFormatContext): string {
    const payload = {
      schema: 'trashtests-report',
      timestamp: null,
      input: {
        repoRoot: ctx.repoRoot,
        diff: {
          base: ctx.diff.base,
          head: ctx.diff.head,
          files: result.filesAnalyzed,
          lines: 0,
        },
        coverage: ctx.coveragePath ?? null,
        junit: null,
      },
      score: {
        mtc: result.score.mtc,
        subscores: {
          assertionQuality: result.score.subscores.assertionQuality,
          branchCoverage: result.score.subscores.branchCoverage,
          mutationResistance: result.score.subscores.mutationResistance,
          errorPathCoverage: result.score.subscores.errorPathCoverage,
          mockSanity: result.score.subscores.mockSanity,
        },
        weights: result.score.effectiveWeights,
      },
      findings: result.findings.map((f) => ({
        ruleId: f.ruleId,
        severity: f.severity,
        file: f.file,
        line: f.line,
        testName: f.testName,
        reason: f.reason,
        suggestedFix: f.suggestedFix,
      })),
      stats: {
        filesAnalyzed: result.filesAnalyzed,
        testsAnalyzed: result.testsAnalyzed,
        testsFlagged: result.findings.filter((f) => f.severity !== 'info').length,
        duration: {
          staticMs: result.stats.staticMs,
          mutationMs: result.stats.mutationMs,
          totalMs: result.stats.totalMs,
        },
      },
    }
    return JSON.stringify(payload, null, 2) + '\n'
  }
}
