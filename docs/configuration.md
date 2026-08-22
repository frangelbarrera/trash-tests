# Configuration

Trash Tests reads an optional TypeScript configuration file from the repository root. Use `--config <path>` to load another file.

## Template

```ts
import type { TrashTestsConfig } from '@trash-tests/core'

const config: TrashTestsConfig = {
  scoring: {
    weights: {
      assertionQuality: 0.4,
      branchCoverage: 0.6,
    },
    // failBelow: 50,
  },
  rules: {
    // disabled: ['trivial-assertion'],
    // suppressions: [
    //   {
    //     ruleId: 'no-assertion',
    //     files: 'tests/smoke/**',
    //     reason: 'Intentional smoke coverage without assertions',
    //   },
    // ],
  },
  include: '**/*.test.ts',
  exclude: '**/node_modules/**',
  scanAll: false,
}

export default config
```

## Fields

| Field | Type | Default | Description |
|---|---|---|---|
| `scoring.weights` | `Partial<ScoringWeights>` | Built-in relative weights | Optional weights for the measured signals. |
| `scoring.failBelow` | Number from 0 to 100 | Off | Exits with status 1 when the score is below the threshold. `--fail-below` overrides it. |
| `rules.disabled` | String array | None | Rule identifiers disabled for the repository. |
| `rules.suppressions` | Array | None | Explicit exceptions with a rule, file glob, and reviewable reason. |
| `include` | Simple glob | All recognized test files | Include only matching test files. Supported tokens are `*`, `**`, and `?`. |
| `exclude` | Simple glob | None | Exclude matching test files after discovery. |
| `scanAll` | Boolean | `false` | Scan the repository instead of the default diff-first selection. |

## Supressions

Use a suppression only for an intentional exception. Keep it narrow, explain the reason, and remove it when the exception no longer applies.

```ts
rules: {
  suppressions: [
    {
      ruleId: 'no-assertion',
      files: 'tests/smoke/health.test.ts',
      reason: 'Intentional runtime health check',
    },
  ],
}
```

## Precedence

CLI flags override configuration. Configuration overrides built-in defaults.

```bash
trashtests scan --scan-all
trashtests scan --config .ci/trashtests.config.ts --json > trashtests-report.json
trashtests scan --fail-below 50
```

## Type safety

`TrashTestsConfig` is exported by `@trash-tests/core`.
