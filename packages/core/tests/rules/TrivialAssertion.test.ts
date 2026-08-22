import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TypeScriptAdapter } from '../../src/adapters/language/TypeScriptAdapter.js'
import { TrivialAssertionRule } from '../../src/rules/TrivialAssertion.js'

const fixturesDir = join(import.meta.dirname, '../../../fixtures')

describe('TrivialAssertionRule', () => {
  const adapter = new TypeScriptAdapter()
  const rule = new TrivialAssertionRule(adapter)

  it('flags tests with only trivial assertions (decorative fixture)', () => {
    const file = adapter.parseFile(join(fixturesDir, 'decorative/tautology.test.ts'), fixturesDir)
    expect(file).not.toBeNull()
    const findings = rule.run({
      file: file!,
      inDiff: true,
      coverage: null,
      runner: 'vitest',
      log: () => {},
    })
    expect(findings.length).toBe(4)
    for (const f of findings) {
      expect(f.ruleId).toBe('trivial-assertion')
      expect(f.severity).toBe('warning')
    }
  })

  it('does not flag tests with meaningful assertions (good fixture)', () => {
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

  it('does not flag a mix of trivial + meaningful assertions', async () => {
    const source = `
      import { describe, it, expect } from 'vitest';
      describe('mixed', () => {
        it('has both', () => {
          const result = compute();
          expect(result).toBeDefined();        // trivial
          expect(result.id).toBe(123);          // meaningful — should not flag
        });
      });
    `
    const tmpFile = join(fixturesDir, '__tmp_mixed.test.ts')
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
})
