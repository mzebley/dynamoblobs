# Dynamoblobs

Lightweight, dependency-free generative SVG blobs that generate a fresh silhouette every time they render. Each blob is a standard [custom element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) (`<dynamo-blob>`) that swaps itself into the DOM, inherits your `fill`, and can wobble, morph, and drift on demand.

[Documentation + live examples](https://dynamoblobs.markzebley.com)

## Features
- **Drop-in custom element** – place `<dynamo-blob>` anywhere; classes, styles, and IDs flow through, and the path inherits your `fill`.
- **Deterministic or generative** – seed a blob for a reproducible shape, or let it randomize and regenerate via Intersection Observer triggers.
- **Three layers of motion** – an always-on CSS wobble (turn / skew / scale), an optional JS morph loop that interpolates between silhouettes, and an optional "DVD"-style drift with click-to-deflect.
- **Runtime controls** – unified `play`/`pause` plus granular `playWobble`/`pauseWobble`, `playMorph`/`pauseMorph`, `playDrift`/`pauseDrift`, alongside `generateNewBlob`, `deflect`, a `dynamo-blob-complete` event, and TypeScript definitions.
- **Animation aware** – honors `prefers-reduced-motion` and tears down loops/observers when the element leaves the DOM.

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

| Attribute | Default | Description |
| --- | --- | --- |
| `data-blob-points` | `10` | Vertex count — higher is busier. Minimum 3. |
| `data-blob-variance` | `8` | Radius deviation — higher is lumpier. |
| `data-blob-seed` | _unset_ | A base64 path reproduces an exact shape; any other string deterministically seeds generation. |
| `data-blob-morph` | `600` | Tween duration (ms) when a shape attribute changes live. `0` snaps. |
| `data-blob-animate` | `false` | Auto-run the morph loop on render (skipped under reduced motion). |
| `data-blob-speed` | `7500` | Morph-loop duration in milliseconds. |
| `data-blob-observe` | _unset_ | Regenerate as the element enters/leaves the viewport: `once:0px` or `continuous:64px`. |
| `data-blob-wobble` | `true` | Ambient CSS wobble (turn / skew / scale). Set `false` to disable. |
| `data-blob-wobble-speed` | `30000` | Wobble period in milliseconds. |
| `data-blob-wobble-amount` | `2` | Wobble skew intensity multiplier. |
| `data-blob-wobble-paused` | _unset_ | Freeze the wobble in place. Set at render to start wobble stopped (still resumable via `playWobble()`). |
| `data-blob-drift` | `false` | Drift around the nearest positioned ancestor, bouncing off the walls. |
| `data-blob-drift-speed` | `1.25` | Drift velocity. |
| `data-blob-drift-start` | `random` | Where drift begins: `random` (scattered), `center`, or `current` (continues from the element's laid-out position — no teleport). |
| `data-blob-click` | `false` | Deflect to a new direction on click (requires drift). |
| `data-blob-paused` | _unset_ | When present, freezes wobble, drift, and the morph loop in place. Remove to resume. |

**Attributes are reactive.** Change any of them after render and the element re-tunes in place — shape changes morph over `data-blob-morph`, and motion toggles (drift, animate, paused) apply live. This makes `<dynamo-blob>` a natural fit for framework bindings.

## JavaScript API

```ts
const blob = document.querySelector('dynamo-blob')!;

// Unified controls
blob.pause();             // freeze wobble, morph, and drift in place
blob.play();              // resume every animation the blob is configured to run
blob.play({ morph: 4000, wobble: 20000, drift: 2 });
//   a key forces that animation on and tunes it — morph/wobble in ms, drift = speed multiplier

// Granular controls
blob.playWobble(20000);   // resume the CSS wobble (optional period in ms)
blob.pauseWobble();       // freeze the wobble in place
blob.playMorph(4000);     // run the morph loop (optional per-cycle duration in ms)
blob.pauseMorph();        // stop morphing
blob.playDrift(2);        // resume drift (optional speed multiplier)
blob.pauseDrift();        // freeze drift in place

blob.generateNewBlob();   // one-shot morph to a fresh silhouette
blob.deflect();           // nudge a drifting blob in a new direction
```

`play()` resumes only the animations the blob is configured for (wobble unless `data-blob-wobble="false"`, morph when `data-blob-animate="true"`, drift when `data-blob-drift` is set). Passing a key in the options object forces that animation on regardless. Explicit play methods ignore `prefers-reduced-motion`; the declarative auto-play paths still honor it.

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

By default each blob starts drifting from a random spot, which scatters an ambient field nicely. For a single, centered blob, that random jump is jarring — set `data-blob-drift-start="current"` so it continues from where it's already laid out (no teleport), or `"center"` to begin from the container's middle.

## Reduced motion

When `prefers-reduced-motion: reduce` is active, the wobble, the morph loop, and drift all stay still, and `data-blob-animate`/`data-blob-drift` will not auto-play. Explicit JS calls (`play()`, `playWobble()`, etc.) are treated as intentional and run regardless — gate them yourself if you want to respect the preference.

## License

ISC
