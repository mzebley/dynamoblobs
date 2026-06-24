---
slug: usage-header
title: Overview
type: docs
group: usage
order: 1
groupOrder: 2
groupLabel: Usage
---

<h2 id="usage-header">Usage</h2>

Since **Dynamoblobs** is an HTML custom element, all it takes to drop one in is to add the tag to your markup. Give it a size with CSS — the blob scales to fit its host.

```html
<!-- A blob, filled with the current color of its parent -->
<dynamo-blob style="width:120px;height:120px"></dynamo-blob>
```

<div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center;margin-bottom:1.25rem">
  <dynamo-blob class="fill-ink" style="width:120px;height:120px"></dynamo-blob>
</div>

A **dynamo-blob** inherits any **<code>class</code>**, **<code>id</code>**, or **<code>style</code>** applied to its invoking element, and the path inherits your **<code>fill</code>**.

```html
<!-- Example 1 -->
<dynamo-blob style="width:120px;height:120px;fill:slateblue"></dynamo-blob>
```

<div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center;margin-bottom:1.25rem">
  <dynamo-blob style="width:120px;height:120px;fill:slateblue"></dynamo-blob>
</div>

```html
<style>
    .fill-theme { fill: var(--theme); }
</style>

<!-- Example 2 -->
<dynamo-blob class="fill-theme" style="width:120px;height:120px"></dynamo-blob>
```

<div style="display:flex;gap:1.25rem;flex-wrap:wrap;align-items:center">
  <dynamo-blob class="fill-theme" style="width:120px;height:120px"></dynamo-blob>
  <dynamo-blob class="fill-theme fill-light" style="width:90px;height:90px"></dynamo-blob>
  <dynamo-blob class="fill-ink" style="width:70px;height:70px"></dynamo-blob>
</div>
