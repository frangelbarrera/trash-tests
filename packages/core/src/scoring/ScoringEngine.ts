import type { Finding } from '../findings/Finding.js'

/**
 * Default scoring weights. They are applied only to evidence that is available.
 *
 */
export interface ScoringWeights {
  assertionQuality: number
  branchCoverage: number
  mutationResistance: number
  errorPathCoverage: number
  mockSanity: number
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  assertionQuality: 0.25,
  branchCoverage: 0.25,
  mutationResistance: 0.2,
  errorPathCoverage: 0.2,
  mockSanity: 0.1,
}

/** Raw Istanbul coverage-final.json shape emitted by c8, Vitest, and Jest. */
export interface IstanbulFileCoverage {
  path: string
  /** Branch ID → execution count for each branch alternative. */
  b?: Record<string, number[]>
  /** Function ID → hit count. */
  f?: Record<string, number>
  /** Statement ID → hit count. */
  s?: Record<string, number>
}

export type IstanbulCoverage = Record<string, IstanbulFileCoverage>

export interface Subscores {
  assertionQuality: number | null
  /** Repository production-code branch coverage. */
  branchCoverage: number | null
  mutationResistance: number | null
  errorPathCoverage: number | null
  mockSanity: number | null
}

export type AnalysisMode = 'static-only' | 'coverage-assisted' | 'multi-signal'
export type EvidenceConfidence = 'low' | 'medium' | 'high'

export interface ScoreResult {
  /** Weighted score, 0-100, calculated from measured signals. */
  mtc: number
  /** Subscores. Null means the required evidence was unavailable. */
  subscores: Subscores
  /** Active weights after unavailable signals are removed. */
  effectiveWeights: ScoringWeights
  /** Whether unavailable signals caused the weights to be renormalized. */
  renormalized: boolean
  /** The evidence collection mode used for this result. */
  analysisMode: AnalysisMode
  /** Percentage of configured signals measured in this run. */
  evidenceCompleteness: number
  /** A human-readable confidence level derived from available signals. */
  evidenceConfidence: EvidenceConfidence
  /** Machine-readable list of signals that contributed to the result. */
  availableSignals: (keyof ScoringWeights)[]
  /** Machine-readable list of planned signals unavailable for this run. */
  missingSignals: (keyof ScoringWeights)[]
}

function classifyEvidence(availableSignals: (keyof ScoringWeights)[]): {
  analysisMode: AnalysisMode
  evidenceCompleteness: number
  evidenceConfidence: EvidenceConfidence
} {
  const evidenceCompleteness = Math.round((availableSignals.length / 5) * 100)
  const hasCoverage = availableSignals.includes('branchCoverage')

  if (availableSignals.length >= 3) {
    return { analysisMode: 'multi-signal', evidenceCompleteness, evidenceConfidence: 'high' }
  }
  if (hasCoverage) {
    return { analysisMode: 'coverage-assisted', evidenceCompleteness, evidenceConfidence: 'medium' }
  }
  return { analysisMode: 'static-only', evidenceCompleteness, evidenceConfidence: 'low' }
}

/**
 * Computes a weighted test-effectiveness score from measured signals.
 * Signals that are not measured are excluded from the calculation.
 */
export class ScoringEngine {
  private weights: ScoringWeights

  constructor(weights: Partial<ScoringWeights> = DEFAULT_WEIGHTS) {
    const merged: ScoringWeights = { ...DEFAULT_WEIGHTS, ...weights }
    const total = Object.values(merged).reduce((sum, weight) => sum + weight, 0)
    if (total > 0) {
      for (const key of Object.keys(merged) as (keyof ScoringWeights)[]) {
        merged[key] = Number((merged[key] / total).toFixed(4))
      }
    }
    this.weights = merged
  }

  compute(subscores: Subscores): ScoreResult {
    const entries: { key: keyof ScoringWeights; value: number }[] = []
    if (subscores.assertionQuality !== null) {
      entries.push({ key: 'assertionQuality', value: subscores.assertionQuality })
    }
    if (subscores.branchCoverage !== null) {
      entries.push({ key: 'branchCoverage', value: subscores.branchCoverage })
    }
    if (subscores.mutationResistance !== null) {
      entries.push({ key: 'mutationResistance', value: subscores.mutationResistance })
    }
    if (subscores.errorPathCoverage !== null) {
      entries.push({ key: 'errorPathCoverage', value: subscores.errorPathCoverage })
    }
    if (subscores.mockSanity !== null) {
      entries.push({ key: 'mockSanity', value: subscores.mockSanity })
    }

    const availableSignals = entries.map((entry) => entry.key)
    const missingSignals = (Object.keys(this.weights) as (keyof ScoringWeights)[]).filter(
      (key) => !availableSignals.includes(key),
    )
    const evidence = classifyEvidence(availableSignals)
    const totalWeight = entries.reduce((sum, entry) => sum + this.weights[entry.key], 0)

    if (totalWeight === 0) {
      return {
        mtc: 0,
        subscores,
        effectiveWeights: { ...this.weights },
        renormalized: false,
        ...evidence,
        availableSignals,
        missingSignals,
      }
    }

    const effectiveWeights: ScoringWeights = { ...this.weights }
    for (const key of missingSignals) {
      effectiveWeights[key] = 0
    }
    for (const key of availableSignals) {
      effectiveWeights[key] = effectiveWeights[key] / totalWeight
    }

    const mtc = entries.reduce(
      (sum, entry) => sum + (this.weights[entry.key] / totalWeight) * entry.value,
      0,
    )

    return {
      mtc: Math.round(Math.max(0, Math.min(100, mtc))),
      subscores,
      effectiveWeights,
      renormalized: entries.length < 5,
      ...evidence,
      availableSignals,
      missingSignals,
    }
  }

  /**
   * Assertion quality is a conservative static signal. A test with no detected
   * smell is not assumed to be semantically correct; it simply receives the
   * baseline point for this dimension.
   */
  static computeAssertionQuality(findings: Finding[], totalTests: number): number | null {
    if (totalTests === 0) return null

    const noAssertionTests = new Set<string>()
    const trivialTests = new Set<string>()
    for (const finding of findings) {
      const key = `${finding.file}|${finding.line}|${finding.testName}`
      if (finding.ruleId === 'no-assertion') noAssertionTests.add(key)
      if (finding.ruleId === 'trivial-assertion') trivialTests.add(key)
    }

    let points = 0
    for (let index = 0; index < totalTests; index++) {
      // Findings identify individual tests, so count their contribution once.
      // Any remaining test has no currently detected assertion smell.
      points += 1
    }
    points -= noAssertionTests.size
    points -= trivialTests.size * 0.8

    return Math.round((Math.max(0, points) / totalTests) * 100)
  }

  /**
   * Computes branch coverage for non-test production files in an Istanbul map.
   * The value represents repository-wide production-code coverage.
   */
  static computeBranchCoverage(
    coverage: IstanbulCoverage | null | undefined,
    repoRoot: string,
  ): number | null {
    if (!coverage) return null
    const root = repoRoot.replace(/\\/g, '/')
    let hits = 0
    let total = 0

    for (const [absolutePath, file] of Object.entries(coverage)) {
      const path = (file.path ?? absolutePath).replace(/\\/g, '/')
      if (!path.startsWith(root)) continue
      if (
        /(^|[\\/])node_modules[\\/]/.test(path) ||
        /(^|[\\/])dist[\\/]/.test(path) ||
        /(^|[\\/])\.git[\\/]/.test(path) ||
        /(^|[\\/])coverage[\\/]/.test(path) ||
        /(^|[\\/])(tests|test)[\\/]/.test(path) ||
        /[\\/]__tests__[\\/]/.test(path) ||
        /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(path)
      ) {
        continue
      }
      if (!file.b) continue
      for (const branchHits of Object.values(file.b)) {
        const finiteHits = branchHits.filter((count) => Number.isFinite(count))
        total += finiteHits.length
        hits += finiteHits.filter((count) => count > 0).length
      }
    }

    if (total === 0) return null
    return Math.round((hits / total) * 100)
  }
}
