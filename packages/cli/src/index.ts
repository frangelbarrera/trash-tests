/**
 * @trash-tests/cli — Public API surface for the CLI package.
 *
 * The bin.ts file imports `runCli` from here. External consumers
 * (e.g. the `trashtests` package) should import from this entry point,
 * not from internal paths.
 */
export { runCli } from './commands/ScanCommand.js'
export { handleSubcommand } from './commands/Subcommands.js'
