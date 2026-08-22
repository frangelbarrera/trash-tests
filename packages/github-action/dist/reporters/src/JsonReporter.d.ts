import type { OrchestratorResult } from '@trash-tests/core';
export interface JsonReportContext {
    version: string;
    repoRoot: string;
    diff: {
        base: string;
        head: string;
    };
    coveragePath?: string;
}
export declare class JsonReporter {
    static format(result: OrchestratorResult, ctx: JsonReportContext): string;
}
//# sourceMappingURL=JsonReporter.d.ts.map