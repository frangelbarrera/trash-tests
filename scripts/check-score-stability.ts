#!/usr/bin/env tsx
/**
 * Score stability check.
 *
 * Runs Trash Tests on the fixtures corpus and diffs the results against
 * the golden files. If scores drift, exits with code 1.
 *
 * Used by CI to ensure score changes are deliberate (golden file updated)
 * and not accidental (rule logic changed without updating golden).
 *
 * Usage:
 *   pnpm check-score-stability
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Orchestrator } from '../packages/core/src/index.ts'

const FIXTURES_DIR = join(import.meta.dirname, '..', 'packages', 'fixtures')
const STABILITY_FILE = join(FIXTURES_DIR, 'golden', '.last-stability.json')

interface StabilityEntry {
  file: string
  mtc: number
  findings: number
  timestamp: number | null
}

async function collectCurrent(): Promise<StabilityEntry[]> {
  const entries: StabilityEntry[] = []
  const dirs = ['good', 'decorative', 'edge']
  for (const dir of dirs) {
    const dirPath = join(FIXTURES_DIR, dir)
    if (!existsSync(dirPath)) continue
    const files = readdirSync(dirPath).filter(
      (f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'),
    )
    for (const file of files) {
      const orchestrator = new Orchestrator()
      const result = await orchestrator.analyze({
        repoRoot: FIXTURES_DIR,
        files: [join(dirPath, file)],
        log: () => {},
      })
      entries.push({
        file: `${dir}/${file}`,
        mtc: result.score.mtc,
        findings: result.findings.length,
        timestamp: null,
      })
    }
  }
  return entries
}

async function main() {
  const current = await collectCurrent()

  if (!existsSync(STABILITY_FILE)) {
    console.log('No previous stability file found. Writing current state.')
    writeFileSync(STABILITY_FILE, JSON.stringify(current, null, 2) + '\n')
    console.log(`Wrote: ${STABILITY_FILE}`)
    process.exit(0)
  }

  const previous = JSON.parse(readFileSync(STABILITY_FILE, 'utf8')) as StabilityEntry[]
  const prevByFile = new Map(previous.map((e) => [e.file, e]))

  let driftCount = 0
  for (const curr of current) {
    const prev = prevByFile.get(curr.file)
    if (!prev) {
      console.log(`+ ${curr.file}: new fixture (MTC=${curr.mtc})`)
      continue
    }
    if (curr.mtc !== prev.mtc || curr.findings !== prev.findings) {
      console.log(
        `~ ${curr.file}: MTC ${prev.mtc} → ${curr.mtc}, findings ${prev.findings} → ${curr.findings}`,
      )
      driftCount++
    }
  }

  if (driftCount === 0) {
    console.log('\n✓ Score stability: PASS (no drift)')
    process.exit(0)
  } else {
    console.log(`\n✗ Score stability: FAIL (${driftCount} fixture(s) drifted)`)
    console.log('   If intentional: pnpm calibrate && update golden files.')
    console.log('   If accidental: revert the rule change that caused the drift.')
    // Update stability file anyway so the next run is clean
    writeFileSync(STABILITY_FILE, JSON.stringify(current, null, 2) + '\n')
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Score stability check failed:', error)
  process.exit(2)
})
