import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { Orchestrator, type TrashTestsConfig } from '@trash-tests/core'
import { createJiti } from 'jiti'
import { JsonFormatter } from '../formatters/JsonFormatter.js'
import { MarkdownFormatter } from '../formatters/MarkdownFormatter.js'
import { TerminalFormatter } from '../formatters/TerminalFormatter.js'
import { handleSubcommand } from './Subcommands.js'

interface ScanOptions {
  diff?: string
  scanAll?: boolean
  json?: boolean
  markdown?: boolean
  failBelow?: number
  strict?: boolean
  coverage?: string
  junit?: string
  include?: string
  exclude?: string
  output?: string
  config?: string
  quiet?: boolean
  verbose?: boolean
  help?: boolean
  version?: boolean
}

export function parseArgs(argv: string[]): ScanOptions {
  const options: ScanOptions = {}
  const unknownArgs: string[] = []

  const takeValue = (arg: string, next: string | undefined): string => {
    if (next === undefined || next.startsWith('-')) {
      throw new Error(`Missing value for ${arg}`)
    }
    return next
  }
  // Options that REQUIRE a value (--fail-below): error out instead.
  const requireValue = (arg: string, next: string | undefined): string => {
    if (next === undefined || next.startsWith('-')) {
      console.error(`Missing value for ${arg}`)
      process.exit(2)
    }
    return next
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case '--diff':
        options.diff = takeValue(arg, next)
        i++
        break
      case '--scan-all':
        options.scanAll = true
        break
      case '--json':
        options.json = true
        break
      case '--markdown':
        options.markdown = true
        break
      case '--fail-below':
        options.failBelow = Number.parseInt(requireValue(arg, next), 10)
        i++
        break
      case '--strict':
        options.strict = true
        break
      case '--coverage':
        options.coverage = takeValue(arg, next)
        i++
        break
      case '--junit':
        options.junit = takeValue(arg, next)
        i++
        break
      case '--include':
        options.include = takeValue(arg, next)
        i++
        break
      case '--exclude':
        options.exclude = takeValue(arg, next)
        i++
        break
      case '--output':
      case '-o':
        options.output = takeValue(arg, next)
        i++
        break
      case '--config':
        options.config = takeValue(arg, next)
        i++
        break
      case '--quiet':
        options.quiet = true
        break
      case '--verbose':
      case '--debug':
        options.verbose = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      case '--version':
      case '-v':
        options.version = true
        break
      default:
        if (arg !== 'scan') unknownArgs.push(arg)
        break
    }
  }
  if (unknownArgs.length > 0) {
    throw new Error(
      `Unknown argument(s): ${unknownArgs.join(', ')}. Run trashtests --help for usage.`,
    )
  }
  return options
}

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
  --diff <ref>          Git ref to diff against. Default: auto-detect the
                        main/default branch and scan that diff.
  --scan-all            Scan entire repo (ignore diff). Slow.
  --config <path>       Path to trashtests.config.ts (default: ./trashtests.config.ts)
  --json                Emit machine-readable JSON to stdout
  --markdown            Emit markdown summary (for PR comments)
  --fail-below <n>      Exit code 1 if MTC < n (0-100). Config scoring.failBelow overrides.
  --strict              Treat info findings as warning (default: off)
  --coverage <path>     Path to coverage-final.json (default: ./coverage/coverage-final.json)
  --junit <path>        Path to junit.xml
  --include <glob>      Only analyze files matching glob
  --exclude <glob>      Exclude files matching glob
  --output <path>       Write report to file (default: stdout)
  --quiet               Suppress non-essential output
  --verbose             Verbose debug logs to stderr
  -h, --help            Show this help

Examples:
  trashtests scan                       # scan the diff vs main
  trashtests scan --scan-all            # scan the whole repo
  trashtests scan --json > report.json  # machine-readable output
  trashtests scan --fail-below 50       # exit 1 if MTC < 50
  trashtests explain no-assertion       # docs for the rule
`

function findTestFiles(repoRoot: string): string[] {
  const testFiles: string[] = []
  const visited = new Set<string>()

  const isIgnoredDir = (rel: string): boolean => {
    const parts = rel.split('/')
    return parts.includes('node_modules') || parts.includes('dist') || parts.includes('.git')
  }

  const walk = (dir: string): void => {
    if (visited.has(dir)) return
    visited.add(dir)

    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }

    for (const entry of entries) {
      const full = join(dir, entry)
      // Normalize to forward slashes so path checks work on Windows too.
      const rel = relative(repoRoot, full).replace(/\\/g, '/')

      // Skip ignored directories (any nesting level)
      if (isIgnoredDir(rel)) {
        continue
      }

      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        walk(full)
      } else if (
        (full.endsWith('.test.ts') ||
          full.endsWith('.test.tsx') ||
          full.endsWith('.test.js') ||
          full.endsWith('.test.jsx') ||
          full.endsWith('.test.mjs') ||
          full.endsWith('.test.cjs') ||
          full.endsWith('.spec.ts') ||
          full.endsWith('.spec.tsx') ||
          full.endsWith('.spec.js') ||
          full.endsWith('.spec.jsx') ||
          full.endsWith('.spec.mjs') ||
          full.endsWith('.spec.cjs') ||
          rel.includes('__tests__') ||
          rel.startsWith('tests/') ||
          rel.startsWith('test/') ||
          ['test.ts', 'test.tsx', 'test.js', 'test.jsx', 'test.mjs', 'test.cjs'].includes(rel)) &&
        !full.endsWith('.d.ts')
      ) {
        testFiles.push(full)
      }
    }
  }

  walk(repoRoot)
  return testFiles
}

function runGit(repoRoot: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', repoRoot, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    return null
  }
}

function detectMainBranch(repoRoot: string): string {
  // Try common default-branch names, preferring the remote-tracking ref.
  // Returns 'main' if none resolve (the diff call will fall back to full scan).
  const candidates = ['origin/main', 'main', 'origin/master', 'master', 'origin/develop', 'develop']
  for (const candidate of candidates) {
    if (runGit(repoRoot, ['rev-parse', '--verify', '--quiet', candidate]) !== null) {
      return candidate
    }
  }
  return 'main'
}

function isTestRelPath(rel: string): boolean {
  if (rel.endsWith('.d.ts')) return false
  return (
    /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel) ||
    /(^|\/)__tests__\//.test(rel) ||
    /(^|\/)(tests?)\//.test(rel) ||
    /^test\.(ts|tsx|js|jsx|mjs|cjs)$/.test(rel)
  )
}

/**
 * Changed test files vs `base`: `git diff --name-only base...HEAD`.
 * Returns null when git is unavailable or the diff is empty.
 */
function getDiffInfo(repoRoot: string, baseRef: string): { base: string; files: string[] } | null {
  const out = runGit(repoRoot, ['diff', '--name-only', `${baseRef}...HEAD`, '--'])
  if (out === null || out.trim().length === 0) return null
  const files = out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && isTestRelPath(line))
  return { base: baseRef, files }
}

function globToRegExp(glob: string): RegExp {
  // Minimal glob support: ** (any depth, including zero segments), * (within
  // a segment), ? (single char). Path separators are normalized to '/' for
  // Windows compatibility. `**/x` and `x/**` match root-level files too.
  const normalized = glob.replace(/\\/g, '/')
  const starStar = '\u0001'
  // Order matters: `?`→`.` and `*`→`[^/]*` must run BEFORE we insert the
  // `(?:.*/)?` text (otherwise the newly inserted `?` chars get re-scanned).
  const escaped = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, starStar)
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(new RegExp(`${starStar}/`, 'g'), '(?:.*/)?') // **/ → zero or more segments
    .replace(new RegExp(starStar, 'g'), '.*') // lone ** → any depth
  return new RegExp(`^${escaped}$`)
}

export function matchesGlob(pattern: string, relPath: string): boolean {
  return globToRegExp(pattern).test(relPath.replace(/\\/g, '/'))
}

/**
 * Load trashtests.config.ts (via jiti, so TS configs work out of the box).
 * Returns null when the file doesn't exist or fails to load.
 */
async function loadConfig(
  repoRoot: string,
  explicitPath: string | undefined,
): Promise<TrashTestsConfig | null> {
  const configPath = explicitPath
    ? resolve(repoRoot, explicitPath)
    : resolve(repoRoot, 'trashtests.config.ts')
  if (!existsSync(configPath)) return null
  try {
    const jiti = createJiti(import.meta.url)
    const mod = (await jiti.import(configPath)) as Record<string, unknown>
    const config = (mod.default ?? mod) as TrashTestsConfig | undefined
    return config ?? null
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`Failed to load config ${configPath}: ${msg}`)
    return null
  }
}

/**
 * Minimal junit.xml summary: first <testsuite> element's attributes.
 */
function readJunitSummary(
  path: string,
): { tests: number; failures: number; errors: number; skipped: number } | null {
  try {
    const xml = readFileSync(path, 'utf8')
    const match = /<testsuite\b([^>]*)>/i.exec(xml)
    if (!match) return null
    const attrs = match[1]
    const num = (name: string): number => {
      const m = new RegExp(`${name}="(\\d+)"`, 'i').exec(attrs)
      return m ? Number.parseInt(m[1], 10) : 0
    }
    return {
      tests: num('tests'),
      failures: num('failures'),
      errors: num('errors'),
      skipped: num('skipped'),
    }
  } catch {
    return null
  }
}

export async function runCli(argv: string[]): Promise<void> {
  // Handle subcommands first (init, explain, formula, list-rules, doctor).
  if (handleSubcommand(argv)) {
    return
  }

  const options = parseArgs(argv)

  if (options.help) {
    process.stdout.write(HELP_TEXT)
    process.exit(0)
  }

  if (options.version) {
    process.stdout.write('Trash Tests\n')
    process.exit(0)
  }

  // `scan` is the primary command.
  const repoRoot = process.cwd()
  const config = await loadConfig(repoRoot, options.config)

  // Merge config: CLI flags win over config file values.
  const failBelow = options.failBelow ?? config?.scoring?.failBelow
  const scanAll = options.scanAll === true || config?.scanAll === true
  if (!options.include && config?.include) options.include = config.include
  if (!options.exclude && config?.exclude) options.exclude = config.exclude

  const log = (level: 'debug' | 'info' | 'warn', message: string): void => {
    if (level === 'debug' && !options.verbose) return
    if (level === 'warn') {
      process.stderr.write(`Warning: ${message}\n`)
    } else if (level === 'info' && !options.quiet) {
      process.stderr.write(`Info: ${message}\n`)
    }
  }

  // Validate --fail-below (CLI or config) before doing any work.
  if (failBelow !== undefined && (Number.isNaN(failBelow) || failBelow < 0 || failBelow > 100)) {
    console.error('Invalid --fail-below value; expected a number 0-100.')
    process.exit(2)
  }

  let files = findTestFiles(repoRoot)

  if (!scanAll) {
    // Default diff mode: only analyze changed test files, so unchanged (already
    // scored) tests don't drag the number down. Falls back to a full scan when
    // git is unavailable or the diff contains no test files.
    const baseRef = options.diff ?? detectMainBranch(repoRoot)
    const diffInfo = getDiffInfo(repoRoot, baseRef)
    if (diffInfo && diffInfo.files.length > 0) {
      const wanted = new Set(diffInfo.files)
      files = files.filter((f) => wanted.has(relative(repoRoot, f).replace(/\\/g, '/')))
      if (files.length === 0) {
        log('warn', 'No changed test files matched; falling back to full scan.')
        files = findTestFiles(repoRoot)
      } else {
        log(
          'info',
          `Scanning diff against "${diffInfo.base}" (${files.length} changed test file(s)).`,
        )
      }
    } else {
      log('warn', 'Could not compute a git diff (empty or non-git repo); scanning all test files.')
    }
  }

  if (options.include) {
    const pattern = options.include
    files = files.filter((f) => matchesGlob(pattern, relative(repoRoot, f)))
  }
  if (options.exclude) {
    const pattern = options.exclude
    files = files.filter((f) => !matchesGlob(pattern, relative(repoRoot, f)))
  }

  if (files.length === 0) {
    console.error('No test files found. Looking for *.test.ts, *.spec.ts, __tests__/* etc.')
    console.error(`Searched: ${repoRoot}`)
    console.error('')
    console.error('Tip: run `trashtests scan` from the root of a JS/TS project.')
    process.exit(3)
  }

  log('info', `Found ${files.length} test file(s).`)
  log('debug', `Files: ${files.map((f) => relative(repoRoot, f)).join(', ')}`)

  const coveragePath = options.coverage ?? resolve(repoRoot, 'coverage', 'coverage-final.json')
  const orchestrator = new Orchestrator(config?.scoring?.weights)
  const result = await orchestrator.analyze({
    repoRoot,
    files,
    coveragePath: existsSync(coveragePath) ? coveragePath : undefined,
    enableMutation: false,
    disabledRuleIds: config?.rules?.disabled,
    suppressions: config?.rules?.suppressions,
    log,
  })

  const junitPath = options.junit
  if (junitPath) {
    const summary = readJunitSummary(junitPath)
    if (summary) {
      log(
        'info',
        `JUnit: ${summary.tests} tests, ${summary.failures} failures, ${summary.errors} errors, ${summary.skipped} skipped.`,
      )
    } else {
      log('warn', `Could not parse junit file: ${junitPath}`)
    }
  }

  // --strict: escalate info findings to warnings before formatting.
  if (options.strict) {
    for (const finding of result.findings) {
      if (finding.severity === 'info') finding.severity = 'warning'
    }
  }

  // Detect base ref for display
  const mainBranch = detectMainBranch(repoRoot)

  const writeOutput = (text: string): void => {
    if (options.output) {
      writeFileSync(options.output, text)
    } else {
      process.stdout.write(text)
    }
  }

  if (options.json) {
    const json = JsonFormatter.format(result, {
      repoRoot,
      diff: { base: mainBranch, head: 'HEAD' },
      coveragePath,
    })
    writeOutput(json)
  } else if (options.markdown) {
    const md = MarkdownFormatter.format(result, { repoRoot })
    writeOutput(md)
  } else {
    const terminal = new TerminalFormatter({ useColor: !options.quiet })
    const output = terminal.format(result, {
      diff: { base: mainBranch, head: 'HEAD' },
    })
    writeOutput(output)
  }

  // Exit code
  if (failBelow !== undefined && result.score.mtc < failBelow) {
    process.exit(1)
  }
}
