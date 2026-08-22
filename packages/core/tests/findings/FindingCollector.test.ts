import { describe, expect, it } from 'vitest'
import { FindingCollector } from '../../src/findings/Finding.js'
import type { Finding } from '../../src/findings/Finding.js'

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'no-assertion',
    severity: 'critical',
    file: 'tests/a.ts',
    line: 1,
    testName: 'test',
    reason: 'reason',
    confidence: 0.9,
    suggestedFix: 'fix',
    ...overrides,
  }
}

describe('FindingCollector', () => {
  it('collects findings', () => {
    const c = new FindingCollector()
    c.add(makeFinding())
    expect(c.getAll().length).toBe(1)
  })

  it('dedupes by (ruleId, file, line, testName)', () => {
    const c = new FindingCollector()
    c.add(makeFinding())
    c.add(makeFinding()) // identical
    expect(c.getAll().length).toBe(1)
  })

  it('sorts by severity then file then line', () => {
    const c = new FindingCollector()
    c.add(makeFinding({ severity: 'info', file: 'b.ts', line: 5 }))
    c.add(makeFinding({ severity: 'warning', file: 'a.ts', line: 10 }))
    c.add(makeFinding({ severity: 'critical', file: 'c.ts', line: 1 }))
    const all = c.getAll()
    expect(all[0].severity).toBe('critical')
    expect(all[1].severity).toBe('warning')
    expect(all[2].severity).toBe('info')
  })

  it('rejects findings missing required fields', () => {
    const c = new FindingCollector()
    expect(() => c.add(makeFinding({ ruleId: '' }))).toThrow()
    expect(() => c.add(makeFinding({ file: '' }))).toThrow()
    expect(() => c.add(makeFinding({ line: 0 }))).toThrow()
    expect(() => c.add(makeFinding({ confidence: 1.5 }))).toThrow()
    expect(() => c.add(makeFinding({ confidence: -0.1 }))).toThrow()
  })
})
