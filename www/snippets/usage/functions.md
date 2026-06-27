---
slug: usage-functions
title: Functions
type: docs
group: usage
order: 3
groupOrder: 2
groupLabel: Usage
---

<h3 id="available-functions">Available Functions</h3>

**Dynamoblobs** expose a small runtime API for controlling a blob after it has rendered.

<h4 id="generate-new-blob">.generateNewBlob()</h4>

Want a fresh shape? Call **<code>generateNewBlob(<em>duration</em>)</code>** on the blob you'd like to regenerate. The optional **<code>duration</code>** controls how quickly the old silhouette morphs into the new one — default is **800**(ms).

```javascript
const blob = document.querySelector('dynamo-blob');
blob.generateNewBlob(500);
```

<div style="display:flex;gap:1.25rem;align-items:center">
  <dynamo-blob class="fill-theme" id="regen-example-blob" style="width:120px;height:120px"></dynamo-blob>
</div>

<button style="margin:1rem 0 2rem" onclick="regenBlob('regen-example-blob', 500)"><i data-feather="refresh-cw"></i>New Blob</button>

<h4 id="play">.play()</h4>

**<code>play()</code>** resumes every animation the blob is configured to run — the ambient wobble (on by default), the morph loop (when <code>data-blob-animate</code> is set), and drift (when <code>data-blob-drift</code> is set).

Pass an options object to **force** an animation on and tune its timing. Morph and wobble durations are in **milliseconds**; drift takes a **speed multiplier**.

```javascript
const blob = document.querySelector('dynamo-blob');

blob.play();                                          // resume what's enabled
blob.play({ morph: 4000 });                           // force morphing on at 4s cycles
blob.play({ morph: 4000, wobble: 20000, drift: 2 });  // force + tune all three
```

<h4 id="pause">.pause()</h4>

**<code>pause()</code>** freezes the wobble, the morph loop, and drift in place.

<div style="display:flex;gap:1.25rem;align-items:center">
  <dynamo-blob class="fill-theme" id="play-example-blob" style="width:120px;height:120px"></dynamo-blob>
</div>

<button style="margin:1rem .5rem 0 0" onclick="play('play-example-blob', 5000)"><i data-feather="play"></i>Play</button>
<button style="margin-top:1rem" onclick="pause('play-example-blob')"><i data-feather="pause"></i>Pause</button>

<h4 id="granular-controls">Granular controls</h4>

Prefer to drive one layer at a time? Each animation has its own play/pause pair. Durations are in milliseconds; drift takes a speed multiplier.

```javascript
blob.playWobble(20000);  blob.pauseWobble();  // ambient CSS wobble
blob.playMorph(4000);    blob.pauseMorph();   // morph loop
blob.playDrift(2);       blob.pauseDrift();   // drift

// Toggle just the morph loop off its own state flag:
blob.isAnimating ? blob.pauseMorph() : blob.playMorph(5000);
```

<div class="note"><p><strong>Reduced motion:</strong> explicit <code>play*()</code> calls run regardless of <code>prefers-reduced-motion</code> — only the declarative auto-play attributes honor it.</p></div>

<h4 id="deflect">.deflect()</h4>

For a drifting blob (see <code>data-blob-drift</code>), **<code>deflect()</code>** kicks it off in a new random direction — the same thing a click does when <code>data-blob-click</code> is set.

<div class="note"><p><strong>Need to know when a morph finishes?</strong> Listen for the <code>dynamo-blob-complete</code> event to react when a cycle ends.</p></div>

```javascript
document.querySelector('dynamo-blob')
  .addEventListener('dynamo-blob-complete', (event) => {
    console.log('Blob finished morphing', event.detail);
  });
```
