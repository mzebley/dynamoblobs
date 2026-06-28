# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-06-27

### Added
- `data-blob-drift-start` attribute controlling where drift begins: `random`
  (default — scatters ambient backgrounds), `center`, or `current` (continues
  from the element's laid-out position instead of teleporting to a random spot).

### Changed
- `startDrift()` now initialises the drift position before switching the element
  to absolute positioning, so a `current` start can read its in-flow location.

## [1.2.0] - 2026-06-27

### Added
- Granular runtime controls: `playWobble(ms?)` / `pauseWobble()`, `playMorph(ms?)` /
  `pauseMorph()`, and `playDrift(speed?)` / `pauseDrift()`.
- Unified `play(options?)` orchestrator. With no arguments it resumes every animation
  the blob is configured to run (context-aware); an options key
  (`{ morph?, wobble?, drift? }`) forces that animation on and tunes it.
- `pause()` now freezes all three animations (wobble, morph, drift) in place.
- `data-blob-wobble-paused` attribute — freezes the wobble in place; set it at render
  to start wobble stopped but resumable via `playWobble()`.

### Changed
- **`play()` / `pause()` repurposed.** They previously controlled only the morph loop;
  the morph-only behavior now lives on `playMorph()` / `pauseMorph()`. `play()` /
  `pause()` now orchestrate wobble, morph, and drift together.
- **`data-blob-wobble-speed` is now in milliseconds** (default `30000`), to match the
  millisecond durations used by the JS methods. It was previously seconds.
- Explicit `play*()` method calls now run regardless of `prefers-reduced-motion`; the
  preference still gates the declarative auto-play paths (`data-blob-animate`,
  `data-blob-drift`).

### Notes
- No backwards-compatibility shims are included for the renamed/repurposed methods or
  the `data-blob-wobble-speed` unit change.

## [1.1.0]

### Added
- `<dynamo-blob>` attributes are reactive — changing one re-tunes the element in place.
- `data-blob-paused` attribute to freeze wobble, morph, and drift.

### Fixed
- Drift tears down on `data-blob-drift="false"` so the element re-centers.

## [1.0.0]

### Added
- Initial release: dependency-free generative SVG blobs as a `<dynamo-blob>` custom
  element with wobble, morph, drift, seeding, and Intersection Observer regeneration.
