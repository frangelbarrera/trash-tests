import type { OrchestratorResult } from '@trash-tests/core'

export interface JsonReportContext {
  version: string
  repoRoot: string
  diff: { base: string; head: string }
  coveragePath?: string
}

export class JsonReporter {
  static format(result: OrchestratorResult, ctx: JsonReportContext): string {
    const payload = {
      schema: 'trashtests-report-v1',
      version: ctx.version,
      timestamp: null,
      input: {
        repoRoot: ctx.repoRoot,
        diff: ctx.diff,
        coverage: ctx.coveragePath ?? null,
      },
      score: {
        mtc: result.score.mtc,
        subscores: result.score.subscores,
        weights: result.score.effectiveWeights,
        renormalized: result.score.renormalized,
      },
      findings: result.findings,
      stats: {
        filesAnalyzed: result.filesAnalyzed,
        testsAnalyzed: result.testsAnalyzed,
        duration: result.stats,
      },
    }
    return JSON.stringify(payload, null, 2) + '\n'
  }
}
