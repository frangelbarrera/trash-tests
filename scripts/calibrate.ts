#!/usr/bin/env tsx
/**
 * Calibration script.
 *
 * Runs Trash Tests against the fixtures corpus, compares the computed
 * scores against the golden labels, and reports Pearson correlation.
 *
 * Target: Pearson ≥ 0.7 on the corpus. If below, weights are wrong
 * and we tune before tagging a release.
 *
 * Usage:
 *   pnpm calibrate
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_WEIGHTS, Orchestrator } from '../packages/core/src/index.ts'

interface GoldenEntry {
  expectedMTC: number
  expectedFindings: number
  rationale: string
}

interface GoldenFile {
  [fixturePath: string]: GoldenEntry
}

const FIXTURES_DIR = join(import.meta.dirname, '..', 'packages', 'fixtures')
const GOLDEN_DIR = join(FIXTURES_DIR, 'golden')

async function loadGolden(filename: string): Promise<GoldenFile> {
  const path = join(GOLDEN_DIR, filename)
  if (!existsSync(path)) {
    console.warn(`Golden file not found: ${path}`)
    return {}
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

async function runOnFixture(fixturePath: string): Promise<{ mtc: number; findings: number }> {
  const orchestrator = new Orchestrator()
  const result = await orchestrator.analyze({
    repoRoot: FIXTURES_DIR,
    files: [join(FIXTURES_DIR, fixturePath)],
    log: () => {},
  })
  return {
    mtc: result.score.mtc,
    findings: result.findings.length,
  }
}

function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length === 0) {
    return 0
  }
  const n = xs.length
  const meanX = xs.reduce((a, b) => a + b, 0) / n
  const meanY = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  if (denX === 0 || denY === 0) return 0
  return num / Math.sqrt(denX * denY)
}

async function main() {
  console.log('🗑  Trash Tests — Calibration\n')
  console.log(`Default weights: ${JSON.stringify(DEFAULT_WEIGHTS, null, 2)}\n`)

  const categories: { name: string; golden: string; dir: string; label: number }[] = [
    { name: 'good', golden: 'good.scores.json', dir: 'good', label: 100 },
    { name: 'decorative', golden: 'decorative.scores.json', dir: 'decorative', label: 0 },
    { name: 'edge', golden: 'edge.scores.json', dir: 'edge', label: 50 },
  ]

  const predictedScores: number[] = []
  const labeledScores: number[] = []
  let totalFixtures = 0
  let passingFixtures = 0

  for (const cat of categories) {
    console.log(`\n=== ${cat.name.toUpperCase()} ===`)
    const golden = await loadGolden(cat.golden)
    if (Object.keys(golden).length === 0) {
      console.log('  (no golden entries)')
      continue
    }
    const dirPath = join(FIXTURES_DIR, cat.dir)
    if (!existsSync(dirPath)) {
      console.log(`  (directory not found: ${dirPath})`)
      continue
    }
    const files = readdirSync(dirPath).filter(
      (f) => f.endsWith('.test.ts') || f.endsWith('.test.tsx'),
    )

    for (const file of files) {
      const fixturePath = `${cat.dir}/${file}`
      const goldenEntry = golden[fixturePath]
      if (!goldenEntry) {
        console.log(`  ⚠  ${file}: no golden entry, skipping`)
        continue
      }
      const result = await runOnFixture(fixturePath)
      const mtcDiff = result.mtc - goldenEntry.expectedMTC
      const findingsDiff = result.findings - goldenEntry.expectedFindings
      const mtcPass = Math.abs(mtcDiff) <= 15 // allow ±15 tolerance
      const findingsPass = Math.abs(findingsDiff) <= 2 // allow ±2 tolerance
      const bothPass = mtcPass && findingsPass
      const symbol = bothPass ? '✓' : '✗'
      console.log(
        `  ${symbol} ${file}: MTC=${result.mtc} (expected ${goldenEntry.expectedMTC}, Δ=${mtcDiff > 0 ? '+' : ''}${mtcDiff}), findings=${result.findings} (expected ${goldenEntry.expectedFindings}, Δ=${findingsDiff > 0 ? '+' : ''}${findingsDiff})`,
      )
      console.log(`      → ${goldenEntry.rationale}`)
      predictedScores.push(result.mtc)
      labeledScores.push(goldenEntry.expectedMTC)
      totalFixtures++
      if (bothPass) passingFixtures++
    }
  }

  const correlation = pearson(predictedScores, labeledScores)

  console.log('\n=== CALIBRATION REPORT ===')
  console.log(`Fixtures tested: ${totalFixtures}`)
  console.log(
    `Fixtures passing: ${passingFixtures}/${totalFixtures} (${Math.round((passingFixtures / totalFixtures) * 100)}%)`,
  )
  console.log(`Pearson correlation: ${correlation.toFixed(4)}`)
  console.log(`Target: Pearson ≥ 0.70`)

  if (correlation >= 0.7) {
    console.log('\n✓ PASS — calibration target met.')
    process.exit(0)
  } else {
    console.log(
      '\n✗ FAIL — calibration target not met. Tune weights in packages/core/src/scoring/ScoringEngine.ts',
    )
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('Calibration failed:', error)
  process.exit(2)
})
