/**
 * @trash-tests/core — Public API
 *
 * The core analysis engine for Trash Tests.
 *
 * @example
 * ```ts
 * import { Orchestrator } from '@trash-tests/core';
 *
 * const orchestrator = new Orchestrator();
 * const result = await orchestrator.analyze({
 *   repoRoot: process.cwd(),
 *   files: ['tests/auth.test.ts'],
 *   coveragePath: './coverage/coverage-final.json',
 * });
 *
 * console.log(`MTC: ${result.score.mtc}/100`);
 * ```
 */
export { Orchestrator, findTestFiles } from './orchestrator.js';
export type { OrchestratorOptions, OrchestratorResult } from './orchestrator.js';
export { ScoringEngine, DEFAULT_WEIGHTS } from './scoring/ScoringEngine.js';
export type { ScoringWeights, Subscores, ScoreResult, IstanbulCoverage, IstanbulFileCoverage, } from './scoring/ScoringEngine.js';
export type { TrashTestsConfig } from './config/TrashTestsConfig.js';
export { FindingCollector } from './findings/Finding.js';
export type { Finding } from './findings/Finding.js';
export type { FileAST, RuleContext, CoverageData } from './findings/RuleContext.js';
export { RuleRegistry } from './rules/Rule.js';
export type { Rule, RuleMetadata } from './rules/Rule.js';
export { NoAssertionRule } from './rules/NoAssertion.js';
export { TrivialAssertionRule } from './rules/TrivialAssertion.js';
export { TypeScriptAdapter } from './adapters/language/TypeScriptAdapter.js';
export type { LanguageAdapter } from './adapters/language/LanguageAdapter.js';
//# sourceMappingURL=index.d.ts.map