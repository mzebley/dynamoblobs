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

<h4 id="motion-layers">Motion: wobble, morph &amp; drift</h4>

Every blob has three independent motion layers, and they're **always ready to go**. You don't enable them — you decide whether each one **auto-plays** on render, and you can play or pause any of them live. The attributes follow one pattern across all three:

<div class="table-container" tabindex="0">
    <table aria-label="Motion attribute naming convention table">
    <thead>
        <tr><th scope="col">Pattern</th><th scope="col">Purpose</th></tr>
    </thead>
    <tbody>
        <tr><td><p style="min-width:max-content;">data-blob-<em>&lt;layer&gt;</em>-autoplay</p></td><td>Start this layer on render (<code>true</code> / <code>false</code>).</td></tr>
        <tr><td><p style="min-width:max-content;">data-blob-is-<em>&lt;layer&gt;</em>ing</p></td><td>Set <code>false</code> to pause, <code>true</code> to play. Also reflects the live state.</td></tr>
        <tr><td><p style="min-width:max-content;">data-blob-<em>&lt;layer&gt;</em>-speed</p></td><td>How fast the layer runs.</td></tr>
        <tr><td><p style="min-width:max-content;">data-blob-<em>&lt;layer&gt;</em>-intensity</p></td><td>How strong the effect is.</td></tr>
    </tbody>
    </table>
</div>

<div class="note"><p><strong>Accessibility:</strong> the <code>*-autoplay</code> flags are suppressed when the viewer has <strong>reduced motion</strong> enabled. Explicit play (an <code>is-*</code> attribute or a JS call) is treated as intentional and runs regardless.</p></div>

<h4 id="blob-wobble">Wobble</h4>

By default a blob gently **wobbles** — a continuous CSS turn, skew, and scale. Set the speed and skew intensity, or pause it.

<div class="table-container" tabindex="0">
    <table aria-label="Blob wobble attribute configuration table">
    <thead>
        <tr><th scope="col">Attribute</th><th scope="col">Default</th><th scope="col">Options</th></tr>
    </thead>
    <tbody>
        <tr><td><p style="min-width:max-content;">data-blob-wobble-autoplay</p></td><td>true</td><td>true, false</td></tr>
        <tr><td><p>data-blob-is-wobbling</p></td><td>reflects state</td><td>true, false</td></tr>
        <tr><td><p>data-blob-wobble-speed</p></td><td>30000</td><td>Period in milliseconds</td></tr>
        <tr><td><p>data-blob-wobble-intensity</p></td><td>2</td><td>Skew intensity multiplier</td></tr>
    </tbody>
    </table>
</div>

```html
<dynamo-blob data-blob-wobble-speed="12000" data-blob-wobble-intensity="3"></dynamo-blob>
```

<div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center">
  <dynamo-blob class="fill-theme" data-blob-wobble-speed="10000" data-blob-wobble-intensity="3" style="width:120px;height:120px"></dynamo-blob>
  <dynamo-blob class="fill-theme fill-light" data-blob-wobble-autoplay="false" style="width:120px;height:120px"></dynamo-blob>
</div>

<p>The second blob sets <code>data-blob-wobble-autoplay="false"</code>, so it sits still until you start it — via <code>playWobble(<em>ms</em>)</code> or by setting <code>data-blob-is-wobbling="true"</code>.</p>

<h4 id="blob-morph">Morph</h4>

Want a blob that endlessly reshapes itself? Turn on **```data-blob-morph-autoplay```** and the blob continuously regenerates and morphs between silhouettes. **```data-blob-morph-speed```** sets the per-cycle duration; **```data-blob-morph-intensity```** sets how far each cycle reshapes it.

<div class="table-container" tabindex="0">
    <table aria-label="Blob morph attribute configuration table">
    <thead>
        <tr><th scope="col">Attribute</th><th scope="col">Default</th><th scope="col">Options</th></tr>
    </thead>
    <tbody>
        <tr><td><p style="min-width:max-content;">data-blob-morph-autoplay</p></td><td>false</td><td>true, false</td></tr>
        <tr><td><p>data-blob-is-morphing</p></td><td>reflects state</td><td>true, false</td></tr>
        <tr><td><p>data-blob-morph-speed</p></td><td>7500</td><td>Per-cycle duration in milliseconds</td></tr>
        <tr><td><p>data-blob-morph-intensity</p></td><td>1</td><td>How dramatic each reshape is</td></tr>
        <tr><td><p>data-blob-morph-tween</p></td><td>600</td><td>Tween (ms) when a shape attribute changes live; <code>0</code> snaps</td></tr>
    </tbody>
    </table>
</div>

<div class="note"><p><strong>Consistent drama:</strong> <code>morph-intensity</code> holds the amount of change constant from one cycle to the next, so the loop never lands on a near-identical shape and stalls. Higher values stay reliably bold.</p></div>

```html
<dynamo-blob data-blob-morph-autoplay="true" data-blob-morph-speed="4000"></dynamo-blob>
```

<div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center">
  <dynamo-blob class="fill-theme" data-blob-morph-autoplay="true" data-blob-morph-speed="4000" data-blob-morph-intensity="0.6" style="width:130px;height:130px"></dynamo-blob>
  <dynamo-blob class="fill-theme fill-light" data-blob-morph-autoplay="true" data-blob-morph-speed="4000" data-blob-morph-intensity="1.5" style="width:130px;height:130px"></dynamo-blob>
</div>
<p class="note">The right-hand blob uses a higher <code>data-blob-morph-intensity</code> for bigger swings.</p>

<h4 id="blob-drift">Drift</h4>

Set **```data-blob-drift-autoplay```** and the blob bounces around its nearest **positioned, sized** ancestor. Add **```data-blob-drift-click```** to send it off in a new direction on click, and **```data-blob-drift-intensity```** to tune how it reacts to the walls. Stack a few for an ambient background.

<div class="table-container" tabindex="0">
    <table aria-label="Blob drift attribute configuration table">
    <thead>
        <tr><th scope="col">Attribute</th><th scope="col">Default</th><th scope="col">Options</th></tr>
    </thead>
    <tbody>
        <tr><td><p style="min-width:max-content;">data-blob-drift-autoplay</p></td><td>false</td><td>true, false</td></tr>
        <tr><td><p>data-blob-is-drifting</p></td><td>reflects state</td><td>true, false</td></tr>
        <tr><td><p>data-blob-drift-speed</p></td><td>1.25</td><td>Any positive number</td></tr>
        <tr><td><p>data-blob-drift-intensity</p></td><td>1</td><td>Bounce restitution: 1 elastic, &lt;1 damps, &gt;1 energizes</td></tr>
        <tr><td><p>data-blob-drift-click</p></td><td>false</td><td>true, false</td></tr>
        <tr><td><p style="min-width:max-content;">data-blob-drift-start-position</p></td><td>random</td><td>random, center, current</td></tr>
    </tbody>
    </table>
</div>

```html
<div style="position:relative;height:240px;overflow:clip">
  <dynamo-blob data-blob-drift-autoplay="true" data-blob-drift-click="true" style="width:70px;height:70px"></dynamo-blob>
</div>
```

<div style="position:relative;height:240px;border:1px solid var(--theme);border-radius:12px;overflow:hidden;margin-top:1rem">
  <dynamo-blob class="fill-theme" data-blob-drift-autoplay="true" data-blob-drift-click="true" data-blob-drift-speed="2" style="width:64px;height:64px"></dynamo-blob>
  <dynamo-blob class="fill-theme fill-light" data-blob-drift-autoplay="true" data-blob-drift-click="true" data-blob-drift-speed="3" data-blob-points="8" style="width:90px;height:90px"></dynamo-blob>
  <dynamo-blob class="fill-ink" data-blob-drift-autoplay="true" data-blob-drift-click="true" data-blob-drift-speed="1.5" data-blob-points="14" style="width:48px;height:48px"></dynamo-blob>
</div>
<p class="note"><strong>Tip:</strong> click a blob above to deflect it.</p>

<h4 id="blob-master">Pause everything</h4>

**```data-blob-is-animating```** is the master switch. Set it to <code>false</code> to freeze all three layers in place; set it to <code>true</code> to resume the ones configured to auto-play. It also reflects the live state — <code>true</code> whenever any layer is playing — and is exposed as <code>.isAnimating</code>.

<div class="table-container" tabindex="0">
    <table aria-label="Blob master animation attribute configuration table">
    <thead>
        <tr><th scope="col">Attribute</th><th scope="col">Default</th><th scope="col">Options</th></tr>
    </thead>
    <tbody>
        <tr><td><p style="min-width:max-content;">data-blob-is-animating</p></td><td>reflects state</td><td>true, false</td></tr>
    </tbody>
    </table>
</div>

```html
<dynamo-blob data-blob-is-animating="false"></dynamo-blob>
```

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
