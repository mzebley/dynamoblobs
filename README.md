# Dynamoblobs

Lightweight, dependency-free generative SVG blobs that generate a fresh silhouette every time they render. Each blob is a standard [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) (`<dynamo-blob>`) that swaps itself into the DOM, inherits your `fill`, and can wobble, morph, and drift on demand.

[Documentation + live examples](https://dynamoblobs.markzebley.com)

## Features
- **Drop-in custom element** – place `<dynamo-blob>` anywhere; classes, styles, and IDs flow through, and the path inherits your `fill`.
- **Deterministic or generative** – seed a blob for a reproducible shape, or let it randomize and regenerate via Intersection Observer triggers.
- **Three motion layers** – **wobble** (CSS turn / skew / scale), **morph** (a JS loop that interpolates between silhouettes), and **drift** (a "DVD"-style bounce with click-to-deflect). Each layer is always available — you choose whether it auto-plays and can play/pause it live.
- **Consistent naming** – every layer follows the same shape: `data-blob-<layer>-autoplay`, `data-blob-is-<layer>ing`, `data-blob-<layer>-speed`, `data-blob-<layer>-intensity`.
- **Runtime controls** – unified `play`/`pause`, granular `playWobble`/`pauseWobble`, `playMorph`/`pauseMorph`, `playDrift`/`pauseDrift`, plus `generateNewBlob`, `deflect`, a `dynamo-blob-complete` event, and live `.isWobbling` / `.isMorphing` / `.isDrifting` / `.isAnimating` state. TypeScript definitions included.
- **Motion aware** – `prefers-reduced-motion` suppresses auto-play, and loops/observers tear down when the element leaves the DOM.

## Installation

### npm
```bash
npm install dynamoblobs
```

```js
// Registers the <dynamo-blob> custom element globally
import 'dynamoblobs';
```

### CDN or direct script
```html
<!-- jsDelivr CDN -->
<script src="https://cdn.jsdelivr.net/gh/mzebley/dynamoblobs/dist/dynamoblobs.min.js" crossorigin="anonymous"></script>
```

### Angular
1. Add the script to the `angular.json` `scripts` array:
   ```json
   "scripts": [
     "node_modules/dynamoblobs/dist/dynamoblobs.js"
   ]
   ```
2. Opt in to custom elements support:
   ```ts
   import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

   @NgModule({
     schemas: [CUSTOM_ELEMENTS_SCHEMA]
   })
   export class AppModule {}
   ```

## Quick start
```html
<dynamo-blob class="fill-theme" style="width: 200px; height: 200px;"></dynamo-blob>

<style>
  .fill-theme { fill: var(--theme); }
</style>
```

## Data attributes

All three motion layers share one naming pattern: `data-blob-<layer>-autoplay` (start on render), `data-blob-is-<layer>ing` (live play/pause + state readout), `data-blob-<layer>-speed`, and `data-blob-<layer>-intensity`.

### Shape

| Attribute | Default | Description |
| --- | --- | --- |
| `data-blob-points` | `10` | Vertex count — higher is busier. Minimum 3. |
| `data-blob-variance` | `8` | Radius deviation — higher is lumpier. |
| `data-blob-seed` | _unset_ | A base64 path reproduces an exact shape; any other string deterministically seeds generation. |
| `data-blob-observe` | _unset_ | Regenerate as the element enters/leaves the viewport: `once:0px` or `continuous:64px`. |

### Wobble — ambient CSS turn / skew / scale

| Attribute | Default | Description |
| --- | --- | --- |
| `data-blob-wobble-autoplay` | `true` | Start wobbling on render (suppressed under reduced motion). |
| `data-blob-is-wobbling` | reflects state | Set `false` to pause, `true` to play. Mirrors `.isWobbling`. |
| `data-blob-wobble-speed` | `30000` | Wobble period in milliseconds. |
| `data-blob-wobble-intensity` | `2` | Skew intensity multiplier. |

### Morph — JS loop between silhouettes

| Attribute | Default | Description |
| --- | --- | --- |
| `data-blob-morph-autoplay` | `false` | Start the morph loop on render (suppressed under reduced motion). |
| `data-blob-is-morphing` | reflects state | Set `false` to pause, `true` to play. Mirrors `.isMorphing`. |
| `data-blob-morph-speed` | `7500` | Per-cycle morph duration in milliseconds. |
| `data-blob-morph-intensity` | `1` | How far each cycle reshapes the blob. The magnitude is held constant cycle-to-cycle, so higher values stay reliably dramatic. |
| `data-blob-morph-tween` | `600` | Tween duration (ms) when a shape attribute changes live. `0` snaps. |

### Drift — "DVD"-style bounce

| Attribute | Default | Description |
| --- | --- | --- |
| `data-blob-drift-autoplay` | `false` | Start drifting on render (suppressed under reduced motion). |
| `data-blob-is-drifting` | reflects state | Set `false` to pause in place, `true` to play. Mirrors `.isDrifting`. |
| `data-blob-drift-speed` | `1.25` | Drift velocity. |
| `data-blob-drift-intensity` | `1` | Extremity of the deflection *angle* — at the walls and on a `data-blob-drift-click` (speed is unchanged — that's `data-blob-drift-speed`). `1` is a clean mirror bounce / fully random click; `>1` randomizes sharp, steep "extreme" ricochets and snaps clicks toward a hard reversal; `<1` randomizes shallow, grazing skims and nudges. The effect grows with distance from `1` and saturates by ~`0` and ~`2`. |
| `data-blob-drift-bias` | `0.9` | How close the bounce hugs the wall. `<1` lets the blob carry slightly past before reversing; `>1` bounces sooner. Clamped to `0.5`–`1.5`. |
| `data-blob-drift-click` | `false` | Deflect to a new direction on click. |
| `data-blob-drift-start-position` | `random` | Where drift begins: `random` (scattered), `center`, or `current` (continues from the element's laid-out position — no teleport). |

### Master

| Attribute | Default | Description |
| --- | --- | --- |
| `data-blob-is-animating` | reflects state | Set `false` to freeze all three layers in place; `true` to resume the auto-play layers. Auto-set to `true` whenever any layer starts. Mirrors `.isAnimating`. |

**Attributes are reactive.** Change any of them after render and the element re-tunes in place — shape changes morph over `data-blob-morph-tween`, and the play/pause and intensity controls apply live. This makes `<dynamo-blob>` a natural fit for framework bindings.

## JavaScript API

```ts
const blob = document.querySelector('dynamo-blob')!;

// Unified controls
blob.pause();             // freeze wobble, morph, and drift in place
blob.play();              // resume every layer the blob is configured to auto-play
blob.play({ morph: 4000, wobble: 20000, drift: 2 });
//   a key forces that layer on and tunes it — morph/wobble in ms, drift = speed multiplier

// Granular controls
blob.playWobble(20000);   // resume the CSS wobble (optional period in ms)
blob.pauseWobble();       // freeze the wobble in place
blob.playMorph(4000);     // run the morph loop (optional per-cycle duration in ms)
blob.pauseMorph();        // stop morphing
blob.playDrift(2);        // resume drift (optional speed multiplier)
blob.pauseDrift();        // freeze drift in place

blob.generateNewBlob();   // one-shot morph to a fresh silhouette
blob.deflect();           // nudge a drifting blob in a new direction

// Live state (also mirrored to data-blob-is-* attributes)
blob.isWobbling;          // boolean
blob.isMorphing;          // boolean
blob.isDrifting;          // boolean
blob.isAnimating;         // boolean — true when any layer is playing
```

`play()` resumes the layers the blob is configured to auto-play (`data-blob-wobble-autoplay`, `data-blob-morph-autoplay`, `data-blob-drift-autoplay`). Passing a key in the options object forces that layer on regardless. Explicit play methods ignore `prefers-reduced-motion`; the declarative auto-play paths still honor it.

Every control method returns the element, so calls chain:

```js
blob.pauseWobble().playMorph().playDrift(2);
```

The pure generators are exported too, for SSR, canvas, or custom pipelines:

```ts
import {
  generateBlobPath,
  interpolateBlob,
  encodeBlobSeed,
  decodeBlobSeed,
} from 'dynamoblobs';
```

## Events

`dynamo-blob-complete` is dispatched at the end of each morph cycle.

```json
{ "duration": number }
```

## Drift & positioning

Drift translates the element within its nearest **positioned, sized** ancestor (`position: relative` with explicit dimensions). Multiple drifting blobs in one container create the layered, ambient background effect.

By default each blob starts drifting from a random spot, which scatters an ambient field nicely. For a single, centered blob, that random jump is jarring — set `data-blob-drift-start-position="current"` so it continues from where it's already laid out (no teleport), or `"center"` to begin from the container's middle.

Drift bounces off the blob's **silhouette**, not the host element's box. The boundary is a rotation-invariant radius sampled from the rendered path, so the CSS wobble (spin / skew / scale) never makes the bounce drift early or jitter. Since the silhouette fills only the middle of that box (the rest is transparent headroom for variance + wobble), the blob meets the walls cleanly with no early-bounce gap. The transparent box overhangs the container edges as it does so, so give the drift container `overflow: clip` (or `hidden`). Tune how tightly it hugs the wall with `data-blob-drift-bias` (default `0.9` lets it carry a touch past before reversing).

## Reduced motion

When `prefers-reduced-motion: reduce` is active, none of the three layers auto-play on render — the `*-autoplay` flags are suppressed. Explicit JS calls (`play()`, `playWobble()`, etc.) and explicit `data-blob-is-*` attributes are treated as intentional and run regardless — gate them yourself if you want to respect the preference.

## License

ISC
