import * as t from '@babel/types';
import type { FileAST } from '../../findings/RuleContext.js';
import type { LanguageAdapter } from './LanguageAdapter.js';
/**
 * TypeScript / JavaScript language adapter using Babel parser.
 *
 * Supports: .ts, .tsx, .js, .jsx, .mjs, .cjs
 * Detects test runner from imports (Vitest vs Jest vs Mocha).
 */
export declare class TypeScriptAdapter implements LanguageAdapter {
    readonly language: "typescript";
    private static readonly PARSER_PLUGINS;
    canHandle(filePath: string): boolean;
    parseFile(absolutePath: string, repoRoot: string, log?: (level: 'debug' | 'info' | 'warn', message: string) => void): FileAST | null;
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
    walkTests(file: FileAST, visitor: (node: t.CallExpression, kind: 'test' | 'describe', name: string, isSkipped: boolean) => void): void;
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
        hasAssertions: boolean;
        assertionCount: number;
        hasOnlyTrivialAssertions: boolean;
        trivialAssertionTypes: string[];
    };
    /**
     * Visit a single node and check if it's an assertion call.
     * Updates the counters via the callbacks parameter.
     */
    private _visitNodeForAssertions;
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
    private _unwrapToExpectCall;
    /**
     * Get the matcher chain: expect(x).not.toBe(...) → ['not', 'toBe']
     */
    private _getMatcherChain;
    private detectLanguage;
    private detectRunner;
    /**
     * Resolve imports in the file when dependency-aware analysis is required.
     * The current analyzer scopes findings to the parsed test file.
     */
    resolveImports(_file: FileAST, _repoRoot: string): string[];
    /**
     * Structural equivalence ignoring source-location metadata.
     * Used to detect tautological assertions like `expect(x).toBe(x)`.
     */
    private _isStructurallyEquivalent;
}
/**
 * Singleton instance.
 */
export declare const typescriptAdapter: TypeScriptAdapter;
//# sourceMappingURL=TypeScriptAdapter.d.ts.map