# Good Test Fixtures

These are hand-curated **exemplary** test files. They should score **≥85** on Trash Tests.

## Criteria for "good"

A good test:
1. Has at least one meaningful assertion (not just `toBeDefined()`)
2. Verifies observable behavior (return value, side effect, or thrown error)
3. Uses mocks sparingly and with explicit validation
4. Tests both happy and error paths when applicable
5. Has a name that describes the behavior being verified

## Files

| File | Source | What's good about it |
|---|---|---|
| `lodash-get.test.ts` | Inspired by Lodash `_.get` tests | Tests edge cases (nested paths, default values, null/undefined) |
| `formatPrice.test.ts` | Inspired by Fastify utility tests | Tests both happy path and error paths (TypeError, unsupported currency) |

## License

These fixtures are original works inspired by the testing style of the named projects. They are not direct copies. They are licensed under Apache-2.0 (same as the rest of the repo).

If you'd like to contribute a "good" fixture, please:
1. Ensure it scores ≥85 on Trash Tests
2. Add an entry to this README
3. Add a golden score entry in `../golden/good.scores.json`
