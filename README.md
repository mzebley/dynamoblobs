# Dynamoblobs

Dependency-free generative SVG blobs for HTML. `<dynamo-blob>` keeps your authored host in the document, inherits its `fill`, and can wobble, morph, or drift without a framework dependency.

[Documentation and live examples](https://dynamoblobs.markzebley.com/)

## Install

```bash
npm install dynamoblobs
```

```js
import 'dynamoblobs';
```

```html
<dynamo-blob
  data-blob-points="12"
  data-blob-variance="18"
  style="display:block;width:120px;height:120px;fill:rebeccapurple"
></dynamo-blob>
```

The package root supplies matching ESM and CommonJS named exports. CDN and direct-script consumers can load the shipped `dist/dynamoblobs.js` or `dist/dynamoblobs.min.js` files; the UMD build registers the custom element and exposes `globalThis.Dynamoblobs`.

The canonical public package is `dynamoblobs` on npm. Releases are also mirrored to GitHub Packages as `@mzebley/dynamoblobs`; GitHub consumers need the usual `@mzebley` registry mapping and package authentication.

```js
import { DynamoBlob, generateBlobPath, encodeBlobSeed } from 'dynamoblobs';
const { DynamoBlob: Blob } = require('dynamoblobs');
```

## API at a glance

- Shape: `data-blob-points`, `data-blob-variance`, `data-blob-seed`, and `data-blob-observe`.
- Motion: declarative wobble, morph, and drift autoplay/speed/intensity attributes, with reflected `.isWobbling`, `.isMorphing`, `.isDrifting`, and `.isAnimating` state.
- Controls: `play`, `pause`, `playWobble`, `pauseWobble`, `playMorph`, `pauseMorph`, `playDrift`, `pauseDrift`, `generateNewBlob`, and `deflect`; all chain.
- Interaction: `data-blob-drift-click="true"` makes the host a named, keyboard-operable deflection button. Continuous morphing resumes seamlessly after `generateNewBlob()` reaches its new points.
- Helpers: `generateBlobPath`, `generateBlobPoints`, `nextMorphShape`, `parseBlobPath`, `interpolateBlob`, `resampleClosed`, `createSeededRandom`, `encodeBlobSeed`, and `decodeBlobSeed`.
- Events: `dynamo-blob-complete` fires on the element when a morph completes.

Importing the module is SSR-safe: browser registration happens only where `customElements` exists. Automatic motion respects `prefers-reduced-motion`; imperative play calls remain explicit opt-ins.

## Development

```bash
npm test
npm run build:docs
npm run check:docs
npm run gate
npm run test:browser
```

The docs build generates the committed Zebkit CSS, accessibility input, and project runtime. Package publication contains only `dist`.

Release candidates, registry publishing, documentation enforcement, and the first-public-release bootstrap are documented in [RELEASING.md](./RELEASING.md).

## License

MIT
