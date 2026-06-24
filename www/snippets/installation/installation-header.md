---
slug: installation-header
title: Overview
type: docs
group: installation
order: 1
groupOrder: 1
groupLabel: Installation
---

<h2 id="installation-header">Installation</h2>

To keep render times functionally instant, **Dynamoblobs** intentionally skips pulling in a library such as **SVG.js** to build a new shape on execution.

Instead, it builds a randomly seeded closed **```<path>```** from criteria you set, then leverages an HTML web component (sorry, IE) to read its own attributes and swap itself in for a slick lil' blob — one that wobbles, morphs, and can even drift around its container.

You can install **Dynamoblobs** via npm, a CDN, or by including the script file directly in your project.
