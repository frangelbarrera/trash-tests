import * as t from '@babel/types'
import { TypeScriptAdapter } from '../adapters/language/TypeScriptAdapter.js'
import type { Finding } from '../findings/Finding.js'
import type { RuleContext } from '../findings/RuleContext.js'
import type { Rule, RuleMetadata } from './Rule.js'

/**
 * Rule 2: Trivial Assertion
 *
 * Detects tests where ALL assertions are "trivial":
 * - expect(true).toBe(true)
 * - expect(x).toBeDefined() (alone)
 * - expect(x).toBeTruthy() (alone)
 * - expect(x).toBeFalsy() (alone)
 * - expect(x).toMatchSnapshot() (alone, no other assertion)
 *
 * @see docs/rules/trivial-assertion.md
 */
export class TrivialAssertionRule implements Rule {
  readonly metadata: RuleMetadata = {
    id: 'trivial-assertion',
    name: 'Trivial Assertion',
    severity: 'warning',
    category: 'assertion',
    description: 'Test only contains trivial assertions that verify nothing.',
    fpEstimate: 0.15,
  }

  private adapter: TypeScriptAdapter

  constructor(adapter?: TypeScriptAdapter) {
    this.adapter = adapter ?? new TypeScriptAdapter()
  }

  run(ctx: RuleContext): Finding[] {
    const findings: Finding[] = []
    const file = ctx.file

    if (!this.isTestFile(file.relativePath)) {
      return findings
    }

    this.adapter.walkTests(file, (callNode, kind, name, isSkipped) => {
      if (kind === 'describe') return
      if (isSkipped) return

      const callback = this.findTestCallback(callNode)
      if (!callback) return

      const analysis = this.adapter.analyzeAssertions(callback.body)

      if (analysis.hasAssertions && analysis.hasOnlyTrivialAssertions) {
        const line = this.getLineNumber(callNode)
        const trivialTypes = analysis.trivialAssertionTypes.join(', ')
        findings.push({
          ruleId: this.metadata.id,
          severity: this.metadata.severity,
          file: file.relativePath,
          line,
          testName: name,
          reason:
            `Test only contains low-signal assertions (${trivialTypes}). These checks verify ` +
            `existence but not the expected behavior or value.`,
          confidence: 0.85,
          suggestedFix:
            `Replace the trivial assertion with a value assertion:\n` +
            `  expect(result.id).toBe(expectedId)\n` +
            `  expect(result).toEqual(expectedObject)\n` +
            `  expect(() => fn()).toThrow(expectedError)`,
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
    // it('name', { concurrent: true }, fn) — Vitest options object, fn is args[2]
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

export const trivialAssertionRule = new TrivialAssertionRule()
