# Changes

## Production readiness

Trash Tests now provides deterministic JavaScript and TypeScript test-quality checks through the CLI and GitHub Action. The release work includes reproducible package installation, deterministic Action bundles, supported-runner detection, documented rule controls, clean production reports, and continuous integration checks.

## Checks

- `no-assertion` identifies executable tests without a recognized assertion.
- `trivial-assertion` identifies tautologies and isolated low-signal assertions.

## Compatibility

Trash Tests recognizes Vitest, Jest, Mocha, Ava, Node assertions, fast-check, common type assertions, and Vitest Browser assertions. Repositories can disable rules or document narrow suppressions in `trashtests.config.ts`.
