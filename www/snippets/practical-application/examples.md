---
slug: examples
title: Examples
type: docs
group: practical-application
order: 1
groupOrder: 3
groupLabel: "Practical Application"
---

<h2 id="practicalApplicationHeader">Practical Application</h2>

**Dynamoblobs** are entirely style-agnostic out of the box. The onus is on you to size and color them for your platform — but that also means nearly endless room for customization.

<h3 id="layered-background">Ambient layered background</h3>

A few drifting blobs at low opacity make a living, generative backdrop — the same trick behind a hero section. Stack them in a positioned, clipped container.

```html
<div class="hero" style="position:relative;overflow:clip">
  <dynamo-blob data-blob-drift-autoplay="true" style="width:160px;height:160px;opacity:.5"></dynamo-blob>
  <dynamo-blob data-blob-drift-autoplay="true" style="width:110px;height:110px;opacity:.5"></dynamo-blob>
  <dynamo-blob data-blob-drift-autoplay="true" style="width:80px;height:80px;opacity:.5"></dynamo-blob>
  <h2>Generative by default</h2>
</div>
```

<div style="position:relative;height:280px;border-radius:14px;overflow:hidden;background:var(--zbk-app-canvas-muted, #1c1c22);display:grid;place-items:center">
  <dynamo-blob class="fill-theme" data-blob-drift-autoplay="true" data-blob-drift-speed="1" data-blob-points="16" style="width:160px;height:160px;opacity:.45"></dynamo-blob>
  <dynamo-blob class="fill-theme fill-light" data-blob-drift-autoplay="true" data-blob-drift-speed="1.5" data-blob-points="10" style="width:110px;height:110px;opacity:.5"></dynamo-blob>
  <dynamo-blob class="fill-ink" data-blob-drift-autoplay="true" data-blob-drift-speed="0.75" data-blob-points="18" style="width:80px;height:80px;opacity:.4"></dynamo-blob>
  <h2 id="generative-by-default" style="position:relative;margin:0;color:var(--theme);font-family:'Merriweather',serif">Generative by default</h2>
</div>

<h3 id="avatar-mask">Organic avatar accent</h3>

Pair a static blob with content for a soft, hand-drawn frame that's never quite the same twice.

```html
<div style="display:flex;align-items:center;gap:1rem">
  <dynamo-blob data-blob-morph-autoplay="true" data-blob-morph-speed="9000"
    style="width:96px;height:96px;fill:var(--theme)"></dynamo-blob>
  <div>
    <h3>Eye-catching headline.</h3>
    <p>Further information to draw interest.</p>
  </div>
</div>
```

<div class="widget" id="widget_example_3" style="min-height:max-content;display:flex;align-items:center;gap:1.25rem;padding:1rem">
  <dynamo-blob class="fill-theme" data-blob-morph-autoplay="true" data-blob-morph-speed="9000" style="width:96px;height:96px;flex:none"></dynamo-blob>
  <div class="content" style="align-self:center">
    <h2 id="eye-catching-headline" style="font-family:'Merriweather',serif;color:var(--theme);margin:0">Eye-catching headline.</h2>
    <p style="margin:.25rem 0 0">Further information to draw interest.</p>
  </div>
</div>

<h3 id="transition-flair">Transition flair</h3>

Trigger a morph on interaction to add some pizzazz to state changes.

<div class="widget" id="widget_example_2" style="padding:1.5rem;text-align:center">
  <dynamo-blob class="fill-theme fill-light" id="transition-blob-example" style="width:120px;height:120px"></dynamo-blob>
  <div class="content">
    <button style="margin-top:1rem" id="transition-blob-button" onclick="transition()">
      <span>Shuffle</span>
      <i data-feather="chevrons-right"></i>
    </button>
  </div>
</div>
