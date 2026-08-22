#!/usr/bin/env node
/**
 * Trash Tests CLI entry point.
 *
 * Usage:
 *   npx trashtests scan [options]
 *   npx trashtests init
 *   npx trashtests explain <rule-id>
 *   npx trashtests formula
 *   npx trashtests list-rules
 *   npx trashtests doctor
 */
import { runCli } from './commands/ScanCommand.js'

runCli(process.argv.slice(2)).catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error))
  process.exit(2)
})
