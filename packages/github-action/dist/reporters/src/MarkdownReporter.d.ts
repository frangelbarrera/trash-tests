import type { OrchestratorResult } from '@trash-tests/core';
export interface MarkdownReportContext {
    repoRoot: string;
    repoUrl?: string;
}
export declare class MarkdownReporter {
    static format(result: OrchestratorResult, ctx: MarkdownReportContext): string;
}
//# sourceMappingURL=MarkdownReporter.d.ts.map