import { existsSync } from 'node:fs'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { Orchestrator } from '@trash-tests/core'
import { MarkdownReporter } from '@trash-tests/reporters'

/**
 * Trash Tests GitHub Action entry point.
 *
 * Reads inputs from action.yml, runs the orchestrator on the PR diff,
 * posts a summary comment, and sets the status check.
 */

export interface ActionInputs {
  failBelow: number
  ignoreBreakage: boolean
  postComment: boolean
  coveragePath: string
}

export function getInputs(): ActionInputs {
  const rawFailBelow = core.getInput('fail-below') || '0'
  const parsed = Number.parseInt(rawFailBelow, 10)
  if (!/^\d+$/.test(rawFailBelow) || Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('Invalid fail-below input; expected an integer from 0 to 100.')
  }
  return {
    failBelow: parsed,
    ignoreBreakage: core.getInput('ignore-breakage') === 'true',
    postComment: core.getInput('post-comment') !== 'false',
    coveragePath: core.getInput('coverage-path') || './coverage/coverage-final.json',
  }
}

export async function run(): Promise<void> {
  try {
    const inputs = getInputs()
    const repoRoot = process.cwd()

    core.info('Trash Tests starting...')
    core.info(`Repository: ${repoRoot}`)
    core.info(`Fail-below threshold: ${inputs.failBelow}`)
    core.info(`Post comment: ${inputs.postComment}`)

    const allTestFiles = await collectTestFiles(repoRoot)
    const files = await selectFilesForEvent(repoRoot, allTestFiles)

    if (files.length === 0) {
      core.info('No eligible test files found for this event. Skipping analysis.')
      return
    }

    core.info(`Analyzing ${files.length} test file(s).`)

    const orchestrator = new Orchestrator()
    const result = await orchestrator.analyze({
      repoRoot,
      files,
      coveragePath: existsSync(inputs.coveragePath) ? inputs.coveragePath : undefined,
      log: (level, msg) => {
        if (level === 'warn') core.warning(msg)
        else if (level === 'info') core.info(msg)
        else core.debug(msg)
      },
    })

    // Set outputs
    core.setOutput('score', result.score.mtc.toString())
    const subs = result.score.subscores
    core.setOutput('assertion-quality', subs.assertionQuality?.toString() ?? '')
    core.setOutput('branch-coverage', subs.branchCoverage?.toString() ?? '')
    core.setOutput(
      'findings-count',
      result.findings
        .filter((finding) => finding.severity === 'critical' || finding.severity === 'warning')
        .length.toString(),
    )

    // Post comment
    if (inputs.postComment && github.context.payload.pull_request) {
      const token = process.env.GITHUB_TOKEN
      if (!token) {
        core.warning('GITHUB_TOKEN not available; cannot post PR comment.')
      } else {
        const octokit = github.getOctokit(token)
        const prNumber = github.context.payload.pull_request.number
        const owner = github.context.repo.owner
        const repo = github.context.repo.repo

        const body = MarkdownReporter.format(result, {
          repoRoot,
          repoUrl: `https://github.com/${owner}/${repo}`,
        })
        const marker = '<!-- trash-tests -->'
        const bodyWithMarker = `${marker}\n${body}`

        const { data: comments } = await octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: prNumber,
          per_page: 100,
        })
        const existing = comments.find((c) => c.body?.includes(marker))

        if (existing) {
          await octokit.rest.issues.updateComment({
            owner,
            repo,
            comment_id: existing.id,
            body: bodyWithMarker,
          })
          core.info(`Updated existing comment on PR #${prNumber}`)
        } else {
          await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: prNumber,
            body: bodyWithMarker,
          })
          core.info(`Posted comment on PR #${prNumber}`)
        }
      }
    }

    // Fail the check if below threshold (unless breakage is ignored).
    const belowThreshold = inputs.failBelow > 0 && result.score.mtc < inputs.failBelow
    if (belowThreshold && inputs.ignoreBreakage) {
      core.warning(
        `Trash Tests score ${result.score.mtc}/100 is below threshold ${inputs.failBelow}; ` +
          'ignore-breakage=true keeps this check successful.',
      )
      core.info(`Trash Tests score: ${result.score.mtc}/100`)
    } else if (belowThreshold) {
      core.setFailed(
        `Trash Tests score ${result.score.mtc}/100 is below threshold ${inputs.failBelow}.`,
      )
    } else {
      core.info(`Trash Tests score: ${result.score.mtc}/100`)
    }
  } catch (error) {
    core.setFailed(`Trash Tests failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function selectFilesForEvent(
  repoRoot: string,
  allTestFiles: string[],
): Promise<string[]> {
  const pullRequest = github.context.payload.pull_request
  if (!pullRequest) return allTestFiles

  try {
    const { execFileSync } = await import('node:child_process')
    const { relative } = await import('node:path')
    const changed = execFileSync(
      'git',
      ['-C', repoRoot, 'diff', '--name-only', `${pullRequest.base.sha}...HEAD`, '--'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    const changedPaths = new Set(
      changed
        .split('\n')
        .map((file) => file.trim())
        .filter(Boolean),
    )
    const changedTests = allTestFiles.filter((file) =>
      changedPaths.has(relative(repoRoot, file).replace(/\\/g, '/')),
    )
    core.info(`PR diff contains ${changedTests.length} changed test file(s).`)
    return changedTests
  } catch (error) {
    core.warning(
      `Could not calculate the pull request diff; scanning all test files. ${error instanceof Error ? error.message : String(error)}`,
    )
    return allTestFiles
  }
}

export async function collectTestFiles(repoRoot: string): Promise<string[]> {
  const { readdirSync, statSync } = await import('node:fs')
  const { join, relative } = await import('node:path')
  const testFiles: string[] = []
  const visited = new Set<string>()

  const isIgnored = (rel: string): boolean => {
    const parts = rel.split('/')
    return (
      parts.includes('node_modules') ||
      parts.includes('.git') ||
      parts.includes('dist') ||
      parts.includes('coverage')
    )
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
      // Normalize separators so checks work on Windows too.
      const rel = relative(repoRoot, full).replace(/\\/g, '/')
      if (isIgnored(rel)) continue
      let stat
      try {
        stat = statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(full)
      } else if (
        /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry) ||
        rel.includes('__tests__') ||
        rel.startsWith('tests/') ||
        rel.startsWith('test/') ||
        ['test.ts', 'test.tsx', 'test.js', 'test.jsx', 'test.mjs', 'test.cjs'].includes(rel)
      ) {
        testFiles.push(full)
      }
    }
  }
  walk(repoRoot)
  return testFiles
}

if (process.env.TRASH_TESTS_ACTION_AUTORUN !== 'false') {
  void run()
}
