**Maintainer:** Frangel Raúl Crespo Barrera
**Last verified:** 2026-10-02
**Scope:** test fixtures, scoring, weak/strong/decorative cases, determinism, and reporters.

| Field | Current record |
|---|---|
| Status | Suites are distributed under `packages/*/tests/`; no single root `tests/` directory is required. |
| Evidence | `packages/cli/tests/`, `packages/core/tests/`, `packages/reporters/tests/`, `packages/fixtures/`, `.github/workflows/ci.yml`, `.github/workflows/codeql.yml`. |
| Verification | Run the package test commands from `package.json`; record fixture corpus and runner versions with benchmark output. |
| Owner | Repository owner. |
| Limitations | “Test effectiveness” is a project metric, not formal proof or certification; report false positives/negatives. |

Benchmark reports must identify corpus, versions, deterministic inputs, scoring rules, and date. Keep fixture classes separate and version changes to the corpus.
