import { TypeScriptAdapter } from '../adapters/language/TypeScriptAdapter.js';
import type { Finding } from '../findings/Finding.js';
import type { RuleContext } from '../findings/RuleContext.js';
import type { Rule, RuleMetadata } from './Rule.js';
/**
 * Rule 1: No Assertion
 *
 * Detects test bodies with zero assertion calls.
 *
 * A test without an assertion is only a runtime check that the code does not throw.
 *
 * @see docs/rules/no-assertion.md
 */
export declare class NoAssertionRule implements Rule {
    readonly metadata: RuleMetadata;
    private adapter;
    constructor(adapter?: TypeScriptAdapter);
    run(ctx: RuleContext): Finding[];
    private isTestFile;
    private isSkipped;
    private findTestCallback;
    private getLineNumber;
}
/**
 * Singleton instance.
 */
export declare const noAssertionRule: NoAssertionRule;
//# sourceMappingURL=NoAssertion.d.ts.map