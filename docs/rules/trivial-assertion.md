# Rule: `trivial-assertion`

| Field | Value |
|---|---|
| **Severity** | `warning` |
| **Category** | `assertion` |
| **FP estimate** | 0.15 |
| **Contributes to** | Assertion Quality (per-test 0.2 pts) |

## What it detects

A test body where **all** assertions are in the trivial list:

| Pattern | Reason |
|---|---|
| `expect(true).toBe(true)` / `expect(a + b).toBe(a + b)` / `expect(x).toBe(x)` | Tautology: expected and actual expressions are structurally identical, so the assertion can never fail. |
| `expect(x).toBeDefined()` (alone) | Only checks non-undefined. |
| `expect(x).toBeTruthy()` (alone) | Only checks truthiness. |
| `expect(x).toBeFalsy()` (alone) | Same. |
| `.toMatchInlineSnapshot()` / `.toMatchSnapshot()` (alone) | Frozen output, not a check. |

**Deliberately NOT trivial:** `expect(x).not.toBeNull()`, `expect(x).not.toBeUndefined()`, `expect(x).resolves.toBe(1)`, `expect(x).rejects.toThrow(...)`, and `expect(typeof x).toBe('string')` — negated, resolved, and type-check matchers can fail and are treated as meaningful.

"Alone" means: the test body has no other meaningful assertion.

## Why it matters

A test name can imply a specific outcome while the assertion checks only that a value exists. Any non-undefined value would pass that assertion.

## Examples

### Triggers

```ts
it('returns something', () => {
  const result = compute();
  expect(result).toBeDefined();
});
```

### Triggers: tautology

```ts
it('always passes', () => {
  const sum = add(2, 3);
  expect(sum).toBe(sum);   // expected === actual — can never fail
});
```

### Does not trigger: meaningful assertion present

```ts
it('returns user', () => {
  const result = compute();
  expect(result).toBeDefined();
  expect(result.id).toBe(123);    // meaningful assertion
});
```

## Suggested fix

```
This test only verifies that the result exists, not what it contains. A test name can
imply a specific outcome while an existence-only assertion accepts any non-undefined value.

Suggested fix:
  Replace `expect(result).toBeDefined()` with a value assertion:
    expect(result.id).toBe(expectedId)
    expect(result.name).toBe(expectedName)
    expect(result).toEqual(expectedUser)

  Or, if you genuinely can't predict the value, assert shape:
    expect(result).toMatchObject({ id: expect.any(Number), name: expect.any(String) })
```

## Implementation

See [`packages/core/src/rules/TrivialAssertion.ts`](../../packages/core/src/rules/TrivialAssertion.ts).
