# Releasing Trash Tests

This repository publishes the `trashtests` command-line package, its supporting packages, and the repository-distributed GitHub Action from one release tag.

## Before creating a release

Confirm that `main` is clean, the GitHub Actions `release` environment has an `NPM_TOKEN` secret with publishing access, and the intended npm package names are available to the publishing account.

Run the release checks locally with the target version:

```bash
pnpm install --frozen-lockfile
pnpm verify
pnpm check-release-version v1.0.0
pnpm audit --audit-level=high --prod
```

The version argument must match the root manifest and every public package manifest. The release workflow runs the same check before publishing.

## Publish packages and create a GitHub Release

Create and push an annotated tag that matches the package version:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

The release workflow validates the repository, publishes public npm packages with provenance, and creates the matching GitHub Release.

## Maintain the GitHub Action major tag

After the release workflow succeeds, point the stable major tag at the release commit:

```bash
git tag -fa v1 -m "Update v1 to v1.0.0"
git push origin v1 --force
```

Workflow users should reference `frangelbarrera/trash-tests/packages/github-action@v1`. Move the major tag only after the corresponding release has passed CI.

## Make the repository public

Before changing visibility, confirm that the README, repository description, topics, social preview, issue templates, security policy, and release notes are ready for public readers. Enable branch protection for `main` after the repository is public, requiring the Build & Test check and disallowing force pushes. CodeQL will then run automatically according to its workflow condition.
