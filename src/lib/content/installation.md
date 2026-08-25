<span id="installation-header" aria-hidden="true"></span>

<h2 id="installation">Installation</h2>

Dynamoblobs is a dependency-free custom element. Your authored `<dynamo-blob>` stays in the document; the package adds an SVG silhouette inside it when the element upgrades.

<h3 id="npm-installation">npm</h3>

```bash
npm install dynamoblobs
```

Import once from the browser entry point:

```js
import 'dynamoblobs';
```

```html show-preview=on
<dynamo-blob
  data-blob-points="10"
  style="display:block;width:120px;height:120px;fill:rebeccapurple"
></dynamo-blob>
```

The package exports the same named runtime API to ESM and CommonJS:

```js
import { DynamoBlob, generateBlobPath, encodeBlobSeed } from 'dynamoblobs';
const { DynamoBlob: Blob } = require('dynamoblobs');
```

Importing the module is SSR-safe. It evaluates without `HTMLElement`, `document`, or `customElements`; browser registration happens only when a custom-element registry exists. DOM queries and instance methods still belong in a client lifecycle.

<h3 id="framework-installation">Frameworks</h3>

Write `<dynamo-blob>` directly in a template, then wait for its definition before calling methods:

```ts
import 'dynamoblobs';
import type { DynamoBlob } from 'dynamoblobs';

await customElements.whenDefined('dynamo-blob');
document.querySelector<DynamoBlob>('dynamo-blob')?.generateNewBlob(500);
```

For an identical first silhouette across client sessions, keep a recorded `data-blob-seed`. Without one, the element deliberately creates its initial shape on upgrade.

<h3 id="script-installation">Direct script</h3>

Direct-script consumers can keep using the UMD files:

```html
<script src="/path/to/dynamoblobs.min.js"></script>
<script>
  const path = Dynamoblobs.generateBlobPath({ points: 10, variance: 14 });
</script>
```

The UMD bundle registers `<dynamo-blob>` and exposes the helper API as `globalThis.Dynamoblobs`. The explicit `./dist/dynamoblobs.js` and `./dist/dynamoblobs.min.js` package exports remain for this use case.
