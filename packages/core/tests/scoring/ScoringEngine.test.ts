import { describe, expect, it } from 'vitest'
import { ScoringEngine } from '../../src/scoring/ScoringEngine.js'
import type { Subscores } from '../../src/scoring/ScoringEngine.js'

describe('ScoringEngine', () => {
  it('computes MTC from all 5 subscores', () => {
    const engine = new ScoringEngine()
    const subscores: Subscores = {
      assertionQuality: 50,
      branchCoverage: 50,
      mutationResistance: 50,
      errorPathCoverage: 50,
      mockSanity: 50,
    }
    const result = engine.compute(subscores)
    expect(result.mtc).toBe(50)
    expect(result.renormalized).toBe(false)
  })

  it('clamps score to [0, 100]', () => {
    const engine = new ScoringEngine()
    const result = engine.compute({
      assertionQuality: 200,
      branchCoverage: 100,
      mutationResistance: 100,
      errorPathCoverage: 100,
      mockSanity: 100,
    })
    expect(result.mtc).toBe(100)
  })

  it('renormalizes when subscores are null', () => {
    const engine = new ScoringEngine()
    const result = engine.compute({
      assertionQuality: 100,
      branchCoverage: null,
      mutationResistance: null,
      errorPathCoverage: null,
      mockSanity: null,
    })
    expect(result.mtc).toBe(100)
    expect(result.renormalized).toBe(true)
    expect(result.effectiveWeights.assertionQuality).toBe(1.0)
    expect(result.effectiveWeights.branchCoverage).toBe(0)
    expect(result.analysisMode).toBe('static-only')
    expect(result.evidenceConfidence).toBe('low')
    expect(result.evidenceCompleteness).toBe(20)
    expect(result.availableSignals).toEqual(['assertionQuality'])
    expect(result.missingSignals).toContain('mutationResistance')
  })

  it('reports coverage-assisted evidence when branch coverage is available', () => {
    const engine = new ScoringEngine()
    const result = engine.compute({
      assertionQuality: 80,
      branchCoverage: 60,
      mutationResistance: null,
      errorPathCoverage: null,
      mockSanity: null,
    })
    expect(result.analysisMode).toBe('coverage-assisted')
    expect(result.evidenceConfidence).toBe('medium')
    expect(result.evidenceCompleteness).toBe(40)
    expect(result.availableSignals).toEqual(['assertionQuality', 'branchCoverage'])
  })

  it('computes AssertionQuality from findings', () => {
    const tests = [
      {
        ruleId: 'no-assertion',
        severity: 'critical' as const,
        file: 'a.ts',
        line: 1,
        testName: 'no assert',
        reason: 'r',
        confidence: 0.9,
        suggestedFix: 'f',
      },
      {
        ruleId: 'trivial-assertion',
        severity: 'warning' as const,
        file: 'b.ts',
        line: 1,
        testName: 'trivial',
        reason: 'r',
        confidence: 0.85,
        suggestedFix: 'f',
      },
    ]
    // 3 tests: 1 no-assertion (0 pts), 1 trivial (0.2 pts), 1 good (1.0 pt)
    // Mean = (0 + 0.2 + 1.0) / 3 = 0.4 = 40
    const score = ScoringEngine.computeAssertionQuality(tests, 3)
    expect(score).toBe(40)
  })

  it('returns null AssertionQuality when there are 0 tests', () => {
    const score = ScoringEngine.computeAssertionQuality([], 0)
    expect(score).toBeNull()
  })

  it('accepts partial weights: unset weights keep defaults, all renormalized to sum 1.0', () => {
    const engine = new ScoringEngine({ branchCoverage: 0.6 })
    const result = engine.compute({
      assertionQuality: 100,
      branchCoverage: 100,
      mutationResistance: 100,
      errorPathCoverage: 100,
      mockSanity: 100,
    })
    const weights = result.effectiveWeights
    const sum = Object.values(weights).reduce((acc, w) => acc + w, 0)
    expect(sum).toBeCloseTo(1.0, 4)
    // Partial weights are relative: 0.6 / total(1.35) keeps branchCoverage dominant.
    expect(weights.branchCoverage).toBeCloseTo(0.6 / 1.35, 3)
    expect(weights.assertionQuality).toBeCloseTo(0.25 / 1.35, 3)
    // Dominance must move MTC: dropping AQ costs less than dropping BC.
    const low = engine.compute({
      assertionQuality: 0,
      branchCoverage: 100,
      mutationResistance: 100,
      errorPathCoverage: 100,
      mockSanity: 100,
    })
    const high = engine.compute({
      assertionQuality: 100,
      branchCoverage: 0,
      mutationResistance: 100,
      errorPathCoverage: 100,
      mockSanity: 100,
    })
    expect(low.mtc).toBeGreaterThan(high.mtc)
  })

  it('computes branch coverage from an istanbul coverage map', () => {
    const coverage = {
      'C:/repo/src/auth.ts': {
        path: 'C:/repo/src/auth.ts',
        b: {
          '1': [1, 0],
          '2': [0, 0],
        },
      },
    }
    const score = ScoringEngine.computeBranchCoverage(coverage, 'C:/repo')
    expect(score).toBe(25)
  })

  it('excludes test files, node_modules, dist and coverage from branch coverage', () => {
    const coverage = {
      'C:/repo/src/auth.ts': { path: 'C:/repo/src/auth.ts', b: { '1': [2, 2] } },
      'C:/repo/tests/auth.test.ts': { path: 'C:/repo/tests/auth.test.ts', b: { '1': [0, 2] } },
      'C:/repo/node_modules/x/index.js': {
        path: 'C:/repo/node_modules/x/index.js',
        b: { '1': [0, 2] },
      },
      'C:/repo/dist/index.js': { path: 'C:/repo/dist/index.js', b: { '1': [0, 2] } },
    }
    const score = ScoringEngine.computeBranchCoverage(coverage, 'C:/repo')
    expect(score).toBe(100)
  })

  it('returns null branch coverage when there are no branches to count', () => {
    expect(ScoringEngine.computeBranchCoverage(null, 'C:/repo')).toBeNull()
    expect(
      ScoringEngine.computeBranchCoverage(
        { 'C:/repo/src/a.ts': { path: 'C:/repo/src/a.ts', s: { '1': 1 } } },
        'C:/repo',
      ),
    ).toBeNull()
  })
})
