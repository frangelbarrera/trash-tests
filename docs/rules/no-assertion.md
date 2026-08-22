# Rule: `no-assertion`

| Field | Value |
|---|---|
| **Severity** | `critical` |
| **Category** | `assertion` |
| **FP estimate** | 0.05 |
| **Contributes to** | Assertion Quality (per-test 0 pts) |

## What it detects

A test body (`it()` / `test()` / `test.concurrent()` callback) that contains **0 assertion calls**.

Assertion calls are detected by AST:

```ts
// Detected as assertions
expect(...);
assert.<method>(...);       // Node.js assert
require(...).assert.<method>(...);
fc.assert(...);             // fast-check
expect.assertions(N);        // counts, but only if N > 0
expect.hasAssertions();
```

## Why it matters

A test name can imply success without verifying an observable outcome. A test without an assertion is only a runtime check that the code does not throw.

## Examples

### Triggers

```ts
it('logs in user', () => {
  login({ user: 'a', pass: 'b' });
});
```

### Triggers: setup without verification

```ts
it('initializes app', async () => {
  await app.init();
  // No assertion
});
```

### Does not trigger

```ts
it('logs in user', () => {
  expect(login({ user: 'a', pass: 'b' }).token).toBeDefined();
});
```

### Does not trigger: explicit assertions

```ts
it('calls api exactly once', () => {
  expect.assertions(1);
  login({ user: 'a', pass: 'b' });
  expect(api.post).toHaveBeenCalledTimes(1);
});
```

## Edge cases (do NOT trigger)

- `it.skip(...)`, `it.todo(...)`, `test.skip(...)` — these aren't tests.
- `it.each(...)` with an empty array — skipped.
- `describe.each(...)` — wrappers, not tests.
- `expect.assertions(0)` — explicit "I expect zero assertions" (rare but legitimate in race-condition tests). This pattern is flagged because it does not verify an observable outcome.

## Suggested fix

```
This test has zero assertions. A test without an assertion is only a runtime
check that the code does not throw.

Suggested fix:
  1. Add at least one `expect()` call that verifies observable behavior (return value,
     side effect, or thrown error).
  2. If the test only checks "doesn't throw", use `expect.assertions(0)` and rename the
     test to "<thing> does not throw" to make the intent explicit.
```

## Implementation

See [`packages/core/src/rules/NoAssertion.ts`](../../packages/core/src/rules/NoAssertion.ts).
