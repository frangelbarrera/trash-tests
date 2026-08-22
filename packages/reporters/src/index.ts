/**
 * @trash-tests/reporters — Reusable formatters for Trash Tests output.
 *
 * This package exists so the GitHub Action (and other consumers) can reuse
 * the same formatters as the CLI without depending on the CLI package.
 */

export { TerminalFormatter } from './TerminalReporter.js'
export { JsonReporter } from './JsonReporter.js'
export { MarkdownReporter } from './MarkdownReporter.js'
