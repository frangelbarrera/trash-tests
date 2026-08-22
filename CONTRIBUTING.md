# Contributing to Trash Tests

Thank you for helping improve Trash Tests. Contributions that make weak-test findings more accurate, clearer, and easier to act on are especially valuable.

## Prerequisites

- Node.js 20.11 or later
- pnpm 9.12 or later

## Set up the project

```bash
git clone https://github.com/frangelbarrera/trash-tests.git
cd trash-tests
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` runs formatting, type checks, builds, unit tests, score-stability checks, and a clean package-consumption test.

## Make a change

Keep each pull request focused. Add or update tests for every behavioral change, and run the full verification suite before opening the pull request.

```bash
pnpm verify
```

The core analyzer uses Babel ASTs. Rules live in `packages/core/src/rules`, parser behavior lives in `packages/core/src/adapters/language`, and regression fixtures live in `packages/fixtures`.

## Add or improve a rule

A rule should have a precise purpose, a clear severity, and a test suite that covers both positive findings and valid code that must not be flagged. Keep false-positive risk low and document configuration or suppression guidance when it is needed.

1. Add the rule implementation under `packages/core/src/rules`.
2. Register it with the rule set.
3. Add unit and AST regression tests.
4. Add or update fixtures when they demonstrate a user-visible pattern.
5. Update the rule documentation under `docs/rules`.
6. Run `pnpm verify`.

## Report a false positive

Use the [false-positive issue template](https://github.com/frangelbarrera/trash-tests/issues/new?template=false_positive.md). Include a minimal reproducible test, the rule identifier, the command or configuration used, and the expected result.

## Security issues

Do not report security vulnerabilities in a public issue. Follow the process in [`SECURITY.md`](./SECURITY.md).

## Releases

Maintainers should follow [`RELEASING.md`](./RELEASING.md) for version checks, package publication, and GitHub Action tags.
