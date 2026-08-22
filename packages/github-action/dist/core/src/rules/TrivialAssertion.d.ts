import { TypeScriptAdapter } from '../adapters/language/TypeScriptAdapter.js';
import type { Finding } from '../findings/Finding.js';
import type { RuleContext } from '../findings/RuleContext.js';
import type { Rule, RuleMetadata } from './Rule.js';
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
export declare class TrivialAssertionRule implements Rule {
    readonly metadata: RuleMetadata;
    private adapter;
    constructor(adapter?: TypeScriptAdapter);
    run(ctx: RuleContext): Finding[];
    private isTestFile;
    private isSkipped;
    private findTestCallback;
    private getLineNumber;
}
export declare const trivialAssertionRule: TrivialAssertionRule;
//# sourceMappingURL=TrivialAssertion.d.ts.map