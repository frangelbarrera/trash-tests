import type { OrchestratorResult } from '@trash-tests/core';
export interface TerminalReporterOptions {
    useColor: boolean;
    ascii?: boolean;
}
export interface TerminalFormatContext {
    diff: {
        base: string;
        head: string;
    };
}
/**
 * Terminal reporter compatibility layer. The CLI formatter provides the
 * user-facing terminal report, while the GitHub Action uses MarkdownReporter
 * for pull-request comments.
 */
export declare class TerminalReporter {
    constructor(_opts: TerminalReporterOptions);
    format(result: OrchestratorResult, _ctx: TerminalFormatContext): string;
}
export { TerminalReporter as TerminalFormatter };
//# sourceMappingURL=TerminalReporter.d.ts.map