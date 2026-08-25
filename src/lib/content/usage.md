<script lang="ts">
	import BlobControlsDemo from '$lib/components/BlobControlsDemo.svelte';
</script>

<span id="usage-header" aria-hidden="true"></span>

<h2 id="usage">Usage</h2>

The host controls layout. Give it an explicit or layout-derived size; the internal SVG scales into that box and inherits the host's `fill`.

```html show-preview=on
<dynamo-blob style="display:block;width:120px;height:120px;fill:slateblue"></dynamo-blob>
```

Classes, IDs, inline styles, and data attributes all remain on `<dynamo-blob>`. This is deliberately not a generated-SVG selector contract: style the host.

<h3 id="shape-and-motion">Shape, deterministic snapshots, and motion</h3>

`data-blob-points` changes the silhouette's vertices and `data-blob-variance` controls how far they move from the base radius. Supply either a readable `data-blob-seed` or a previously encoded path for a reproducible silhouette. A readable seed remains authored so later generations stay deterministic; when no seed is supplied, the element records the generated path as an encoded snapshot.

```html show-preview=on
<dynamo-blob
  data-blob-points="12"
  data-blob-variance="18"
  data-blob-seed="docs-hero-v1"
  data-blob-morph-autoplay="true"
  style="display:block;width:140px;height:140px;fill:slateblue"
></dynamo-blob>
```

Use the declarative `*-autoplay` attributes for ambient motion. They respect reduced-motion preferences. Explicit `play*()` calls are intentional user actions and run even when reduced motion is requested.

<h3 id="motion-layers">Live controls</h3>

The controls exercise regeneration, wobble, morphing, drift, and deflection. Wobble starts pressed because it is the default ambient motion layer; each motion button controls its layer independently. The controls wait for the custom element to register, expose disabled loading states, and announce every result.

<BlobControlsDemo />

<h3 id="updating-attributes">Updating a connected blob</h3>

Every documented configuration or reflected state attribute is observed. Change a value after upgrade without replacing the host:

```js
await customElements.whenDefined('dynamo-blob');
const blob = document.querySelector('dynamo-blob');

blob.dataset.blobPoints = '14';
blob.dataset.blobMorphAutoplay = 'true';
blob.dataset.blobDriftClick = 'true';
```

Geometry changes retarget the visible SVG in place; motion settings are reconfigured without replacing the host. A drifting blob needs a positioned parent with practical dimensions. `data-blob-drift-click="true"` exposes the host as a focusable, named button that deflects on pointer click, <kbd>Enter</kbd>, or <kbd>Space</kbd>. Add an `aria-label` when the default “Deflect blob” label is not specific enough.
