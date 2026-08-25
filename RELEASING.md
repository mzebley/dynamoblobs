# Releasing Dynamoblobs

`main` is the reviewed development branch and the production source. Ordinary feature, fix, and documentation pull requests target `main`. Before the first stable tag, a forward `0.x` package version may record an unpublished development milestone. Public version changes use one temporary `release/vX.Y.Z` branch so they cannot accidentally publish from an ordinary PR.

The canonical npm package is `dynamoblobs`. GitHub Packages requires a scope, so the same release commit is mirrored there as `@mzebley/dynamoblobs`. The release scripts require both tarballs to contain the same files and byte sizes except for the package name in `package.json`; each registry keeps its own integrity hash.

The historical `0.x` changelog entries are pre-public development milestones. `v1.0.0` is the first public stable release and the first stable Git tag.

## Prepare a stable release

Start from the reviewed commit that should become the release:

```bash
git switch -c release/v1.0.0
npm run release:prepare -- 1.0.0
npm run gate
```

`release:prepare` updates `package.json`, both version fields in `package-lock.json`, and promotes the current `CHANGELOG.md` entries out of `Unreleased`. Review those edits rather than treating the script as release notes generation.

Push the branch and open a pull request to `main` with the exact title:

```text
release: v1.0.0
```

CI enforces the branch, title, version, changelog, documentation, package contents, generated artifacts, tests, production build, and source accessibility checks. A successful release PR also uploads both stable tarballs as a 30-day candidate artifact. Install that artifact in a consumer when the release changes package loading or declarations.

`npm run verify:rendered` is an explicit maintainer check for changes to rendered docs, motion, focus, reflow, or themes. It is intentionally not part of the blocking package gate; run `npm run verify:release` when both the release gate and the full rendered matrix are warranted.

## Cut an optional prerelease

From GitHub Actions, run **Release** on the prepared release branch with a candidate such as `1.0.0-rc.1`.

- Leave **Publish to registries** off to build and retain inspected candidate tarballs without making anything public.
- Turn it on to publish `dynamoblobs@1.0.0-rc.1` and `@mzebley/dynamoblobs@1.0.0-rc.1` with the `next` dist-tag, then create the matching immutable tag and GitHub prerelease.

Candidate numbers are immutable. If a candidate needs a fix, update the release branch and use `-rc.2`; never reuse `-rc.1`.

## Promote to production

Merge the approved `release/vX.Y.Z` PR into `main`. The release workflow confirms that the production tree exactly matches the release PR, reruns the complete gate, and packs both registry variants once. It then:

1. Publishes the scoped mirror to GitHub Packages with `latest`.
2. Publishes the canonical package to npm with `latest` when the `PUBLISH_NPM` repository variable is `true`.
3. Creates the immutable `vX.Y.Z` tag and GitHub Release only after the enabled registry jobs succeed.

Registry retries are integrity-aware. An existing matching package is accepted; an existing package with different contents fails the release. Use **Re-run failed jobs** after a transient or one-registry failure. Do not bump the version merely because a later job failed.

Published versions cannot be replaced. If a stable release is wrong, leave its package and tag intact, document the problem, and prepare the next patch release. Move a dist-tag only to a package version that has independently passed the release checks.

## One-time registry setup

GitHub Packages publishes with the repository `GITHUB_TOKEN`; no long-lived GitHub package token is needed. The first GitHub package may need its visibility changed after publication if it should be independently public.

npm trusted publishing cannot be configured until `dynamoblobs` exists. Bootstrap it without a repository token:

1. Run **Release** for `1.0.0-rc.1` with **Publish to registries** on while `PUBLISH_NPM` is unset. This publishes the inspected GitHub mirror and retains the canonical npm tarball as a workflow artifact.
2. Download that workflow artifact, verify it against `pack.json`, and publish its `dynamoblobs-1.0.0-rc.1.tgz` interactively to npm with the `next` tag. Authenticate with npm web login and 2FA; do not create an automation token.
3. Configure npm trusted publishing for repository `mzebley/dynamoblobs`, workflow `release.yml`, environment `npm`, with `npm publish` permission.
4. Set the repository variable `PUBLISH_NPM` to `true`, then verify OIDC with the next immutable candidate, such as `1.0.0-rc.2`.
5. After that succeeds, set the package publishing-access policy to require 2FA and disallow tokens.

For the interactive bootstrap, use the unmodified artifact rather than repacking the checkout:

```bash
gh run download RUN_ID --name dynamoblobs-1.0.0-rc.1 --dir release-artifacts
node scripts/release/check-package.mjs release-artifacts/pack.json
npm login --auth-type=web --registry=https://registry.npmjs.org
npm publish release-artifacts/dynamoblobs-1.0.0-rc.1.tgz --ignore-scripts --registry=https://registry.npmjs.org --tag next
```

The release job has no npm token fallback. It uses npm 11.5.1 or newer, Node 22.14 or newer, and `id-token: write`; trusted publishing supplies provenance automatically.

## Repository rules

Keep `main` protected by pull requests and require the **Branch policy** and **Verify** checks from `.github/workflows/ci.yml`. Dismiss stale approvals after new pushes and block force-pushes and deletion. The existing review rule can remain stricter than CI.

## Documentation and package rules

Every pull request runs these durable checks:

- `check-docs.mjs` compares the declared attributes, public methods, exports, completion event, install command, homepage, and npm links with the README and documentation.
- The Svelte/Zebkit documentation build and source checks exercise the authored site contract; use `verify:rendered` for changes whose proof requires a browser.
- `check-generated.mjs` rejects a build that changes committed package bundles or generated Zebkit artifacts.
- `check-package.mjs` requires the license, README, complete ESM/CommonJS/UMD/type surface, registry-neutral metadata, and matching dual-registry contents while excluding source, tests, scripts, and credentials.

Add release-facing behavior to `CHANGELOG.md` under `Unreleased`. Update README examples when the normal install or primary usage changes; put the complete contract in the documentation rather than expanding the README into a second reference manual.
