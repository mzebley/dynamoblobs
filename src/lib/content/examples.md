<script lang="ts">
	import BlobNotificationDemo from '$lib/components/BlobNotificationDemo.svelte';
	import MorphingImageCropDemo from '$lib/components/MorphingImageCropDemo.svelte';
	import PracticalBlobDemos from '$lib/components/PracticalBlobDemos.svelte';
	import TransitionDemo from '$lib/components/TransitionDemo.svelte';
</script>

<h2 id="examples">Practical examples</h2>

The blob should do more than sit beside a heading. These examples give it a clear role in the composition while keeping the text, controls, and state understandable without the decoration.

<h3 id="ambient-background">Generative campaign art</h3>

Build a small visual system from a few deliberately placed blobs. Different point counts, variance, and slow morph speeds keep the cover related from one impression to the next without making the content move.

```html
<section class="campaign-cover">
  <div class="campaign-art" aria-hidden="true">
    <dynamo-blob data-blob-points="8" data-blob-variance="18"
      data-blob-morph-autoplay="true" data-blob-morph-speed="7200"></dynamo-blob>
    <dynamo-blob data-blob-points="12" data-blob-variance="14"
      data-blob-morph-autoplay="true" data-blob-morph-speed="8800"></dynamo-blob>
    <dynamo-blob data-blob-points="7" data-blob-variance="20"
      data-blob-morph-autoplay="true" data-blob-morph-speed="6500"></dynamo-blob>
  </div>
  <div class="campaign-copy">
    <p>Field notes · 04</p>
    <h2>Make room for the strange ideas.</h2>
  </div>
</section>
```

<PracticalBlobDemos demo="cover" />

<h3 id="morphing-image-crop">A crop that refuses the rectangle</h3>

Use the public path helpers to drive an SVG `clipPath`, then place an ordinary image behind it. The image remains accessible and reusable; only the crop geometry morphs. Hold the first deterministic path when the visitor prefers reduced motion.

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

<h3 id="organic-avatar">A profile mark with a pulse</h3>

A single slow blob can make an avatar or monogram feel authored without becoming the identity itself. The initials remain ordinary text above a decorative blob, so the name still does the semantic work.

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

<h3 id="notification-background">A status mark with softer edges</h3>

Use a slow blob behind a familiar status icon to give a notification a little personality. Keep the icon and copy intact, because silhouette and color are supporting cues rather than the only way the result is communicated.

```html
<aside class="notification" role="status">
  <div class="notification-mark" aria-hidden="true">
    <dynamo-blob data-blob-points="8" data-blob-variance="17"
      data-blob-morph-autoplay="true" data-blob-morph-speed="9200"></dynamo-blob>
    <svg viewBox="0 0 24 24"><path d="m6.5 12.5 3.4 3.4 7.6-8"></path></svg>
  </div>
  <div>
    <strong>Your field guide is ready.</strong>
    <span>field-guide-06.pdf · 18.4 MB</span>
  </div>
</aside>
```

<BlobNotificationDemo />

<h3 id="transition-example">A transition that earns the motion</h3>

Use a one-off morph as feedback while an interface advances. Disable the trigger during the transition, listen on the blob because the completion event does not bubble, and return focus when the next state is ready.

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
