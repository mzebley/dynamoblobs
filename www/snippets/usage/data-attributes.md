---
slug: data-attributes
title: Data Attributes
type: docs
group: usage
order: 2
groupOrder: 2
groupLabel: Usage
---

<h3 id="data-attributes">Data Attributes</h3>

**Dynamoblobs** ship with a set of data attributes for tuning their shape and motion.

<h4 id="points-and-variance">Points and Variance</h4>

A **dynamo-blob** generates a new, randomized silhouette each time it renders. The shape is built from **<code>points</code>** — the number of vertices around the ring — and **<code>variance</code>**, how far each vertex can deviate from the base radius.

<div class="table-container" tabindex="0">
    <table aria-label="Blob point and variance attribute configuration table">
    <thead>
        <tr><th scope="col">Attribute</th><th scope="col">Default</th><th scope="col">Options</th></tr>
    </thead>
    <tbody>
        <tr><td><p style="min-width: max-content;">data-blob-points</p></td><td>10</td><td>Any integer ≥ 3</td></tr>
        <tr><td><p>data-blob-variance</p></td><td>8</td><td>Any positive number</td></tr>
    </tbody>
    </table>
</div>

```html
<dynamo-blob data-blob-points="14" data-blob-variance="14"></dynamo-blob>
```

<div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center;margin-bottom:1.25rem">
  <dynamo-blob class="fill-ink" data-blob-points="6" data-blob-variance="6" style="width:110px;height:110px"></dynamo-blob>
  <dynamo-blob class="fill-ink" data-blob-points="10" data-blob-variance="12" style="width:110px;height:110px"></dynamo-blob>
  <dynamo-blob class="fill-ink" data-blob-points="18" data-blob-variance="16" style="width:110px;height:110px"></dynamo-blob>
</div>

<h4 id="deterministic-blobs">Deterministic blobs</h4>

Every generated blob encodes its exact SVG path into ```data-blob-seed```. Copy that attribute to reproduce the same shape anywhere — the two blobs below share one seed:

```html
<dynamo-blob data-blob-seed="ENCODED_PATH_OR_ANY_STRING"></dynamo-blob>
```

<div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center">
  <dynamo-blob class="fill-theme" data-blob-seed="dynamoblobs-demo" style="width:110px;height:110px"></dynamo-blob>
  <dynamo-blob class="fill-theme" data-blob-seed="dynamoblobs-demo" style="width:110px;height:110px"></dynamo-blob>
</div>

<div class="note"><p>A seed can be the compact path string the component writes back to <code>data-blob-seed</code> (reproduces the exact path), or any arbitrary string (deterministically seeds generation).</p></div>

<h4 id="blob-wobble">Wobble</h4>

By default a blob gently **wobbles** — a continuous CSS turn, skew, and scale. Tune or disable it.

<div class="table-container" tabindex="0">
    <table aria-label="Blob wobble attribute configuration table">
    <thead>
        <tr><th scope="col">Attribute</th><th scope="col">Default</th><th scope="col">Options</th></tr>
    </thead>
    <tbody>
        <tr><td><p>data-blob-wobble</p></td><td>true</td><td>true, false</td></tr>
        <tr><td><p>data-blob-wobble-speed</p></td><td>30000</td><td>Period in milliseconds</td></tr>
        <tr><td><p>data-blob-wobble-amount</p></td><td>2</td><td>Skew intensity multiplier</td></tr>
        <tr><td><p>data-blob-wobble-paused</p></td><td>unset</td><td>Present to freeze the wobble in place</td></tr>
    </tbody>
    </table>
</div>

```html
<dynamo-blob data-blob-wobble-speed="12000" data-blob-wobble-amount="3"></dynamo-blob>
```

<div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center">
  <dynamo-blob class="fill-theme" data-blob-wobble-speed="10000" data-blob-wobble-amount="3" style="width:120px;height:120px"></dynamo-blob>
  <dynamo-blob class="fill-theme fill-light" data-blob-wobble="false" style="width:120px;height:120px"></dynamo-blob>
</div>

<p>Wobble runs on its own pair of methods too — <code>playWobble(<em>ms</em>)</code> and <code>pauseWobble()</code> — or set <code>data-blob-wobble-paused</code> at render to start it frozen but resumable.</p>

<h4 id="blob-animation">Morph Animation</h4>

Want a blob that endlessly reshapes itself? Reach for **```data-blob-animate```** and **```data-blob-speed```** — the blob continuously regenerates and morphs between silhouettes.

<div class="table-container" tabindex="0">
    <table aria-label="Blob animation attribute configuration table">
    <thead>
        <tr><th scope="col">Attribute</th><th scope="col">Default</th><th scope="col">Options</th></tr>
    </thead>
    <tbody>
        <tr><td><p>data-blob-animate</p></td><td>false</td><td>true, false</td></tr>
        <tr><td><p>data-blob-speed</p></td><td>7500</td><td>Morph duration in milliseconds</td></tr>
    </tbody>
    </table>
</div>
<div class="note"><p><strong>Accessibility Note:</strong> <strong>data-blob-animate</strong> is ignored when the viewer's browser has <strong>reduced motion</strong> enabled.</p></div>

```html
<dynamo-blob data-blob-animate="true" data-blob-speed="4000"></dynamo-blob>
```

<div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center">
  <dynamo-blob class="fill-theme" data-blob-animate="true" data-blob-speed="4000" style="width:130px;height:130px"></dynamo-blob>
</div>

<h4 id="blob-drift">Drift &amp; Click</h4>

Set **```data-blob-drift```** and the blob will bounce around its nearest **positioned, sized** ancestor. Add **```data-blob-click```** to send it off in a new direction on click. Stack a few for an ambient background.

<div class="table-container" tabindex="0">
    <table aria-label="Blob drift attribute configuration table">
    <thead>
        <tr><th scope="col">Attribute</th><th scope="col">Default</th><th scope="col">Options</th></tr>
    </thead>
    <tbody>
        <tr><td><p>data-blob-drift</p></td><td>false</td><td>true, false</td></tr>
        <tr><td><p>data-blob-drift-speed</p></td><td>1.25</td><td>Any positive number</td></tr>
        <tr><td><p>data-blob-drift-start</p></td><td>random</td><td>random, center, current</td></tr>
        <tr><td><p>data-blob-click</p></td><td>false</td><td>true, false</td></tr>
    </tbody>
    </table>
</div>

```html
<div style="position:relative;height:240px">
  <dynamo-blob data-blob-drift="true" data-blob-click="true" style="width:70px;height:70px"></dynamo-blob>
</div>
```

<div style="position:relative;height:240px;border:1px solid var(--theme);border-radius:12px;overflow:hidden;margin-top:1rem">
  <dynamo-blob class="fill-theme" data-blob-drift="true" data-blob-click="true" data-blob-drift-speed="2" style="width:64px;height:64px"></dynamo-blob>
  <dynamo-blob class="fill-theme fill-light" data-blob-drift="true" data-blob-click="true" data-blob-drift-speed="3" data-blob-points="8" style="width:90px;height:90px"></dynamo-blob>
  <dynamo-blob class="fill-ink" data-blob-drift="true" data-blob-click="true" data-blob-drift-speed="1.5" data-blob-points="14" style="width:48px;height:48px"></dynamo-blob>
</div>
<p class="note"><strong>Tip:</strong> click a blob above to deflect it.</p>

<h4 id="blob-observation">Observation</h4>

Leaning into generative design? **```data-blob-observe```** wires up an <a class="link" rel="external" target="_blank" href="https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API">IntersectionObserver</a> that regenerates the blob as it leaves the viewport.

<div class="table-container" tabindex="0">
    <table aria-label="Blob observation attribute configuration table">
    <thead>
        <tr><th scope="col">Attribute</th><th scope="col">Default</th><th scope="col">Options</th></tr>
    </thead>
    <tbody>
        <tr><td><p>data-blob-observe</p></td><td>unset</td><td>
            <ul>
            <li><strong><code>once</code></strong> Regenerate once when leaving the viewport</li>
            <li><strong><code>continuous</code></strong> Regenerate every time it leaves</li>
            <li><strong><code>once:300px</code></strong> Add a custom root margin</li>
            <li><strong><code>continuous:100px</code></strong> Combine mode with margin</li>
            </ul>
        </td></tr>
    </tbody>
    </table>
</div>

```html
<dynamo-blob data-blob-observe="continuous:100px"></dynamo-blob>
```
