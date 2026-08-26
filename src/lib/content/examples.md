<script lang="ts">
	import BlobNotificationDemo from '$lib/components/BlobNotificationDemo.svelte';
	import MorphingImageCropDemo from '$lib/components/MorphingImageCropDemo.svelte';
	import PracticalBlobDemos from '$lib/components/PracticalBlobDemos.svelte';
	import TransitionDemo from '$lib/components/TransitionDemo.svelte';
</script>

<h2 id="examples">Practical examples</h2>

Blobs can do all kinds of things more than just sitting around looking squishy. Especially when you throw <code>clipPath</code> into the mix. First though, blobs that make a living just sitting around.

<h3 id="ambient-background">Keep an attention grabber fresh</h3>

Build a small visual system where blobs can live without obscuring relevant content. Different point counts, variance, and slow morph/wobble speeds keep the effect looking curated without every becoming stale.

```html
<section class="campaign-cover">
  <div class="campaign-art" aria-hidden="true">
    <dynamo-blob data-blob-points="8" data-blob-variance="8"
      data-blob-morph-autoplay="true" data-blob-morph-speed="11000" data-blob-wobble-autoplay="false"></dynamo-blob>
    <dynamo-blob data-blob-points="12" data-blob-variance="14"
      data-blob-morph-autoplay="true" data-blob-morph-speed="28000" data-blob-wobble-speed="90000"></dynamo-blob>
    <dynamo-blob data-blob-points="8" data-blob-variance="20"
      data-blob-morph-autoplay="true" data-blob-wobble-speed="80000" data-blob-morph-speed="16500"></dynamo-blob>
  </div>
  <div class="campaign-copy">
    <p>Field notes · 04</p>
    <h2>Make space for some squishies.</h2>
  </div>
</section>
```

<PracticalBlobDemos demo="cover" />

<h3 id="morphing-image-crop">Blob-shaped images!</h3>

Use the public path helpers to drive an SVG `clipPath`, then place any image behind it. The image remains accessible and reusable; only the crop geometry morphs. Hold the first deterministic path when the visitor prefers reduced motion.

```js
import {
  createSeededRandom, generateBlobPath, interpolateBlob,
  nextMorphShape, parseBlobPath,
} from 'dynamoblobs';

const random = createSeededRandom('studio-crop');
let currentPath = generateBlobPath({ points: 9, variance: 17, random });

function drawMorph(progress, targetPath) {
  const from = parseBlobPath(currentPath);
  const target = parseBlobPath(targetPath);
  clipPath.setAttribute('d', interpolateBlob(from, target, progress));
}

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const targetPath = nextMorphShape(currentPath, {
    variance: 17,
    intensity: 0.48,
    random,
  });
  // Call drawMorph() from requestAnimationFrame with an eased 0–1 progress.
}
```

```html
<svg viewBox="0 0 100 100" role="img" aria-labelledby="studio-title">
  <title id="studio-title">A ceramic artist's sunlit studio</title>
  <defs>
    <clipPath id="studio-crop"><path id="clip-path"></path></clipPath>
  </defs>
  <image href="studio.jpg" width="100" height="100"
    preserveAspectRatio="xMidYMid slice" clip-path="url(#studio-crop)"></image>
</svg>
```

<MorphingImageCropDemo />

<h3 id="organic-avatar">Organic-shaped avatars</h3>

A single, slowly morphing blob can pretty easily become the background for all sorts of things. Things like this avatar, where the initials remain ordinary text above a decorative blob which insures proper accesibility for screen readers.

```html
<article class="maker-profile">
  <div class="maker-avatar" aria-hidden="true">
    <dynamo-blob data-blob-points="9" data-blob-variance="16"
      data-blob-morph-autoplay="true" data-blob-morph-speed="11000"></dynamo-blob>
    <span>NA</span>
  </div>
  <div>
    <p>Featured maker</p>
    <h2>Nia Alvarez</h2>
    <p>Turns discarded clay into quiet, useful objects.</p>
  </div>
</article>
```

<PracticalBlobDemos demo="profile" />

<h3 id="transition-example">Interactive animation made easy</h3>

Use a one-off morph to visualize feedback as an interface advances. Disable the trigger during the transition and return focus when the next state is ready.

```js
const blob = document.querySelector('#process-blob');
const nextButton = document.querySelector('#next-step');

nextButton.addEventListener('click', () => {
  nextButton.disabled = true;

  blob.addEventListener('dynamo-blob-complete', () => {
    nextButton.disabled = false;
    nextButton.focus();
  }, { once: true });

  blob.generateNewBlob(560);
});
```

<TransitionDemo />
