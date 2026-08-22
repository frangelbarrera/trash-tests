import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TypeScriptAdapter } from '../../src/adapters/language/TypeScriptAdapter.js'
import { FindingCollector } from '../../src/findings/Finding.js'
import { NoAssertionRule } from '../../src/rules/NoAssertion.js'

const fixturesDir = join(import.meta.dirname, '../../../fixtures')

describe('NoAssertionRule', () => {
  const adapter = new TypeScriptAdapter()
  const rule = new NoAssertionRule(adapter)

  it('flags tests with zero assertions (decorative fixture)', () => {
    const file = adapter.parseFile(
      join(fixturesDir, 'decorative/no-assertion.test.ts'),
      fixturesDir,
    )
    expect(file).not.toBeNull()
    const collector = new FindingCollector()
    const findings = rule.run({
      file: file!,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    collector.addMany(findings)
    const all = collector.getAll()
    expect(all.length).toBe(3)
    expect(all[0].ruleId).toBe('no-assertion')
    expect(all[0].severity).toBe('critical')
    expect(all[0].confidence).toBeGreaterThan(0.9)
  })

  it('does not flag tests with meaningful assertions (good fixture)', () => {
    const file = adapter.parseFile(join(fixturesDir, 'good/lodash-get.test.ts'), fixturesDir)
    expect(file).not.toBeNull()
    const findings = rule.run({
      file: file!,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('does not flag describe blocks', () => {
    const file = adapter.parseFile(join(fixturesDir, 'good/formatPrice.test.ts'), fixturesDir)
    expect(file).not.toBeNull()
    const findings = rule.run({
      file: file!,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(0)
  })

  it('does not flag it.skip() or it.todo()', async () => {
    const source = `
      import { describe, it } from 'vitest';
      describe('skipped', () => {
        it.skip('is skipped', () => {});
        it.todo('is todo');
      });
    `
    const tmpFile = join(fixturesDir, '__tmp_skip_test.test.ts')
    const fs = await import('node:fs')
    fs.writeFileSync(tmpFile, source)
    try {
      const file = adapter.parseFile(tmpFile, fixturesDir)
      expect(file).not.toBeNull()
      const findings = rule.run({
        file: file!,
        inDiff: true,
        coverage: null,
        runner: 'vitest',
        log: () => {},
      })
      expect(findings.length).toBe(0)
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('flags expect.assertions(0) as no-assertion (N=0 is meaningless)', async () => {
    const source = `
      import { describe, it, expect } from 'vitest';
      describe('x', () => {
        it('does nothing', () => {
          expect.assertions(0);
        });
      });
    `
    const tmpFile = join(fixturesDir, '__tmp_assertions0.test.ts')
    const fs = await import('node:fs')
    fs.writeFileSync(tmpFile, source)
    try {
      const file = adapter.parseFile(tmpFile, fixturesDir)
      expect(file).not.toBeNull()
      const findings = rule.run({
        file: file!,
        inDiff: true,
        coverage: null,
        runner: 'vitest',
        log: () => {},
      })
      expect(findings.length).toBe(1)
    } finally {
      fs.unlinkSync(tmpFile)
    }
  })

  it('includes file path, line, test name, reason, and suggestedFix in every finding', () => {
    const file = adapter.parseFile(
      join(fixturesDir, 'decorative/no-assertion.test.ts'),
      fixturesDir,
    )
    expect(file).not.toBeNull()
    const findings = rule.run({
      file: file!,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    for (const finding of findings) {
      expect(finding.ruleId).toBe('no-assertion')
      expect(finding.severity).toBe('critical')
      expect(finding.file).toBe('decorative/no-assertion.test.ts')
      expect(finding.line).toBeGreaterThan(0)
      expect(finding.testName.length).toBeGreaterThan(0)
      expect(finding.reason.length).toBeGreaterThan(20)
      expect(finding.suggestedFix.length).toBeGreaterThan(20)
      expect(finding.confidence).toBeGreaterThan(0)
      expect(finding.confidence).toBeLessThanOrEqual(1)
    }
  })
})
