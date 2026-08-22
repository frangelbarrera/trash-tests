import * as t from '@babel/types'
import { TypeScriptAdapter } from '../adapters/language/TypeScriptAdapter.js'
import type { Finding } from '../findings/Finding.js'
import type { RuleContext } from '../findings/RuleContext.js'
import type { Rule, RuleMetadata } from './Rule.js'

/**
 * Rule 1: No Assertion
 *
 * Detects test bodies with zero assertion calls.
 *
 * A test without an assertion is only a runtime check that the code does not throw.
 *
 * @see docs/rules/no-assertion.md
 */
export class NoAssertionRule implements Rule {
  readonly metadata: RuleMetadata = {
    id: 'no-assertion',
    name: 'No Assertion',
    severity: 'critical',
    category: 'assertion',
    description: 'Test body contains zero assertion calls.',
    fpEstimate: 0.05,
  }

  private adapter: TypeScriptAdapter

  constructor(adapter?: TypeScriptAdapter) {
    this.adapter = adapter ?? new TypeScriptAdapter()
  }

  run(ctx: RuleContext): Finding[] {
    const findings: Finding[] = []
    const file = ctx.file

    // Skip non-test files
    if (!this.isTestFile(file.relativePath)) {
      return findings
    }

    this.adapter.walkTests(file, (callNode, kind, name, isSkipped) => {
      // Skip describe blocks
      if (kind === 'describe') return

      // Skip it.skip() and it.todo() — they're not real tests
      if (isSkipped) return

      // Find the test callback
      const callback = this.findTestCallback(callNode)
      if (!callback) return

      // Analyze assertions
      const body = callback.body
      const analysis = this.adapter.analyzeAssertions(body)

      if (!analysis.hasAssertions) {
        const line = this.getLineNumber(callNode)
        findings.push({
          ruleId: this.metadata.id,
          severity: this.metadata.severity,
          file: file.relativePath,
          line,
          testName: name,
          reason:
            `Test body contains no recognized assertion. A test without an assertion is only ` +
            `a runtime check that the code does not throw.`,
          confidence: 0.95,
          suggestedFix:
            `Add at least one \`expect()\` call that verifies observable behavior (return value, ` +
            `side effect, or thrown error).\n\n` +
            `If the test only checks "doesn't throw", use \`expect.assertions(0)\` and rename the ` +
            `test to "<thing> does not throw" to make the intent explicit.`,
        })
      }
    })

    return findings
  }

  private isTestFile(path: string): boolean {
    return /(__tests__|tests?|\.test\.|\.spec\.)/.test(path)
  }

  private isSkipped(callNode: t.CallExpression): boolean {
    const callee = callNode.callee
    if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
      return callee.property.name === 'skip' || callee.property.name === 'todo'
    }
    return false
  }

  private findTestCallback(
    callNode: t.CallExpression,
  ): t.ArrowFunctionExpression | t.FunctionExpression | null {
    // it('name', fn) — fn is args[1]
    // it('name', fn, timeout) — fn is args[1], timeout is args[2]
    // it('name', { concurrent: true }, fn) — Vitest options object, fn is args[2]
    // it.each([...])('name', fn) — same after unwrapping
    if (callNode.arguments.length < 2) return null
    if (callNode.arguments.length >= 3 && t.isObjectExpression(callNode.arguments[1])) {
      const arg = callNode.arguments[2]
      if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
        return arg
      }
      return null
    }
    const arg = callNode.arguments[1]
    if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
      return arg
    }
    return null
  }

  private getLineNumber(callNode: t.CallExpression): number {
    return callNode.loc?.start.line ?? 1
  }
}

/**
 * Singleton instance.
 */
export const noAssertionRule = new NoAssertionRule()
