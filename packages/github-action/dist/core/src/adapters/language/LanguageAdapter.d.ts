import type { FileAST } from '../../findings/RuleContext.js';
/**
 * Interface implemented by every supported language adapter.
 */
export interface LanguageAdapter {
    /** Language identifier. */
    readonly language: 'typescript' | 'javascript' | 'tsx' | 'jsx';
    /** Check if this adapter can handle a file path. */
    canHandle(filePath: string): boolean;
    /** Parse a file into a FileAST. */
    parseFile(absolutePath: string, repoRoot: string): FileAST | null;
    /** Resolve imports associated with the parsed test file. */
    resolveImports(file: FileAST, repoRoot: string): string[];
}
//# sourceMappingURL=LanguageAdapter.d.ts.map