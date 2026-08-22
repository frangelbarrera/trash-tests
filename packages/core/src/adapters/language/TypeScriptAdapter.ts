import { existsSync, readFileSync } from 'node:fs'
import { extname, relative } from 'node:path'
import * as parser from '@babel/parser'
import _traverseImport from '@babel/traverse'
import * as t from '@babel/types'
import type { FileAST } from '../../findings/RuleContext.js'
import type { LanguageAdapter } from './LanguageAdapter.js'

// ESM/CJS interop for @babel/traverse.
// @babel/traverse's default export is the traverse function in CJS, but when imported
// via Node ESM, the namespace object is what we get. Defensive unwrap handles both.
const traverse: typeof import('@babel/traverse').default =
  typeof _traverseImport === 'function'
    ? _traverseImport
    : ((_traverseImport as unknown as { default: typeof import('@babel/traverse').default })
        .default ?? (_traverseImport as unknown as typeof import('@babel/traverse').default))

/**
 * TypeScript / JavaScript language adapter using Babel parser.
 *
 * Supports: .ts, .tsx, .js, .jsx, .mjs, .cjs
 * Detects test runner from imports (Vitest vs Jest vs Mocha).
 */
export class TypeScriptAdapter implements LanguageAdapter {
  readonly language = 'typescript' as const

  // In Babel 7, the following plugins are needed for older TS/JS syntax.
  // Babel 8 makes most of these defaults, but Babel 7 still requires them.
  private static readonly PARSER_PLUGINS: parser.ParserOptions['plugins'] = [
    'typescript',
    'jsx',
    'decorators-legacy',
    'exportDefaultFrom',
    'objectRestSpread',
  ]

  canHandle(filePath: string): boolean {
    const ext = extname(filePath).toLowerCase()
    return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)
  }

  parseFile(
    absolutePath: string,
    repoRoot: string,
    log?: (level: 'debug' | 'info' | 'warn', message: string) => void,
  ): FileAST | null {
    if (!existsSync(absolutePath)) {
      return null
    }
    const source = readFileSync(absolutePath, 'utf8')
    const ext = extname(absolutePath).toLowerCase()

    let ast: t.File
    try {
      ast = parser.parse(source, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: TypeScriptAdapter.PARSER_PLUGINS,
        errorRecovery: true,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      const logLevel = log ?? ((_level, message) => console.warn(message))
      logLevel('warn', `[TypeScriptAdapter] Failed to parse ${absolutePath}: ${msg}`)
      return null
    }

    const language = this.detectLanguage(ext)
    const runner = this.detectRunner(ast)

    return {
      filePath: absolutePath,
      relativePath: relative(repoRoot, absolutePath).replace(/\\/g, '/'),
      source,
      ast,
      language,
      runner,
    }
  }

  /**
   * Walk the AST and call the visitor for each `it()` / `test()` / `describe()` call.
   *
   * Handles:
   * - it('name', fn)
   * - it.skip / it.only / it.todo / it.concurrent
   * - it.each([...])('name', fn)  — unwrapped to the inner call
   * - it.only.each([...])('name', fn)  — unwrapped to the inner call
   * - describe(...) variants
   */
  walkTests(
    file: FileAST,
    visitor: (
      node: t.CallExpression,
      kind: 'test' | 'describe',
      name: string,
      isSkipped: boolean,
    ) => void,
  ): void {
    traverse(file.ast as any, {
      CallExpression: (path: any) => {
        const node = path.node
        // Unwrap it.each([...])(...) — when callee is itself a CallExpression
        // whose callee is it.each / it.only.each / etc.
        let effectiveCallee = node.callee
        const outerArgs = node.arguments
        if (t.isCallExpression(effectiveCallee)) {
          // it.each([...])(name, fn) — the outer call's first arg is the test name
          effectiveCallee = effectiveCallee.callee
        }

        let kind: 'test' | 'describe' | null = null
        let isSkipped = false

        if (t.isIdentifier(effectiveCallee)) {
          if (effectiveCallee.name === 'it' || effectiveCallee.name === 'test') {
            kind = 'test'
          } else if (effectiveCallee.name === 'describe') {
            kind = 'describe'
          }
        } else if (t.isMemberExpression(effectiveCallee)) {
          const object = effectiveCallee.object
          const property = effectiveCallee.property
          if (t.isIdentifier(object) && t.isIdentifier(property)) {
            const obj = object.name
            const prop = property.name
            if (obj === 'it' || obj === 'test') {
              if (prop === 'skip') {
                kind = 'test'
                isSkipped = true
              } else if (prop === 'todo') {
                kind = 'test'
                isSkipped = true
              } else if (prop === 'skipIf') {
                // Conditional test: statically treat like it.skip — may not run.
                kind = 'test'
                isSkipped = true
              } else if (prop === 'runIf') {
                // Conditional test that runs when the condition is truthy.
                kind = 'test'
              } else if (prop === 'only' || prop === 'concurrent' || prop === 'failing') {
                kind = 'test'
              } else if (prop === 'each') {
                // it.each([...])(...) — unwrapped above; the inner call is the test
                kind = 'test'
              }
            } else if (obj === 'describe') {
              if (prop === 'skip') {
                kind = 'describe'
                isSkipped = true
              } else if (prop === 'skipIf' || prop === 'runIf') {
                kind = 'describe'
              } else if (prop === 'only' || prop === 'each') {
                kind = 'describe'
              }
            }
          } else if (
            t.isMemberExpression(object) &&
            t.isIdentifier(object.object) &&
            t.isIdentifier(object.property) &&
            t.isIdentifier(property)
          ) {
            // it.only.each / it.skip.each / describe.only.each
            const grandObj = object.object
            const grandProp = object.property
            if (grandObj.name === 'it' || grandObj.name === 'test') {
              if (grandProp.name === 'skip' || grandProp.name === 'todo') {
                kind = 'test'
                isSkipped = true
              } else if (
                grandProp.name === 'only' ||
                grandProp.name === 'concurrent' ||
                grandProp.name === 'runIf'
              ) {
                kind = 'test'
              } else if (grandProp.name === 'skipIf') {
                kind = 'test'
                isSkipped = true
              }
            } else if (grandObj.name === 'describe') {
              if (grandProp.name === 'skip') {
                kind = 'describe'
                isSkipped = true
              } else if (grandProp.name === 'only') {
                kind = 'describe'
              }
            }
          }
        }

        if (kind === null) return
        // Skip the inner it.each([...]) factory call — it has no test name or callback.
        // The OUTER call it.each([...])('name', fn) has args.length >= 2.
        // The INNER call it.each([...]) has args.length === 1 (just the array).
        // We want to visit the OUTER call (with the name and callback), not the inner factory.
        if (outerArgs.length < 2) return

        // Extract test name
        if (outerArgs.length === 0) return
        const firstArg = outerArgs[0]
        let name = '<dynamic>'
        if (t.isStringLiteral(firstArg)) {
          name = firstArg.value
        } else if (t.isTemplateLiteral(firstArg)) {
          name = firstArg.quasis.map((q) => q.value.cooked ?? q.value.raw).join('${...}')
        }
        // Tagged templates and generated test titles can legitimately have no
        // static text. Findings still need a stable non-empty identifier.
        if (name.trim().length === 0) {
          name = '<dynamic test title>'
        }

        visitor(node, kind, name, isSkipped)
      },
    })
  }

  /**
   * Check if a function body contains assertion calls.
   * Returns an object describing the assertion quality.
   *
   * Handles:
   * - expect(...).toBe(...)
   * - expect(...).not.toBe(...)
   * - expect(...).resolves.toBe(...)
   * - expect(...).rejects.toThrow(...)
   * - expect.assertions(N) where N > 0 (meaningful)
   * - expect.hasAssertions() (meaningful)
   * - expectTypeOf<T>().toMatchTypeOf<...>() (Vitest type tests — meaningful)
   * - assert.<method>(...) (Node.js assert)
   * - fc.assert(...) (fast-check)
   *
   * Trivial assertions (count towards trivial bucket):
   * - expect(true).toBe(true) — tautology
   * - expect(x).toBeDefined() (alone)
   * - expect(x).toBeTruthy() (alone)
   * - expect(x).toBeFalsy() (alone)
   * - expect(x).toMatchSnapshot() (alone)
   */
  analyzeAssertions(fnBody: t.Statement[] | t.BlockStatement | t.Expression | null): {
    hasAssertions: boolean
    assertionCount: number
    hasOnlyTrivialAssertions: boolean
    trivialAssertionTypes: string[]
  } {
    if (!fnBody) {
      return {
        hasAssertions: false,
        assertionCount: 0,
        hasOnlyTrivialAssertions: false,
        trivialAssertionTypes: [],
      }
    }

    // Handle three cases: Statement[], BlockStatement (has .body), or Expression (single-expr arrow).
    let statements: t.Node[]
    if (Array.isArray(fnBody)) {
      statements = fnBody
    } else if ('body' in fnBody && Array.isArray((fnBody as t.BlockStatement).body)) {
      statements = (fnBody as t.BlockStatement).body
    } else {
      // Single-expression arrow function body (e.g. `() => expect(x).toBe(y)`).
      statements = [fnBody as t.Expression]
    }
    let assertionCount = 0
    let trivialCount = 0
    const trivialTypes: string[] = []

    const visit = (node: t.Node): void => {
      try {
        this._visitNodeForAssertions(node, {
          countAssertion: () => {
            assertionCount++
          },
          countTrivial: (type: string) => {
            assertionCount++
            trivialCount++
            trivialTypes.push(type)
          },
        })
      } catch {
        // Visitor crash safety — never let a single node failure abort the whole analysis.
      }

      // Recurse into children
      for (const key of Object.keys(node)) {
        if (key === 'loc' || key === 'start' || key === 'end' || key === 'range' || key === 'type')
          continue
        const child = (node as unknown as Record<string, unknown>)[key]
        if (Array.isArray(child)) {
          for (const c of child) {
            if (c && typeof c === 'object' && 'type' in c) {
              visit(c as t.Node)
            }
          }
        } else if (child && typeof child === 'object' && 'type' in child) {
          visit(child as t.Node)
        }
      }
    }

    for (const stmt of statements) {
      visit(stmt)
    }

    return {
      hasAssertions: assertionCount > 0,
      assertionCount,
      hasOnlyTrivialAssertions: assertionCount > 0 && assertionCount === trivialCount,
      trivialAssertionTypes: trivialTypes,
    }
  }

  /**
   * Visit a single node and check if it's an assertion call.
   * Updates the counters via the callbacks parameter.
   */
  private _visitNodeForAssertions(
    node: t.Node,
    callbacks: {
      countAssertion: () => void
      countTrivial: (type: string) => void
    },
  ): void {
    if (!t.isCallExpression(node)) return

    // Node.js assert: assert(cond, msg) via bare identifier.
    if (t.isIdentifier(node.callee) && node.callee.name === 'assert') {
      callbacks.countAssertion()
      return
    }

    if (!t.isMemberExpression(node.callee)) return

    const matcherProp = node.callee.property
    if (!t.isIdentifier(matcherProp)) return
    const matcherName = matcherProp.name

    // The object of the member expression (e.g., `expect` in `expect.assertions(N)`
    // or `expect(x)` in `expect(x).toBe(y)`).
    const expectObject = node.callee.object

    // Node.js assert module: assert.equal(a, b), assert.ok(x), assert.deepStrictEqual(...)
    if (t.isIdentifier(expectObject) && expectObject.name === 'assert') {
      callbacks.countAssertion()
      return
    }

    // Type-level test helpers used by projects such as Zod. These calls
    // intentionally assert through generic type arguments rather than a
    // Jest/Vitest matcher and therefore have no runtime expect(...) call.
    const typeAssertionHelpers = new Set(['assertEqual', 'assertIs'])
    if (
      t.isIdentifier(expectObject) &&
      expectObject.name === 'util' &&
      typeAssertionHelpers.has(matcherName)
    ) {
      callbacks.countAssertion()
      return
    }

    // Ava assertion context: test('name', t => t.is(value, expected)).
    // The conventional callback identifier is `t`; only known Ava assertion
    // methods are counted to avoid treating arbitrary object calls as evidence.
    const avaAssertions = new Set([
      'is',
      'not',
      'deepEqual',
      'notDeepEqual',
      'true',
      'false',
      'truthy',
      'falsy',
      'throws',
      'throwsAsync',
      'regex',
      'notRegex',
      'snapshot',
      'like',
      'pass',
      'fail',
    ])
    if (
      t.isIdentifier(expectObject) &&
      expectObject.name === 't' &&
      avaAssertions.has(matcherName)
    ) {
      callbacks.countAssertion()
      return
    }

    // fast-check: fc.assert(fc.property(...))
    if (t.isIdentifier(expectObject) && expectObject.name === 'fc' && matcherName === 'assert') {
      callbacks.countAssertion()
      return
    }

    // expect.assertions(N) — meaningful if N > 0.
    // NOTE: `expect.assertions(N)` uses `expect` directly (Identifier), not `expect()`.
    // This check MUST come before _unwrapToExpectCall (which expects an inner CallExpression).
    if (
      matcherName === 'assertions' &&
      t.isIdentifier(expectObject) &&
      expectObject.name === 'expect'
    ) {
      const args = node.arguments
      if (args.length === 1 && t.isNumericLiteral(args[0]) && args[0].value > 0) {
        callbacks.countAssertion()
        return
      }
      // expect.assertions(0) — explicit "no assertions expected". Do NOT count.
      return
    }

    // expect.hasAssertions() — meaningful.
    // Same note: `expect.hasAssertions()` uses `expect` directly.
    if (
      matcherName === 'hasAssertions' &&
      t.isIdentifier(expectObject) &&
      expectObject.name === 'expect'
    ) {
      callbacks.countAssertion()
      return
    }

    // For all other matchers (toBe, toEqual, toThrow, toHaveBeenCalledWith, etc.),
    // we need expect(x).matcher(y) — so unwrap to find the expect(x) call.
    const expectCall = this._unwrapToExpectCall(node)
    if (!expectCall) return

    // expectTypeOf(...).<matcher>(...) — meaningful (Vitest type tests)
    if (
      t.isCallExpression(expectCall.callee) &&
      t.isIdentifier(expectCall.callee.callee) &&
      expectCall.callee.callee.name === 'expectTypeOf'
    ) {
      callbacks.countAssertion()
      return
    }

    // Check for tautology: expect(true).toBe(true), expect(a + b).toBe(a + b),
    // expect(x).toBe(x), expect({ a: 1 }).toEqual({ a: 1 }), etc.
    // Any assertion where the expect argument and the matcher argument are
    // structurally identical ASTs can never fail, so it carries zero signal.
    const expectArgs = expectCall.arguments
    if (
      (matcherName === 'toBe' || matcherName === 'toEqual' || matcherName === 'toStrictEqual') &&
      expectArgs.length === 1 &&
      node.arguments.length === 1 &&
      this._isStructurallyEquivalent(expectArgs[0], node.arguments[0])
    ) {
      callbacks.countTrivial('tautology-expect-self-compare')
      return
    }

    // Check trivial matchers when used as the matcher.
    // Note: when used with .not., they're no longer trivial
    // (e.g., `expect(x).not.toBeDefined()` actually checks something).
    const trivialMatchers = new Set([
      'toBeDefined',
      'toBeTruthy',
      'toBeFalsy',
      'toMatchSnapshot',
      'toMatchInlineSnapshot',
    ])
    if (trivialMatchers.has(matcherName)) {
      // Check if .not., .resolves, or .rejects is in the chain — if so, it's not trivial.
      // e.g., expect(x).not.toBeDefined() or expect(promise).resolves.toBeDefined()
      const chain = this._getMatcherChain(node)
      if (!chain.some((p) => p === 'not' || p === 'resolves' || p === 'rejects')) {
        callbacks.countTrivial(`${matcherName}-only`)
        return
      }
      // .not./.resolves/.rejects + trivial matcher is meaningful
      callbacks.countAssertion()
      return
    }

    // Otherwise, it's a meaningful assertion (toBe with non-true, toEqual, toThrow, etc.)
    callbacks.countAssertion()
  }

  /**
   * Unwrap .not, .resolves, .rejects prefixes to find the inner expect(...) call.
   *
   * expect(x).not.toBe(...) — unwrap .not
   * expect(x).resolves.toBe(...) — unwrap .resolves
   * expect(x).rejects.toThrow(...) — unwrap .rejects
   * expect(x).toBe(...) — direct matcher
   *
   * IMPORTANT: `node` is the outer CallExpression (e.g. `expect(x).toBe(y)`).
   * We start unwrapping from `node.callee` (the MemberExpression).
   */
  private _unwrapToExpectCall(node: t.CallExpression): t.CallExpression | null {
    // Start from the callee, not the node itself.
    // For `expect(x).toBe(y)`, node is the outer call, node.callee is `expect(x).toBe`.
    let current: t.Node = node.callee
    // Walk down the chain: expect(x).not.resolves.toBe(...)
    // current starts as: expect(x).not.resolves.toBe  (MemberExpression)
    while (t.isMemberExpression(current)) {
      const prop = current.property as t.Identifier | t.StringLiteral | t.PrivateName
      if (t.isIdentifier(prop) && ['not', 'resolves', 'rejects'].includes(prop.name)) {
        // Skip the modifier and KEEP unwrapping — there may be more modifiers below.
        // (Using `continue`, not `break`, so we don't stop at the first non-modifier.)
        current = current.object
        continue
      }
      // For non-modifier properties (the matcher like `toBe`),
      // unwrap one level and keep going — there may still be modifiers below.
      current = current.object
      // Continue the loop — we keep walking until current is no longer a MemberExpression.
    }
    // Now current should be the expect(x) call expression (or `expect` identifier for expect.assertions/hasAssertions).
    if (
      t.isCallExpression(current) &&
      t.isIdentifier(current.callee) &&
      current.callee.name === 'expect'
    ) {
      return current
    }
    // Vitest variants expect.soft(x), expect.element(locator), and expect.poll(fn)
    // use the same matcher semantics as expect(x).
    if (
      t.isCallExpression(current) &&
      t.isMemberExpression(current.callee) &&
      t.isIdentifier(current.callee.object) &&
      t.isIdentifier(current.callee.property) &&
      current.callee.object.name === 'expect' &&
      ['soft', 'element', 'poll'].includes(current.callee.property.name)
    ) {
      return current
    }
    // expectTypeOf case
    if (
      t.isCallExpression(current) &&
      t.isIdentifier(current.callee) &&
      current.callee.name === 'expectTypeOf'
    ) {
      return current
    }
    return null
  }

  /**
   * Get the matcher chain: expect(x).not.toBe(...) → ['not', 'toBe']
   */
  private _getMatcherChain(node: t.CallExpression): string[] {
    const chain: string[] = []
    let current: t.Node = node.callee
    while (t.isMemberExpression(current)) {
      const prop: t.Node = current.property
      if (t.isIdentifier(prop)) {
        chain.unshift(prop.name)
      }
      current = current.object
      if (t.isCallExpression(current)) {
        // Reached expect(...) — stop
        break
      }
    }
    return chain
  }

  private detectLanguage(ext: string): FileAST['language'] {
    switch (ext) {
      case '.ts':
        return 'typescript'
      case '.tsx':
        return 'tsx'
      case '.js':
      case '.mjs':
      case '.cjs':
        return 'javascript'
      case '.jsx':
        return 'jsx'
      default:
        return 'typescript'
    }
  }

  private detectRunner(ast: t.File): FileAST['runner'] {
    let runner: FileAST['runner'] = 'unknown'
    traverse(ast as any, {
      ImportDeclaration(path: any) {
        const source = path.node.source.value
        if (source === 'vitest') {
          runner = 'vitest'
          path.stop()
        } else if (source === '@jest/globals' || source === 'jest') {
          runner = 'jest'
          path.stop()
        } else if (source === 'mocha' || source === '@oclif/test') {
          runner = 'mocha'
          path.stop()
        } else if (source === 'ava') {
          runner = 'ava'
          path.stop()
        }
      },
      CallExpression(path: any) {
        const callee = path.node.callee
        if (
          t.isIdentifier(callee) &&
          callee.name === 'require' &&
          t.isStringLiteral(path.node.arguments[0])
        ) {
          const source = path.node.arguments[0].value
          if (source === 'vitest') runner = 'vitest'
          else if (source === '@jest/globals' || source === 'jest') runner = 'jest'
          else if (source === 'mocha' || source === '@oclif/test') runner = 'mocha'
          else if (source === 'ava') runner = 'ava'
          if (runner !== 'unknown') path.stop()
          return
        }
        if (t.isIdentifier(callee)) {
          if (callee.name === 'vi') {
            runner = 'vitest'
            path.stop()
          } else if (callee.name === 'jest') {
            runner = 'jest'
            path.stop()
          }
        }
      },
    })
    return runner
  }

  /**
   * Resolve imports in the file when dependency-aware analysis is required.
   * The current analyzer scopes findings to the parsed test file.
   */
  resolveImports(_file: FileAST, _repoRoot: string): string[] {
    return []
  }

  /**
   * Structural equivalence ignoring source-location metadata.
   * Used to detect tautological assertions like `expect(x).toBe(x)`.
   */
  private _isStructurallyEquivalent(a: t.Node, b: t.Node): boolean {
    const strip = (node: unknown): string =>
      JSON.stringify(node, (key, value) => {
        if (
          key === 'loc' ||
          key === 'start' ||
          key === 'end' ||
          key === 'range' ||
          key === 'extra'
        ) {
          return undefined
        }
        return value
      })
    return strip(a) === strip(b)
  }
}

/**
 * Singleton instance.
 */
export const typescriptAdapter = new TypeScriptAdapter()
