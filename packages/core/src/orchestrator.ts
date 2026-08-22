import { existsSync, readFileSync } from 'node:fs'
import { extname, relative } from 'node:path'
import { TypeScriptAdapter } from './adapters/language/TypeScriptAdapter.js'
import { FindingCollector } from './findings/Finding.js'
import type { CoverageData, RuleContext } from './findings/RuleContext.js'
import { NoAssertionRule } from './rules/NoAssertion.js'
import { RuleRegistry } from './rules/Rule.js'
import { TrivialAssertionRule } from './rules/TrivialAssertion.js'
import { ScoringEngine } from './scoring/ScoringEngine.js'
import type {
  IstanbulCoverage,
  ScoreResult,
  ScoringWeights,
  Subscores,
} from './scoring/ScoringEngine.js'

export interface OrchestratorOptions {
  /** Repository root (absolute). */
  repoRoot: string
  /** Files to analyze (absolute paths). */
  files: string[]
  /** Coverage data path (optional, enables BC + EPC). */
  coveragePath?: string
  /** Request mutation analysis when an integration is configured. */
  enableMutation?: boolean
  /** Partial scoring weights; unset weights keep DEFAULT_WEIGHTS values. */
  weights?: Partial<ScoringWeights>
  /** Rule identifiers disabled for the current repository. */
  disabledRuleIds?: string[]
  /** Explicit repository-relative finding suppressions. */
  suppressions?: Array<{ ruleId: string; files: string; reason: string }>
  /** Logger. */
  log?: (level: 'debug' | 'info' | 'warn', message: string) => void
}

export interface OrchestratorResult {
  score: ScoreResult
  findings: ReturnType<FindingCollector['getAll']>
  filesAnalyzed: number
  testsAnalyzed: number
  stats: {
    staticMs: number
    mutationMs: number
    totalMs: number
  }
}

/**
 * Orchestrates the analysis pipeline:
 * 1. Parse each file via LanguageAdapter
 * 2. Run all rules on each file
 * 3. Compute subscores
 * 4. Compute final MTC
 */
export class Orchestrator {
  private adapter = new TypeScriptAdapter()
  private registry = new RuleRegistry()
  private scoring: ScoringEngine

  constructor(weights?: Partial<ScoringWeights>) {
    // Register all rules
    this.registry.register(new NoAssertionRule(this.adapter))
    this.registry.register(new TrivialAssertionRule(this.adapter))
    this.scoring = new ScoringEngine(weights)
  }

  async analyze(options: OrchestratorOptions): Promise<OrchestratorResult> {
    const startTime = Date.now()
    const log = options.log ?? (() => {})
    const collector = new FindingCollector()

    let filesAnalyzed = 0
    let testsAnalyzed = 0

    // Load coverage if provided
    let coverage: CoverageData | null = null
    if (options.coveragePath && existsSync(options.coveragePath)) {
      try {
        // Strip a UTF-8 BOM if present (common on Windows editors).
        const raw = readFileSync(options.coveragePath, 'utf8').replace(/^\uFEFF/, '')
        coverage = JSON.parse(raw) as CoverageData
        log('info', `Loaded coverage from ${options.coveragePath}`)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        log('warn', `Failed to parse coverage file: ${msg}`)
      }
    } else if (options.coveragePath) {
      log('warn', `Coverage file not found: ${options.coveragePath}`)
    } else {
      log('info', 'No coverage path provided; running in static-only mode.')
    }

    // Parse and analyze each file
    for (const file of options.files) {
      if (!this.adapter.canHandle(file)) {
        log('debug', `Skipping non-supported file: ${file}`)
        continue
      }
      const ast = this.adapter.parseFile(file, options.repoRoot, log)
      if (!ast) {
        continue
      }
      if (ast.runner === 'unknown') {
        log('warn', `Skipping ${ast.relativePath}: no supported test runner was detected.`)
        continue
      }
      filesAnalyzed++

      // Count tests; skipped and todo declarations do not inflate the score denominator.
      this.adapter.walkTests(ast, (_node, kind, _name, isSkipped) => {
        if (kind === 'test' && !isSkipped) testsAnalyzed++
      })

      const ctx: RuleContext = {
        file: ast,
        // Rules receive a consistent context for the current analysis.
        inDiff: false,
        coverage,
        runner: ast.runner,
        log,
      }

      for (const rule of this.registry.getAll()) {
        if (options.disabledRuleIds?.includes(rule.metadata.id)) {
          continue
        }
        try {
          const findings = rule
            .run(ctx)
            .filter(
              (finding) =>
                !options.suppressions?.some(
                  (suppression) =>
                    suppression.ruleId === finding.ruleId &&
                    matchesPattern(suppression.files, finding.file),
                ),
            )
          collector.addMany(findings)
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          log('warn', `Rule "${rule.metadata.id}" crashed on ${ast.relativePath}: ${msg}`)
        }
      }
    }

    const staticMs = Date.now() - startTime
    const mutationMs = 0
    if (options.enableMutation) {
      log(
        'warn',
        'Mutation analysis is not configured for this run; no mutation score was calculated.',
      )
    }

    // Compute subscores
    const allFindings = collector.getAll()
    // Deterministic ordering so runs produce byte-identical output.
    allFindings.sort(
      (a, b) =>
        a.file.localeCompare(b.file) ||
        a.line - b.line ||
        a.ruleId.localeCompare(b.ruleId) ||
        a.reason.localeCompare(b.reason),
    )
    const branchCoverage = ScoringEngine.computeBranchCoverage(
      coverage as IstanbulCoverage | null,
      options.repoRoot,
    )
    if (branchCoverage !== null) {
      log('info', `Repository production-code branch coverage: ${branchCoverage}%`)
    }
    const subscores: Subscores = {
      assertionQuality: ScoringEngine.computeAssertionQuality(allFindings, testsAnalyzed),
      branchCoverage: branchCoverage,
      mutationResistance: null,
      errorPathCoverage: null,
      mockSanity: null,
    }

    const score = this.scoring.compute(subscores)

    return {
      score,
      findings: allFindings,
      filesAnalyzed,
      testsAnalyzed,
      stats: {
        staticMs,
        mutationMs,
        totalMs: staticMs + mutationMs,
      },
    }
  }
}

/**
 * Convenience: scan files matching a glob in a directory.
 */
export function findTestFiles(repoRoot: string, files: string[]): string[] {
  return files.filter((f) => {
    const ext = extname(f).toLowerCase()
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return false
    return /(__tests__|tests?|\.test\.|\.spec\.)/.test(relative(repoRoot, f) || f)
  })
}

function matchesPattern(pattern: string, path: string): boolean {
  const marker = '\u0001'
  const escaped = pattern
    .replace(/\\/g, '/')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, marker)
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(new RegExp(`${marker}/`, 'g'), '(?:.*/)?')
    .replace(new RegExp(marker, 'g'), '.*')
  return new RegExp(`^${escaped}$`).test(path.replace(/\\/g, '/'))
}

// Public API is re-exported from src/index.ts.
// This file exports only the Orchestrator class and helpers.
