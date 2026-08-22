import type * as BabelTypes from '@babel/types'

/**
 * Represents a parsed file's AST plus metadata needed by rules.
 */
export interface FileAST {
  /** Absolute path to the file. */
  filePath: string
  /** Relative path (from repo root) — used in finding output. */
  relativePath: string
  /** Source code (used for line/col lookups and snippet extraction). */
  source: string
  /** Babel AST root. */
  ast: BabelTypes.File
  /** Detected language. */
  language: 'typescript' | 'javascript' | 'tsx' | 'jsx'
  /** Detected test runner (best-effort, based on imports). */
  runner: 'vitest' | 'jest' | 'mocha' | 'ava' | 'unknown'
}

/**
 * Context passed to every rule invocation.
 */
export interface RuleContext {
  /** The file being analyzed. */
  file: FileAST
  /** Whether this file is in the diff (modified/added in current PR). */
  inDiff: boolean
  /** Coverage data for this file (if available). */
  coverage: CoverageData | null
  /** Test runner name detected for this file. */
  runner: 'vitest' | 'jest' | 'mocha' | 'ava' | 'unknown'
  /** Logger function (respects --quiet and --debug). */
  log: (level: 'debug' | 'info' | 'warn', message: string) => void
}

/**
 * Subset of Istanbul coverage data needed by rules.
 */
export interface CoverageData {
  /** Branch coverage map keyed by file path. */
  branches: Record<string, BranchCoverage>
  /** Function coverage map keyed by file path. */
  functions: Record<string, FunctionCoverage>
  /** Per-test coverage (if available, enables precise test-to-function mapping). */
  perTest?: Record<string, PerTestCoverage>
}

export interface BranchCoverage {
  /** Map of branch ID to hit count. */
  [branchId: string]: number
}

export interface FunctionCoverage {
  /** Map of function ID to hit count. */
  [functionId: string]: number
}

export interface PerTestCoverage {
  /** Test ID to list of covered branches. */
  branches?: Record<string, number[]>
  /** Test ID to list of covered functions. */
  functions?: Record<string, number[]>
}
