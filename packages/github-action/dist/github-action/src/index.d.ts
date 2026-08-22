/**
 * Trash Tests GitHub Action entry point.
 *
 * Reads inputs from action.yml, runs the orchestrator on the PR diff,
 * posts a summary comment, and sets the status check.
 */
export interface ActionInputs {
    failBelow: number;
    ignoreBreakage: boolean;
    postComment: boolean;
    coveragePath: string;
}
export declare function getInputs(): ActionInputs;
export declare function run(): Promise<void>;
export declare function selectFilesForEvent(repoRoot: string, allTestFiles: string[]): Promise<string[]>;
export declare function collectTestFiles(repoRoot: string): Promise<string[]>;
//# sourceMappingURL=index.d.ts.map