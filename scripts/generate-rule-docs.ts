#!/usr/bin/env tsx
/**
 * Generate docs/rules/*.md from rule metadata.
 *
 * Each rule in packages/core/src/rules/*.ts exports a class with `metadata`.
 * This script reads the metadata and generates a doc page per rule.
 *
 * Usage:
 *   pnpm generate-rule-docs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { NoAssertionRule, TrivialAssertionRule } from '@trash-tests/core'

const DOCS_RULES_DIR = join(import.meta.dirname, '..', 'docs', 'rules')
if (!existsSync(DOCS_RULES_DIR)) {
  mkdirSync(DOCS_RULES_DIR, { recursive: true })
}

interface RuleMeta {
  id: string
  name: string
  severity: 'critical' | 'warning' | 'info'
  category: string
  description: string
  fpEstimate: number
  version: string
}

function generateDoc(meta: RuleMeta): string {
  return `# Rule: \`${meta.id}\`

| Field | Value |
|---|---|
| **Severity** | \`${meta.severity}\` |
| **Category** | \`${meta.category}\` |
| **FP estimate** | ${meta.fpEstimate} |

## Description

${meta.description}

> This page is generated from the rule metadata. Add project-specific guidance in the rule implementation and contribution documentation.

## Implementation

See \`packages/core/src/rules/${meta.id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}.ts\` (capitalized).
`
}

function main() {
  const rules: RuleMeta[] = [new NoAssertionRule().metadata, new TrivialAssertionRule().metadata]

  let generated = 0
  for (const rule of rules) {
    const docPath = join(DOCS_RULES_DIR, `${rule.id}.md`)
    // Preserve hand-written documentation; create a starter page only when absent.
    if (!existsSync(docPath)) {
      writeFileSync(docPath, generateDoc(rule))
      console.log(`✓ Generated: docs/rules/${rule.id}.md`)
      generated++
    } else {
      console.log(`  Skipped (already exists): docs/rules/${rule.id}.md`)
    }
  }

  console.log(`\nGenerated ${generated} doc(s).`)
}

main()
