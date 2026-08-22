import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NoAssertionRule, TrivialAssertionRule } from '@trash-tests/core'

const RULES = [new NoAssertionRule(), new TrivialAssertionRule()]

const HELP_TEXT = `Trash Tests — find weak tests before they become a false CI signal.

Usage: trashtests <command> [options]

Commands:
  scan        Run analysis on the current diff or repo (default)
  init        Write a trashtests.config.ts template to the repo
  explain     Show documentation for a specific rule
  formula     Print the active scoring formula with current weights
  list-rules  List all available rules with metadata
  doctor      Diagnose why a score might be null or unexpected

Options (scan):
  --diff <ref>          Git ref to diff against (default: auto-detect main branch)
  --scan-all            Scan entire repo (ignore diff). Slow.
  --json                Emit machine-readable JSON to stdout
  --markdown            Emit markdown summary (for PR comments)
  --fail-below <n>      Exit code 1 if MTC < n (default: off)
  --strict              Treat info findings as warning (default: off)
  --coverage <path>     Path to coverage-final.json
  --junit <path>        Path to junit.xml
  --include <glob>      Only analyze files matching glob
  --exclude <glob>      Exclude files matching glob
  --output <path>       Write report to file (default: stdout)
  --quiet               Suppress non-essential output
  --verbose             Verbose debug logs to stderr
  -h, --help            Show this help

Examples:
  trashtests scan                       # scan current diff
  trashtests scan --json > report.json  # machine-readable output
  trashtests scan --fail-below 50       # exit 1 if MTC < 50
  trashtests explain no-assertion       # docs for the rule
  trashtests list-rules                 # list all rules
  trashtests formula                    # print the scoring formula
  trashtests doctor                     # diagnose null subscores
`

function printFormula(): void {
  console.log(`
Trash Tests — scoring formula

  MTC = 0.25 × AssertionQuality
      + 0.25 × RepositoryBranchCoverage
      + 0.20 × MutationResistance
      + 0.20 × ErrorPathCoverage
      + 0.10 × MockSanity

Default weights:
  assertionQuality:      0.25
  branchCoverage:        0.25
  mutationResistance:    0.20
  errorPathCoverage:     0.20
  mockSanity:            0.10

The score uses the signals measured in the current run. Signals that are not measured are excluded from the calculation.

Override in trashtests.config.ts:
  scoring.weights: { ... }
`)
}

function listRules(): void {
  console.log('\nTrash Tests — Available Rules\n')
  console.log('ID                            Severity    Category    FP Estimate')
  console.log('-'.repeat(72))
  for (const rule of RULES) {
    const m = rule.metadata
    console.log(
      `${m.id.padEnd(30)} ${m.severity.padEnd(11)} ${m.category.padEnd(11)} ${m.fpEstimate}`,
    )
  }
  console.log('')
}

function explainRule(ruleId: string): void {
  const rule = RULES.find((r) => r.metadata.id === ruleId)
  if (!rule) {
    console.error(`Rule not found: ${ruleId}`)
    console.error(`Available rules: ${RULES.map((r) => r.metadata.id).join(', ')}`)
    process.exit(2)
  }
  const m = rule.metadata
  console.log(`
Trash Tests — Rule: ${m.id}

  Name:        ${m.name}
  Severity:    ${m.severity}
  Category:    ${m.category}
  FP estimate: ${m.fpEstimate}
  Description:
    ${m.description}

  Documentation: docs/rules/${m.id}.md
`)
}

function runDoctor(): void {
  console.log(`
Trash Tests — Doctor

  Checking environment...`)
  const nodeVersion = process.version
  console.log(`    Node.js ${nodeVersion} (20.11.0 or later required)`)

  const cwd = process.cwd()
  console.log(`    Working directory: ${cwd}`)

  const coveragePath = join(cwd, 'coverage', 'coverage-final.json')
  if (existsSync(coveragePath)) {
    console.log(`    Coverage file found: ${coveragePath}`)
  } else {
    console.log(`    Warning: coverage file not found at: ${coveragePath}`)
    console.log('      Repository branch coverage will be unavailable for this run.')
    console.log('      Run your test runner with --coverage --coverage-report=json.')
  }

  const junitPath = join(cwd, 'junit.xml')
  if (existsSync(junitPath)) {
    console.log(`    JUnit file found: ${junitPath}`)
  } else {
    console.log(`    Warning: JUnit file not found at: ${junitPath}`)
    console.log('      JUnit data will not be included in the summary.')
    console.log('      Configure the Vitest "junit" or Jest "jest-junit" reporter to provide it.')
  }

  const configPath = join(cwd, 'trashtests.config.ts')
  if (existsSync(configPath)) {
    console.log(`    Config file found: ${configPath}`)
  } else {
    console.log('    No config file; using defaults.')
  }

  console.log('')
}

function runInit(): void {
  const cwd = process.cwd()
  const configPath = join(cwd, 'trashtests.config.ts')

  if (existsSync(configPath)) {
    console.error(`Config file already exists: ${configPath}`)
    process.exit(2)
  }

  const configContent = `// trashtests.config.ts
// Configuration for Trash Tests — https://github.com/frangelbarrera/trash-tests
import type { TrashTestsConfig } from '@trash-tests/core';

const config: TrashTestsConfig = {
  scoring: {
    // Weights are optional and PARTIAL: unset dimensions keep the built-in
    // defaults, then everything is renormalized to sum to 1.0.
    // e.g. { branchCoverage: 0.40 } makes branch coverage dominant.
    weights: {
      // assertionQuality: 0.25,
      // branchCoverage: 0.25,
      // mutationResistance: 0.20,
      // errorPathCoverage: 0.20,
      // mockSanity: 0.10,
    },
    failBelow: 50, // fail the PR if MTC < 50 (0-100)
  },
  rules: {
    // disabled: ['trivial-assertion'],
    // suppressions: [
    //   { ruleId: 'no-assertion', files: 'tests/smoke/**', reason: 'Intentional smoke coverage' },
    // ],
  },
  // include: '**/*.test.ts',   // only scan matching files
  // exclude: '**/dist/**',     // skip matching files
  // scanAll: false,            // true = always scan the whole repo
};

export default config;
`

  writeFileSync(configPath, configContent)
  console.log(`Wrote ${configPath}`)

  // Try to add a script to package.json
  const pkgPath = join(cwd, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
      if (!pkg.scripts) pkg.scripts = {}
      if (!pkg.scripts.trashtests) {
        pkg.scripts.trashtests = 'trashtests scan'
        writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
        console.log('Added "trashtests" script to package.json')
      }
    } catch {
      console.log('Could not update package.json because it contains invalid JSON.')
    }
  }

  console.log('\nNext steps:')
  console.log('  1. Run `pnpm test -- --coverage` to generate coverage data')
  console.log('  2. Run `pnpm trashtests` to scan your diff')
  console.log('  3. Add the GitHub Action (see: https://github.com/frangelbarrera/trash-tests)')
}

export function handleSubcommand(argv: string[]): boolean {
  const first = argv[0]
  if (first === '--help' || first === '-h') {
    process.stdout.write(HELP_TEXT)
    process.exit(0)
  }
  if (first === '--version' || first === '-v') {
    process.stdout.write('Trash Tests\n')
    process.exit(0)
  }
  if (first === 'init') {
    runInit()
    return true
  }
  if (first === 'explain') {
    const ruleId = argv[1]
    if (!ruleId) {
      console.error('Usage: trashtests explain <rule-id>')
      console.error(`Available rules: ${RULES.map((r) => r.metadata.id).join(', ')}`)
      process.exit(2)
    }
    explainRule(ruleId)
    return true
  }
  if (first === 'formula') {
    printFormula()
    return true
  }
  if (first === 'list-rules') {
    listRules()
    return true
  }
  if (first === 'doctor') {
    runDoctor()
    return true
  }
  return false
}
