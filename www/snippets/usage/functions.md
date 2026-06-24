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

Call **<code>play(<em>duration</em>)</code>** on any blob you'd like to continuously morph between silhouettes. The optional **<code>duration</code>** sets the length of each morph cycle — default is **7500**(ms).

<h4 id="pause">.pause()</h4>

To stop the morph loop, call **<code>pause()</code>** on the blob.

```javascript
const blob = document.querySelector('dynamo-blob');

function toggleBlobAnimation() {
  if (blob.isAnimating) {
    blob.pause();
  } else {
    blob.play(5000);
  }
}
```

<div style="display:flex;gap:1.25rem;align-items:center">
  <dynamo-blob class="fill-theme" id="play-example-blob" style="width:120px;height:120px"></dynamo-blob>
</div>

<button style="margin:1rem .5rem 0 0" onclick="play('play-example-blob', 5000)"><i data-feather="play"></i>Play</button>
<button style="margin-top:1rem" onclick="pause('play-example-blob')"><i data-feather="pause"></i>Pause</button>

<h4 id="deflect">.deflect()</h4>

For a drifting blob (see <code>data-blob-drift</code>), **<code>deflect()</code>** kicks it off in a new random direction — the same thing a click does when <code>data-blob-click</code> is set.

<div class="note"><p><strong>Need to know when a morph finishes?</strong> Listen for the <code>dynamo-blob-complete</code> event to react when a cycle ends.</p></div>

```javascript
document.querySelector('dynamo-blob')
  .addEventListener('dynamo-blob-complete', (event) => {
    console.log('Blob finished morphing', event.detail);
  });
```
