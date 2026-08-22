# Decorative fixtures

These curated fixture files contain tests that pass but provide little or no behavioral verification. They are used to guard rule behavior and score stability.

## Criteria

A decorative test has one or more of the following characteristics:

1. It has no assertions.
2. It contains only trivial assertions, such as `toBeDefined()`, `expect(true).toBe(true)`, or a standalone snapshot.
3. It mocks every dependency and verifies only mock interaction.
4. It tests implementation details instead of observable behavior.

## Fixtures

| File | Pattern |
|---|---|
| `tautology.test.ts` | A tautological `expect(true).toBe(true)` assertion. |
| `no-assertion.test.ts` | Calls a function without asserting its result. |

## License

The fixtures are fictional and do not reproduce tests from external codebases. They are licensed under Apache-2.0.

To contribute a fixture, remove identifying information, add an entry to this file, and add its expected score to `../golden/decorative.scores.json`.
