## What changed

Describe the consumer-visible result and any compatibility impact.

## Verification

- [ ] Tests cover behavior that could regress.
- [ ] `CHANGELOG.md` includes the user-facing change under `Unreleased`, or this is internal-only.
- [ ] README and documentation match the public API, install path, and examples, or no public contract changed.
- [ ] Generated `dist` and documentation artifacts are committed after their source changes.
- [ ] `npm run gate` passes locally, or the remaining CI-only evidence is called out below.

For a `release/vX.Y.Z` PR, also confirm:

- [ ] The PR title is exactly `release: vX.Y.Z`.
- [ ] `npm run release:prepare -- X.Y.Z` promoted the changelog and synchronized both manifests.
- [ ] The CI candidate tarball was installed in a consumer when exports or declarations changed.

## Remaining evidence

List anything deferred, report-only, unknown, or blocked.
