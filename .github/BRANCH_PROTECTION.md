# Branch protection rules

For the `main` branch, we recommend enabling:

- ✅ Require a pull request before merging
  - ✅ Require approvals: 1 (or more for high-traffic repos)
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - Required status checks:
    - `Build & Test` (CI workflow)
    - `CodeQL Analysis`
  - ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution before merging
- ✅ Require linear history
- ✅ Do not allow bypassing the above settings

This is configured in the GitHub UI:
**Settings → Branches → Branch protection rules → Add rule → Branch name pattern: `main`**

We don't enforce this via `.github/` because branch protection can only be configured via the GitHub API or UI.

For the `develop` branch (if used):
- Same as `main`, but with relaxed approval requirements (no approvals required if author is a maintainer).
