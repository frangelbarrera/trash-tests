---
name: False positive report
about: Report a test that was incorrectly flagged
title: "[FP]: "
labels: false-positive, bug
assignees: ''
---

## The test that was flagged

Attach the test file (or a sanitized excerpt). Include the file path and line that was flagged.

## The rule that fired

Which rule flagged this test? (for example, `no-assertion` or `trivial-assertion`)

You can find this in the `--json` output under `findings[].ruleId`.

## Why this is a false positive

Explain why this test is legitimate. Examples:

- "This is a type test using `expectTypeOf`, not a runtime assertion."
- "This is a snapshot test of generated output, not a behavioral assertion."
- "This test uses `expect.assertions(0)` to verify zero assertions in a race condition test."
- "The `expect(result).toBeDefined()` is the only meaningful assertion possible here because the return type is opaque."

## Expected behavior

What should Trash Tests have done instead? (e.g., "emit as `info`, not `warning`", "skip this test entirely")

## JSON output excerpt

```
Paste the relevant finding JSON here.
```
