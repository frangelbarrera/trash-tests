#!/usr/bin/env node
/**
 * Public entry point for the `trashtests` npm package.
 *
 * This is a thin wrapper around @trash-tests/cli that allows users to run:
 *
 *   npx trashtests scan
 *
 * without needing to install the workspace package directly.
 */
import { runCli } from '@trash-tests/cli'

runCli(process.argv.slice(2)).catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : String(error))
  process.exit(2)
})
