# Edge Case Fixtures

These are tests that **look** decorative but are legitimate patterns. They should score in the **40-70** range on Trash Tests, with `info` (not `warning` or `critical`) findings.

## Criteria for "edge"

An edge case test:
1. Uses type-only assertions (`expectTypeOf`) — no runtime check, but legitimate for type testing
2. Uses snapshot tests for generated output (UI components, generated configs)
3. Uses property-based testing (fast-check) — different assertion model
4. Uses `expect.assertions(0)` for race-condition tests

## Files

| File | Pattern | What's the edge case |
|---|---|---|
| `type-test.test.ts` | Type-only test | `expectTypeOf` from Vitest — no runtime assertion |
| `snapshot-test.test.ts` | Snapshot only | Snapshot tests of generated output |

## License

Apache-2.0.
