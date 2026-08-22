# Trash Tests GitHub Action

Review changed JavaScript and TypeScript tests in pull requests. The Action identifies weak-test findings, publishes a concise summary, and can enforce a score threshold.

## Usage

```yaml
name: Test quality

on:
  pull_request:
    paths:
      - '**/*.js'
      - '**/*.jsx'
      - '**/*.ts'
      - '**/*.tsx'

permissions:
  contents: read
  pull-requests: write

jobs:
  trash-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: actions/setup-node@v7
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: npm test -- --coverage

      - name: Review changed tests
        id: trash-tests
        uses: frangelbarrera/trash-tests/packages/github-action@v1
        with:
          post-comment: true
          coverage-path: ./coverage/coverage-final.json
```

## Inputs

| Input | Default | Description |
|---|---:|---|
| `fail-below` | `0` | Fail the check when the score is below this value. `0` disables the threshold. |
| `ignore-breakage` | `false` | Keep the check successful when the score is below the threshold. |
| `post-comment` | `true` | Post or update one marked pull-request comment. |
| `coverage-path` | `./coverage/coverage-final.json` | Path to an Istanbul coverage report. |

## Outputs

| Output | Description |
|---|---|
| `score` | Test quality score. |
| `assertion-quality` | Assertion Quality score when measured. |
| `branch-coverage` | Repository Branch Coverage when coverage data is available. |
| `findings-count` | Number of critical and warning findings. |

## Security

Use the Action with `pull_request`, not `pull_request_target`, for pull requests that may contain untrusted code. Do not provide write tokens or repository secrets to untrusted build steps. `pull-requests: write` is only required when `post-comment` is enabled.

## Behavior

The Action analyzes changed test files on pull requests. When the pull-request diff is unavailable, it scans recognized test files in the repository. It supports JavaScript and TypeScript test files and reports findings for supported runners. The `v1` tag is the stable major-release reference for workflow consumers.
