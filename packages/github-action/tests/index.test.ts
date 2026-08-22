import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  process.env.TRASH_TESTS_ACTION_AUTORUN = 'false'
  return {
    getInput: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    debug: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    context: {
      payload: {} as { pull_request?: { base: { sha: string } } },
      repo: { owner: 'acme', repo: 'tests' },
    },
    getOctokit: vi.fn(),
    analyze: vi.fn(),
  }
})

vi.mock('@actions/core', () => ({
  getInput: mocks.getInput,
  info: mocks.info,
  warning: mocks.warning,
  debug: mocks.debug,
  setOutput: mocks.setOutput,
  setFailed: mocks.setFailed,
}))

vi.mock('@actions/github', () => ({
  context: mocks.context,
  getOctokit: mocks.getOctokit,
}))

vi.mock('@trash-tests/core', () => ({
  Orchestrator: class {
    analyze = mocks.analyze
  },
}))

vi.mock('@trash-tests/reporters', () => ({
  MarkdownReporter: { format: vi.fn() },
}))

import { collectTestFiles, getInputs, run, selectFilesForEvent } from '../src/index.js'

const temporaryDirectories: string[] = []

function makeTemporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'trash-tests-action-'))
  temporaryDirectories.push(directory)
  return directory
}

function writeFile(root: string, path: string): void {
  const destination = join(root, path)
  mkdirSync(join(destination, '..'), { recursive: true })
  writeFileSync(destination, '// fixture\n')
}

beforeEach(() => {
  mocks.getInput.mockReset()
  mocks.info.mockReset()
  mocks.warning.mockReset()
  mocks.debug.mockReset()
  mocks.setOutput.mockReset()
  mocks.setFailed.mockReset()
  mocks.analyze.mockReset()
  mocks.context.payload = {}
})

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('getInputs', () => {
  it('uses documented defaults when inputs are omitted', () => {
    mocks.getInput.mockReturnValue('')

    expect(getInputs()).toEqual({
      failBelow: 0,
      ignoreBreakage: false,
      postComment: true,
      coveragePath: './coverage/coverage-final.json',
    })
  })

  it('parses explicit action inputs', () => {
    mocks.getInput.mockImplementation((name: string) => {
      return (
        {
          'fail-below': '75',
          'ignore-breakage': 'true',
          'post-comment': 'false',
          'coverage-path': 'artifacts/coverage.json',
        }[name] ?? ''
      )
    })

    expect(getInputs()).toEqual({
      failBelow: 75,
      ignoreBreakage: true,
      postComment: false,
      coveragePath: 'artifacts/coverage.json',
    })
  })

  it.each(['-1', '101', '7.5', 'invalid'])('rejects invalid fail-below value %s', (value) => {
    mocks.getInput.mockImplementation((name: string) => (name === 'fail-below' ? value : ''))

    expect(() => getInputs()).toThrow('Invalid fail-below input')
  })
})

describe('collectTestFiles', () => {
  it('finds supported test conventions and ignores generated directories', async () => {
    const root = makeTemporaryDirectory()
    writeFile(root, 'src/user.test.ts')
    writeFile(root, 'test.js')
    writeFile(root, '__tests__/account.ts')
    writeFile(root, 'node_modules/ignored.test.ts')
    writeFile(root, 'dist/ignored.spec.js')
    writeFile(root, 'coverage/ignored.test.ts')
    writeFile(root, 'src/not-a-test.ts')

    const files = await collectTestFiles(root)
    const relativeFiles = files.map((file) => relative(root, file).replace(/\\/g, '/')).sort()

    expect(relativeFiles).toEqual(['__tests__/account.ts', 'src/user.test.ts', 'test.js'])
  })
})

describe('run', () => {
  const successfulResult = {
    score: {
      mtc: 84,
      subscores: { assertionQuality: 82, branchCoverage: 75 },
    },
    findings: [{ severity: 'critical' }, { severity: 'warning' }, { severity: 'info' }],
  }

  it('publishes documented outputs for a successful analysis', async () => {
    mocks.getInput.mockImplementation((name: string) => (name === 'post-comment' ? 'false' : ''))
    mocks.analyze.mockResolvedValue(successfulResult)

    await run()

    expect(mocks.setOutput).toHaveBeenCalledWith('score', '84')
    expect(mocks.setOutput).toHaveBeenCalledWith('assertion-quality', '82')
    expect(mocks.setOutput).toHaveBeenCalledWith('branch-coverage', '75')
    expect(mocks.setOutput).toHaveBeenCalledWith('findings-count', '2')
    expect(mocks.setFailed).not.toHaveBeenCalled()
  })

  it('fails when the measured score is below the configured threshold', async () => {
    mocks.getInput.mockImplementation((name: string) => {
      return name === 'fail-below' ? '90' : name === 'post-comment' ? 'false' : ''
    })
    mocks.analyze.mockResolvedValue(successfulResult)

    await run()

    expect(mocks.setFailed).toHaveBeenCalledWith('Trash Tests score 84/100 is below threshold 90.')
  })

  it('keeps the check successful when ignore-breakage is enabled', async () => {
    mocks.getInput.mockImplementation((name: string) => {
      if (name === 'fail-below') return '90'
      if (name === 'ignore-breakage') return 'true'
      return name === 'post-comment' ? 'false' : ''
    })
    mocks.analyze.mockResolvedValue(successfulResult)

    await run()

    expect(mocks.setFailed).not.toHaveBeenCalled()
    expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining('ignore-breakage=true'))
  })
})

describe('selectFilesForEvent', () => {
  it('returns all discovered files for non-pull-request events', async () => {
    const files = ['/workspace/a.test.ts', '/workspace/b.spec.ts']

    await expect(selectFilesForEvent('/workspace', files)).resolves.toEqual(files)
  })

  it('selects only changed test files for a pull request', async () => {
    const root = makeTemporaryDirectory()
    execFileSync('git', ['init', '--quiet', root])
    execFileSync('git', ['-C', root, 'config', 'user.email', 'tests@example.com'])
    execFileSync('git', ['-C', root, 'config', 'user.name', 'Trash Tests'])
    writeFile(root, 'src/existing.test.ts')
    execFileSync('git', ['-C', root, 'add', '.'])
    execFileSync('git', ['-C', root, 'commit', '--quiet', '-m', 'base'])
    const baseSha = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim()
    writeFile(root, 'src/changed.test.ts')
    execFileSync('git', ['-C', root, 'add', '.'])
    execFileSync('git', ['-C', root, 'commit', '--quiet', '-m', 'change'])
    mocks.context.payload = { pull_request: { base: { sha: baseSha } } }

    const files = [join(root, 'src/existing.test.ts'), join(root, 'src/changed.test.ts')]

    await expect(selectFilesForEvent(root, files)).resolves.toEqual([
      join(root, 'src/changed.test.ts'),
    ])
  })

  it('falls back to all test files when the pull-request diff cannot be calculated', async () => {
    mocks.context.payload = { pull_request: { base: { sha: 'not-a-commit' } } }
    const files = ['/workspace/a.test.ts', '/workspace/b.spec.ts']

    await expect(selectFilesForEvent('/workspace', files)).resolves.toEqual(files)
    expect(mocks.warning).toHaveBeenCalledWith(
      expect.stringContaining('Could not calculate the pull request diff'),
    )
  })
})
