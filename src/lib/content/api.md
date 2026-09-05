<span id="data-attributes" aria-hidden="true"></span>

<h2 id="api">API reference</h2>

<h3 id="attributes">Attributes</h3>

All observed attributes are strings in markup. This reference keeps the historic anchors and covers the full current attribute surface: shape and observation, wobble, morph, drift, and the four reflected state properties.

<div class="table-container" role="region" aria-label="Dynamoblobs attribute reference">

| Attribute | Default | Meaning |
| --- | --- | --- |
| `data-blob-points` | `10` | Vertex count; values below three are clamped. |
| `data-blob-variance` | `8` | Radius deviation in the internal 100-unit viewBox. |
| `data-blob-seed` | random | Readable deterministic key or encoded snapshot. |
| `data-blob-observe` | unset | Regenerate on viewport exit: `once`, `continuous`, optionally with `:margin`. |
| `data-blob-wobble-autoplay` | `true` | Start ambient CSS wobble after upgrade. |
| `data-blob-wobble-speed` | `30000` | Wobble period in milliseconds. |
| `data-blob-wobble-intensity` | `2` | Wobble deformation multiplier. |
| `data-blob-morph-autoplay` | `false` | Start the continuous morph loop. |
| `data-blob-morph-speed` | `7500` | Morph-loop cycle duration in milliseconds. |
| `data-blob-morph-intensity` | `1` | Requested RMS displacement as a fraction of variance, before radius clamping; actual movement can be smaller. |
| `data-blob-morph-tween` | `600` | Transition duration in milliseconds when live shape attributes retune the blob. |
| `data-blob-drift-autoplay` | `false` | Start DVD-style drift in the positioned parent. |
| `data-blob-drift-speed` | `1.25` | Drift speed multiplier. |
| `data-blob-drift-intensity` | `1` | Turn severity for collisions and `deflect()`. |
| `data-blob-drift-bias` | `0.9` | Collision-radius multiplier, clamped from `0.5` to `1.5`. |
| `data-blob-drift-click` | `false` | Expose the host as a button that deflects on click, <kbd>Enter</kbd>, or <kbd>Space</kbd>. |
| `data-blob-drift-start-position` | `random` | `random`, `center`, or `current`; edits reposition initialized drift immediately. `current` keeps the displayed position. |
| `data-blob-is-wobbling` | reflects state | Set `true`/`false` or read the live wobble state. |
| `data-blob-is-morphing` | reflects state | Set `true`/`false` or read the live morph state. |
| `data-blob-is-drifting` | reflects state | Set `true`/`false` or read the live drift state. |
| `data-blob-is-animating` | reflects state | Master control; true when any layer is playing. |

</div>

The seventeen configuration attributes control the blob; the four `data-blob-is-*` attributes mirror live state and are writable controls. This distinction keeps declarative setup separate from runtime state.

<h3 id="state-properties">State properties</h3>

The element exposes four readonly booleans: `.isWobbling`, `.isMorphing`, `.isDrifting`, and `.isAnimating`. Each mirrors its matching `data-blob-is-*` attribute. Shape generation and attribute-retune tweens count as morphing. Use the master state when a UI needs one pause/resume switch, and the layer properties for a specific control.

<h3 id="methods">Instance methods</h3>

Every instance method returns the element, so layered controls can chain. The ten methods are `play(options?)`, `pause()`, `playWobble(durationMs?)`, `pauseWobble()`, `playMorph(customDuration?)`, `pauseMorph()`, `playDrift(speed?)`, `pauseDrift()`, `generateNewBlob(duration?)`, and `deflect()`.

```js
const blob = document.querySelector('dynamo-blob');

blob.pauseWobble().playMorph(4000).playDrift(1.5);
blob.generateNewBlob(500);
blob.deflect();
```

`play()` resumes configured auto-play layers. Passing `{ morph, wobble, drift }` forces each listed layer and supplies its timing. `pause()` freezes all three layers in place. `pauseMorph()` also stops standalone generation or attribute-retune tweens at their visible frame; those standalone requests are canceled rather than resumed. `generateNewBlob()` morphs from the visible shape to a new silhouette. Changing the point count resamples the starting shape, so that transition may begin with a visible approximation. If continuous morphing is active, it resumes smoothly from the generated points; repeated generation requests retarget the in-flight tween instead of being dropped. Reduced-motion mode completes generation with a 1ms transition. `deflect()` redirects a drifting blob without changing its speed.

Timing supplied to `play*()` persists until the matching speed attribute changes; unrelated settings leave it intact. Updating a running morph duration preserves its progress. Drift uses elapsed time, so speed is consistent across display refresh rates. Play and generation calls on a detached element are safe no-ops.

<h3 id="completion-event">Completion event</h3>

`dynamo-blob-complete` fires when a one-off generation or morph cycle completes. It is dispatched on the blob; attach the listener directly.

```js
blob.addEventListener('dynamo-blob-complete', (event) => {
  console.log('Blob finished', event.detail);
}, { once: true });
```

<h3 id="runtime-exports">Runtime and TypeScript exports</h3>

The ten runtime exports are `DynamoBlob`, `generateBlobPath`, `generateBlobPoints`, `nextMorphShape`, `parseBlobPath`, `interpolateBlob`, `resampleClosed`, `createSeededRandom`, `encodeBlobSeed`, and `decodeBlobSeed`.

```ts
import {
  createSeededRandom, generateBlobPath, encodeBlobSeed, decodeBlobSeed,
  parseBlobPath, nextMorphShape
} from 'dynamoblobs';

const random = createSeededRandom('avatar-42');
const path = generateBlobPath({ points: 9, variance: 14, random });
const seed = encodeBlobSeed(path);
const restored = decodeBlobSeed(seed);
const next = nextMorphShape(path, { variance: 14, intensity: 0.5 });
```

The declarations export `BlobPoint`, `BlobGenerationOptions`, `NextMorphShapeOptions`, `BlobPlayOptions`, `DynamoBlob`, and `DynamoBlobAttributes`, and add `<dynamo-blob>` to `HTMLElementTagNameMap` and the global JSX intrinsic elements. JSX uses the framework’s `div` host-attribute types when available; otherwise it accepts common HTML, ARIA, data, style, and native event attributes without a React dependency. Frameworks with a scoped JSX namespace need their own custom-element registration.

<h3 id="lifecycle-accessibility">Lifecycle, SSR, and accessibility</h3>

- Generated SVG is decorative. The host is also hidden from assistive technology unless `data-blob-drift-click` turns it into a keyboard-operable button. Supply `aria-label` or `aria-labelledby` when “Deflect blob” is not enough context.
- Automatic animation honors `prefers-reduced-motion`, including live preference changes. Explicit `play*()` controls remain available.
- The module is safe to import without DOM globals. The browser registry guards duplicate definition.
- Disconnecting the host cancels active animation frames and observation; reconnecting preserves the visible silhouette and resumes eligible motion.
- `IntersectionObserver` is only necessary for `data-blob-observe`; the silhouette still renders where it is unavailable.

Drifting blobs share cached host and container measurements. Resize and relevant layout changes invalidate the cache; active frames then batch fresh measurements before drift writes. Shape changes recalculate collision geometry separately. A bounded 250ms containing-block check covers stylesheet edits that produce no observer event; browsers without `ResizeObserver` use throttled dimension checks. Pausing or disconnecting releases the subscription, and the last subscriber removes shared observers and listeners.

<h3 id="troubleshooting">Troubleshooting</h3>

- **The blob has no useful space:** set width and height on the host or place it in a sizing layout.
- **The blob is invisible:** give the host a `fill` that contrasts with its surface.
- **A method is missing:** import the package and wait for `customElements.whenDefined('dynamo-blob')` before calling it.
- **Drift does not move:** give its parent a practical positioned box, then enable `data-blob-drift-autoplay` or call `playDrift()`.
