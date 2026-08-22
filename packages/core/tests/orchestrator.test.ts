import { unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Orchestrator } from '../src/orchestrator.js'

const fixturesDir = join(import.meta.dirname, '../../fixtures')

describe('Orchestrator (integration)', () => {
  it('analyzes the decorative corpus and produces a low score', async () => {
    const orchestrator = new Orchestrator()
    const result = await orchestrator.analyze({
      repoRoot: fixturesDir,
      files: [
        join(fixturesDir, 'decorative/no-assertion.test.ts'),
        join(fixturesDir, 'decorative/tautology.test.ts'),
      ],
      log: () => {},
    })
    expect(result.filesAnalyzed).toBe(2)
    expect(result.testsAnalyzed).toBe(7)
    expect(result.findings.length).toBeGreaterThanOrEqual(7) // 3 no-assert + 4 trivial
    // Score should be low (assertionQuality should drag it down)
    expect(result.score.mtc).toBeLessThan(50)
  })

  it('analyzes the good corpus and produces a high score', async () => {
    const orchestrator = new Orchestrator()
    const result = await orchestrator.analyze({
      repoRoot: fixturesDir,
      files: [
        join(fixturesDir, 'good/lodash-get.test.ts'),
        join(fixturesDir, 'good/formatPrice.test.ts'),
      ],
      log: () => {},
    })
    expect(result.filesAnalyzed).toBe(2)
    expect(result.findings.length).toBe(0)
    expect(result.score.mtc).toBeGreaterThanOrEqual(80)
  })

  it('reports renormalization when coverage is missing', async () => {
    const orchestrator = new Orchestrator()
    const result = await orchestrator.analyze({
      repoRoot: fixturesDir,
      files: [join(fixturesDir, 'good/lodash-get.test.ts')],
      coveragePath: '/nonexistent/coverage.json',
      log: () => {},
    })
    expect(result.score.renormalized).toBe(true)
  })

  it('skipped and todo tests do NOT inflate testsAnalyzed', async () => {
    const tmpFile = join(fixturesDir, '__tmp_orchestrator_skip.test.ts')
    writeFileSync(
      tmpFile,
      `
      import { describe, it, expect } from 'vitest';
      describe('mixed', () => {
        it('real test 1', () => { expect(1).toBe(1); });
        it.skip('skipped test', () => { expect(2).toBe(2); });
        it.todo('todo test');
        it.skipIf(process.env.CI)('conditional skip', () => { expect(3).toBe(3); });
        it('real test 2', () => { expect(4).toBe(4); });
      });
      `,
    )
    try {
      const orchestrator = new Orchestrator()
      const result = await orchestrator.analyze({
        repoRoot: fixturesDir,
        files: [tmpFile],
        log: () => {},
      })
      expect(result.testsAnalyzed).toBe(2)
    } finally {
      try {
        unlinkSync(tmpFile)
      } catch {
        // ignore
      }
    }
  })

  it('supports disabled rules and documented suppressions', async () => {
    const file = join(fixturesDir, 'decorative/no-assertion.test.ts')
    const orchestrator = new Orchestrator()
    const disabled = await orchestrator.analyze({
      repoRoot: fixturesDir,
      files: [file],
      disabledRuleIds: ['no-assertion'],
      log: () => {},
    })
    expect(disabled.findings).toHaveLength(0)

    const suppressed = await orchestrator.analyze({
      repoRoot: fixturesDir,
      files: [file],
      suppressions: [
        {
          ruleId: 'no-assertion',
          files: 'decorative/**/*.test.ts',
          reason: 'Intentional smoke-test fixture',
        },
      ],
      log: () => {},
    })
    expect(suppressed.findings).toHaveLength(0)
  })

  it('skips a test file when no supported runner is detected', async () => {
    const tmpFile = join(fixturesDir, '__tmp_unknown_runner.test.ts')
    writeFileSync(tmpFile, `test('unknown runner', () => {})`)
    try {
      const result = await new Orchestrator().analyze({
        repoRoot: fixturesDir,
        files: [tmpFile],
        log: () => {},
      })
      expect(result.filesAnalyzed).toBe(0)
      expect(result.testsAnalyzed).toBe(0)
      expect(result.findings).toHaveLength(0)
    } finally {
      unlinkSync(tmpFile)
    }
  })
})
