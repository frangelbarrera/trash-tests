import type { OrchestratorResult } from '@trash-tests/core'
import picocolors from 'picocolors'

export interface TerminalFormatterOptions {
  useColor: boolean
  ascii?: boolean
}

export interface FormatContext {
  diff: { base: string; head: string }
}

const BOX_CHARS = {
  tl: '╔',
  tr: '╗',
  bl: '╚',
  br: '╝',
  h: '═',
  v: '║',
}

const ASCII_BOX = {
  tl: '+',
  tr: '+',
  bl: '+',
  br: '+',
  h: '-',
  v: '|',
}

interface BoxChars {
  tl: string
  tr: string
  bl: string
  br: string
  h: string
  v: string
}

export class TerminalFormatter {
  private c: typeof picocolors
  private box: BoxChars

  constructor(opts: TerminalFormatterOptions) {
    this.c = picocolors
    this.box = (opts.ascii ? ASCII_BOX : BOX_CHARS) as BoxChars
    if (!opts.useColor) {
      this.c = {
        ...picocolors,
        red: (s: string) => s,
        green: (s: string) => s,
        yellow: (s: string) => s,
        blue: (s: string) => s,
        cyan: (s: string) => s,
        gray: (s: string) => s,
        bold: (s: string) => s,
        dim: (s: string) => s,
        white: (s: string) => s,
      } as typeof picocolors
    }
  }

  format(result: OrchestratorResult, ctx: FormatContext): string {
    const lines: string[] = []
    const width = 64
    const criticalCount = result.findings.filter(
      (finding) => finding.severity === 'critical',
    ).length
    const warningCount = result.findings.filter((finding) => finding.severity === 'warning').length
    const ss = result.score.subscores
    const signals = [
      { label: 'Assertion Quality', score: ss.assertionQuality },
      { label: 'Repository Branch Coverage', score: ss.branchCoverage },
      { label: 'Mutation Resistance', score: ss.mutationResistance },
      { label: 'Error-Path Coverage', score: ss.errorPathCoverage },
      { label: 'Mock Sanity', score: ss.mockSanity },
    ].filter((signal): signal is { label: string; score: number } => signal.score !== null)

    lines.push(`  ${this.box.tl}${this.box.h.repeat(width)}${this.box.tr}`)
    lines.push(`  ${this.box.v}${' '.repeat(width)}${this.box.v}`)
    lines.push(`  ${this.box.v}   TRASH TESTS — test quality checks${' '.repeat(29)}${this.box.v}`)
    lines.push(`  ${this.box.v}${' '.repeat(width)}${this.box.v}`)
    lines.push(
      this.boxLine(
        `Tests analyzed: ${result.testsAnalyzed}  |  Score: ${result.score.mtc} / 100`,
        width,
      ),
    )
    lines.push(
      this.boxLine(`Critical findings: ${criticalCount}  |  Warnings: ${warningCount}`, width),
    )
    lines.push(this.boxLine(`Analysis completed in ${result.stats.totalMs}ms`, width))
    lines.push(`  ${this.box.v}${' '.repeat(width)}${this.box.v}`)
    lines.push(`  ${this.box.bl}${this.box.h.repeat(width)}${this.box.br}`)
    lines.push('')

    if (signals.length > 0) {
      lines.push('  Signals                             Score')
      lines.push(`  ${'─'.repeat(48)}`)
      for (const signal of signals) {
        lines.push(`  ${signal.label.padEnd(34)} ${this.colorScore(signal.score)}`)
      }
      lines.push('')
    }

    if (result.findings.length > 0) {
      lines.push(`  Top ${Math.min(5, result.findings.length)} findings (full list: --json)`)
      lines.push(`  ${'─'.repeat(58)}`)
      for (const [index, finding] of result.findings.slice(0, 5).entries()) {
        lines.push(`  ${index + 1}. ${finding.file} › "${finding.testName}"`)
        lines.push(`     Finding: ${finding.reason.split('\n')[0]}`)
        lines.push(`     Location: ${finding.file}:${finding.line}`)
        lines.push('')
      }
    } else {
      lines.push('  No weak-test findings detected.')
      lines.push('')
    }

    if (result.score.mtc < 50) {
      lines.push(`  Action: Review critical findings before merge (${result.score.mtc}/100).`)
    } else if (result.score.mtc < 80) {
      lines.push(`  Action: Review the findings above (${result.score.mtc}/100).`)
    } else {
      lines.push(`  Action: No severe assertion issues detected (${result.score.mtc}/100).`)
    }
    lines.push(
      `  Scope: ${ctx.diff.base}...${ctx.diff.head}  |  Files analyzed: ${result.filesAnalyzed}`,
    )
    lines.push('')
    return lines.join('\n')
  }

  private boxLine(content: string, width: number): string {
    return `  ${this.box.v}   ${content}${' '.repeat(Math.max(0, width - 3 - content.length))}${this.box.v}`
  }

  private colorScore(score: number | null): string {
    if (score === null) return '  —'
    if (score >= 80) return this.c.green(score.toString().padStart(3))
    if (score >= 50) return this.c.yellow(score.toString().padStart(3))
    return this.c.red(score.toString().padStart(3))
  }
}
