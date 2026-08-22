# Supported runners

Trash Tests analyzes recognized JavaScript and TypeScript test runners. Files without a recognized runner are skipped to avoid reporting uncertain findings.

| Runner | Detection | Recognized assertions |
|---|---|---|
| Vitest | `import` or `require('vitest')`, `vi` calls | `expect`, `expect.soft`, `expect.element`, `expect.poll`, `expectTypeOf` |
| Jest | `import` or `require('jest')`, `jest` calls | `expect`, Node assertions |
| Mocha | `import` or `require('mocha')` | `expect`, Node assertions |
| Ava | `import` or `require('ava')` | Ava `t.*` assertions |
| Node assertions | Any recognized runner | `assert(...)`, `assert.*` |
| fast-check | Any recognized runner | `fc.assert(...)` |
| Type assertions | Any recognized runner | `util.assertEqual(...)`, `util.assertIs(...)` |

## Coverage

Trash Tests reads Istanbul `coverage-final.json` produced by common JavaScript and TypeScript test tooling. Provide the file with `--coverage <path>` or the `coverage-path` input of the GitHub Action.

```bash
trashtests scan --coverage ./coverage/coverage-final.json
```

## Recognized test files

The CLI and GitHub Action recognize `.test.*`, `.spec.*`, files under `test/`, `tests/`, or `__tests__/`, and root-level `test.*` files for JavaScript and TypeScript extensions.
