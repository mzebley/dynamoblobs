# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-25

### Added
- Release-candidate and production pipelines now enforce the first-public-release contract, upload inspected tarballs, publish npm and GitHub Package variants, and finalize immutable GitHub releases.
- Release checks keep package metadata, generated bundles, the README, installation examples, and the documented public API synchronized.

### Changed
- `generateNewBlob()` now retargets from the exact rendered silhouette and, when called during continuous morphing, hands the generated points back to the still-running loop without a jump or dropped request.
- Click deflection exposes the host as a named button with pointer, <kbd>Enter</kbd>, and <kbd>Space</kbd> activation; ordinary decorative blobs remain hidden from assistive technology.
- Package declarations now distinguish ESM and CommonJS consumers, while UMD files remain available for classic direct-script loading.
- npm keeps the canonical unscoped `dynamoblobs` name; GitHub Packages receives the required `@mzebley/dynamoblobs` scoped mirror from the same release commit.
- Automated npm publishing is token-free: the first candidate is bootstrapped interactively, then subsequent releases require trusted publishing through OIDC.
- The blocking release gate now keeps browser-heavy Zebkit rendered verification explicit instead of repeating the full matrix for every PR and publish job.

### Fixed
- Corrected the documented attribute count, runtime defaults, readable-seed behavior, and morph-tween meaning.
- Dark-theme highlighted code now uses a matching dark code canvas, and unupgraded code listings contain their own narrow-screen overflow.
- The package now ships its MIT license text and runs the complete release gate before publication.
- The Live controls demo now exposes wobble as its own pressed-state control instead of leaving the default ambient motion unexplained.

## [0.10.0] - 2026-08-23

### Added
- ESM/CommonJS conditional root exports, retained direct-script exports, and durable package-export parity coverage.
- A prerendered SvelteKit documentation application with mdsvex content, Shiki code blocks, live blob controls, and preserved legacy anchors.

### Changed
- Migrated documentation from the mark-down pipeline to SvelteKit 5, Vite, TypeScript, and static Vercel build output.
- Delivered Zebkit 0.16.1 generated tokens/runtime, responsive navigation, theme and type-size controls, and modern Rollup UMD/ESM/CommonJS outputs.

### Fixed
- Importing the module during SSR no longer requires DOM globals.
- Legacy documentation hashes continue to resolve through retained IDs or explicit mappings.

## [0.9.1] - 2026-07-01

### Added
- **Control methods chain.** `play`, `pause`, `playWobble`/`pauseWobble`,
  `playMorph`/`pauseMorph`, `playDrift`/`pauseDrift`, `startDrift`/`stopDrift`,
  `generateNewBlob`, and `deflect` all return the element:
  `blob.pauseWobble().playMorph().playDrift(2)`.

### Fixed
- **`data-blob-observe` is now reactive like every other attribute.** It was read once at
  connect: setting it after render silently did nothing, removing it didn't stop the
  viewport-triggered regeneration, and changing the mode or root margin kept the stale
  observer. Setting, changing, or removing the attribute now applies live.
- **Reactive shape attributes were no-ops.** The element's own `data-blob-seed` write-back
  was read back as a user seed on the next config read, so every retune targeted the shape
  already on screen — changing `data-blob-points` / `data-blob-variance` after render did
  nothing. The write-back is no longer treated as a seed; user seeds still win.
- **`generateNewBlob` (and `data-blob-observe`) could get permanently blocked.** A completed
  retune tween left a stale animation-frame id behind that read as "tween in flight" forever;
  a retune or `playMorph` superseding an in-flight shuffle also left `isGeneratingBlob` wedged.
  Tween completion and every cancel path now reset both. The first shuffle after a retune is
  also no longer a visual no-op (it used to tween to the shape already on screen).
- **Moving the element in the DOM killed its play state.** Disconnect paused morph/drift and
  stamped `data-blob-is-*="false"`, which the reconnect read as an explicit user "off" —
  re-parenting silently stopped autoplay layers. Reconnect now resumes whatever was playing,
  keeps paused layers paused, and preserves the current silhouette.
- **`data-blob-seed` could smuggle markup into the DOM.** The decoded seed was interpolated
  into `innerHTML` with only a `startsWith("M")` check, so a crafted seed could inject live
  elements (XSS if seeds come from untrusted input). The path `d` is now set via
  `setAttribute` (inert), and decoded seeds must match a strict path allowlist — which also
  stops innocent string seeds that happen to base64-decode to `M…` (e.g. `TWFyaw` → `Mark`)
  from rendering as a broken literal path.
- **Non-positive morph durations no longer loop forever.** A negative `data-blob-morph-speed`
  (or `playMorph` duration) made tween progress never reach 1, spinning an rAF loop that
  never advanced; durations are now clamped to a 1ms minimum.

### Changed
- The inner `<svg>` no longer copies the host's `id` (which created duplicate ids in the
  document); it now renders without an `id`.

## [0.9.0] - 2026-06-29

### Changed
- **`data-blob-drift-intensity` now shapes the deflection angle, not speed.** It tunes how
  extreme a deflection is — both when the blob hits a wall and on a `data-blob-drift-click` —
  while leaving speed untouched (that stays `data-blob-drift-speed`). At a wall, `1` is a
  clean mirror bounce, `>1` randomizes sharp, steep ricochets, and `<1` randomizes shallow,
  grazing skims; the random spread grows with the value's distance from `1` and saturates by
  ~`0` and ~`2`. A click deflect follows the same scale: `1` is a fully random new heading,
  `>1` snaps toward a hard reversal, and `<1` only nudges off the current heading. Corner
  hits reflect off both walls in a single combined bounce.

### Fixed
- **Drift autoplay didn't start when morph autoplay was also on.** Starting the morph
  layer reflected `data-blob-is-drifting="false"` onto the element before drift's autoplay
  was evaluated, so it read back as an explicit "off" and was skipped. Play/pause state is
  no longer mirrored to the `data-blob-is-*` attributes until the element has finished
  deciding its initial play state.

## [0.8.0] - 2026-06-29

### Fixed
- **Morph could blank the blob.** Changing `data-blob-points` / `data-blob-variance`
  mid-morph left a `null` target in the loop, which interpolated to an empty path and
  made the blob vanish for a cycle or two. Retunes now re-baseline from the on-screen
  shape and redirect the live morph toward the new silhouette; `animateBlob` also never
  writes an empty path as a safety net.
- **Pause/resume morph jumped.** Resuming regenerated the target and double-counted
  elapsed time, so the shape leapt forward (worse the longer the pause). Resume now
  continues the frozen tween at the exact same progress (and survives a morph-speed
  change while paused).

### Changed
- **Drift collision rewritten.** The bounce now uses a rotation-invariant radius sampled
  from the rendered path curve (not the wobbled `getBoundingClientRect`, and not the
  Bézier control points), so it no longer breathes with the CSS wobble or bounces short.
  It avoids per-frame path bounding-box reads.

### Added
- `data-blob-drift-bias` (default `0.9`, clamped `0.5`–`1.5`) — scales the drift
  collision radius to tune how tightly the bounce hugs the wall; the default lets the
  blob carry a touch past before reversing.

## [0.7.0] - 2026-06-28

### Changed
- **Motion attributes redesigned around a single convention.** Each of the three
  layers — wobble, morph, drift — now exposes `data-blob-<layer>-autoplay`,
  `data-blob-is-<layer>ing`, `data-blob-<layer>-speed`, and
  `data-blob-<layer>-intensity`. The layers are always available; you control only
  whether each auto-plays and play/pause it live.
- `data-blob-is-wobbling` / `-is-morphing` / `-is-drifting` are two-way: set them to
  pause/play, and they reflect the live state. `data-blob-is-animating` is the master
  freeze/resume. All four are mirrored to `.isWobbling`, `.isMorphing`, `.isDrifting`,
  and `.isAnimating`.
- `prefers-reduced-motion` now suppresses auto-play only (via the `*-autoplay` flags);
  explicit `is-*` attributes and JS `play*()` calls run regardless.

### Added
- `data-blob-morph-intensity` — holds the per-cycle reshape magnitude constant, so the
  morph loop stays reliably dramatic at higher values instead of occasionally landing on
  a near-identical shape.
- `data-blob-drift-intensity` — bounce restitution at the walls (`1` elastic, `<1`
  damps, `>1` energizes, with a max-speed clamp).
- `nextMorphShape()` is exported alongside the other pure generators.

### Notes
- This is a proof-of-concept release with no backwards-compatibility shims for the
  renamed attributes.

## [0.6.0] - 2026-06-27

### Changed
- The drift bounce now measures the rendered silhouette (host box vs. the path's
  bounding rect) instead of estimating it from `BASE_RADIUS ± variance/2`. The
  estimate ignored the CSS wobble (which scales the blob to ~0.9) and the
  quadratic curve, leaving a small constant gap to the wall; the measurement
  tracks the actual visible blob — wobble, skew, rotation, and morph included.
  It is sampled every few frames (it changes slowly) to avoid per-frame layout.

## [0.5.0] - 2026-06-27

### Changed
- Drift now bounces off the blob's visible silhouette instead of the host
  element's box, so a blob meets the walls instead of reversing early across its
  transparent padding. The inset is derived from the blob geometry
  (`BASE_RADIUS ± variance/2`), so it adapts as `data-blob-variance` changes and
  needs no per-frame `getBBox()`. The transparent box overhangs the container as
  it does so — drift containers should clip overflow.

## [0.4.0] - 2026-06-27

### Added
- `data-blob-drift-start` attribute controlling where drift begins: `random`
  (default — scatters ambient backgrounds), `center`, or `current` (continues
  from the element's laid-out position instead of teleporting to a random spot).

### Changed
- `startDrift()` now initialises the drift position before switching the element
  to absolute positioning, so a `current` start can read its in-flow location.

## [0.3.0] - 2026-06-27

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

## [0.2.0]

### Added
- `<dynamo-blob>` attributes are reactive — changing one re-tunes the element in place.
- `data-blob-paused` attribute to freeze wobble, morph, and drift.

### Fixed
- Drift tears down on `data-blob-drift="false"` so the element re-centers.

## [0.1.0]

### Added
- Initial release: dependency-free generative SVG blobs as a `<dynamo-blob>` custom
  element with wobble, morph, drift, seeding, and Intersection Observer regeneration.
