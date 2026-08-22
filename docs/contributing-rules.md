# How to Contribute a New Rule

This guide walks through adding a new detection rule to Trash Tests.

## 1. Pick a rule ID

Rule IDs are kebab-case, lowercase, descriptive. Examples:
- `no-assertion`
- `trivial-assertion`
- `your-rule-id`

Avoid vague names like `bad-test` or `weird-pattern`.

## 2. Create the rule class

In `packages/core/src/rules/`, create `<YourRuleName>.ts`:

```ts
import * as t from '@babel/types';
import type { Finding } from '../findings/Finding.js';
import type { RuleContext } from '../findings/RuleContext.js';
import type { Rule, RuleMetadata } from '../Rule.js';
import { TypeScriptAdapter } from '../adapters/language/TypeScriptAdapter.js';

export class YourRuleNameRule implements Rule {
  readonly metadata: RuleMetadata = {
    id: 'your-rule-id',
    name: 'Your Rule Name',
    severity: 'warning', // or 'critical' or 'info'
    category: 'assertion', // or 'coverage', 'mock', 'mutation', 'structure'
    description: 'One-line description shown in terminal output.',
    fpEstimate: 0.15, // Your estimated false-positive rate (0-1)
  };

  private adapter: TypeScriptAdapter;

  constructor(adapter?: TypeScriptAdapter) {
    this.adapter = adapter ?? new TypeScriptAdapter();
  }

  run(ctx: RuleContext): Finding[] {
    const findings: Finding[] = [];
    // ... rule logic ...
    return findings;
  }
}
```

## 3. Register the rule

In `packages/core/src/orchestrator.ts`:

```ts
import { YourRuleNameRule } from './rules/YourRuleName.js';
// ...
this.registry.register(new YourRuleNameRule(this.adapter));
```

## 4. Add fixtures

In `packages/fixtures/`, add at least 3 fixtures:

1. `packages/fixtures/good/your-rule-positive.test.ts` — a good test (does NOT trigger your rule)
2. `packages/fixtures/decorative/your-rule-triggers.test.ts` — a decorative test (TRIGGERS your rule)
3. `packages/fixtures/edge/your-rule-edge.test.ts` — an edge case (legitimate pattern that might look like a trigger)

## 5. Add golden scores

In `packages/fixtures/golden/{good,decorative,edge}.scores.json`, add an entry:

```json
{
  "good/your-rule-positive.test.ts": {
    "expectedMTC": 95,
    "expectedFindings": 0,
    "rationale": "Tests don't trigger the rule."
  },
  "decorative/your-rule-triggers.test.ts": {
    "expectedMTC": 30,
    "expectedFindings": 2,
    "rationale": "Tests trigger the rule twice."
  }
}
```

## 6. Add unit tests

In `packages/core/tests/rules/YourRuleName.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TypeScriptAdapter } from '../../src/adapters/language/TypeScriptAdapter.js';
import { YourRuleNameRule } from '../../src/rules/YourRuleName.js';

describe('YourRuleNameRule', () => {
  it('triggers on decorative pattern', () => { ... });
  it('does not trigger on good pattern', () => { ... });
  it('handles edge case as info', () => { ... });
});
```

## 7. Add a doc page

In `docs/rules/your-rule-id.md`, document the rule with:
- Metadata table (severity, category, false-positive estimate)
- What it detects
- Why it matters
- Examples that trigger and do not trigger the rule
- Suggested fix

You can run `pnpm generate-rule-docs` to generate a documentation starter page.

## 8. Update the README

In the root `README.md` checks table, add a row:

```md
| [`your-rule-id`](./docs/rules/your-rule-id.md) | Warning | What it catches. |
```

## 9. Run the checks

```bash
pnpm test          # All tests pass
pnpm calibrate     # Pearson ≥ 0.7
pnpm check-score-stability  # Update golden files if scores changed
pnpm lint
pnpm typecheck
```

If all pass, open a PR!

## Rule metadata conventions

- `severity`:
  - `critical` — block merge (used for: no-assertion)
  - `warning` — shown prominently (used for: trivial-assertion)
  - `info` — informational only
- `category`: assertion / coverage / mock / mutation / structure
- `fpEstimate`: be honest. 0.05 = very confident, 0.30 = noisy
