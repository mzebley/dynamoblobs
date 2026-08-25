<script lang="ts">
	import Installation from '$lib/content/installation.md';
	import Usage from '$lib/content/usage.md';
	import Api from '$lib/content/api.md';
	import Examples from '$lib/content/examples.md';
	import DocsHeader from '$lib/components/DocsHeader.svelte';
	import DocsFooter from '$lib/components/DocsFooter.svelte';
	import DocsNav from '$lib/components/DocsNav.svelte';
	import { docsSections } from '$lib/docs';
</script>

<svelte:head>
	<title>Dynamoblobs documentation — generative SVG blob custom element</title>
	<meta name="description" content="Dynamoblobs 0.10.0 documentation: installation, 21 attributes, methods, events, TypeScript exports, and live SVG blob examples." />
	<link rel="canonical" href="https://dynamoblobs.markzebley.com/" />
	<link rel="icon" href="/favicon.svg" />
	<link rel="manifest" href="/site.webmanifest" />
	<meta property="og:title" content="Dynamoblobs" /><meta property="og:type" content="website" /><meta property="og:url" content="https://dynamoblobs.markzebley.com/" />
	<meta property="og:description" content="Documentation and live examples for dependency-free generative SVG blobs." />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<div class="site-shell"><DocsHeader /><main id="main-content" tabindex="-1"><div class="docs-layout"><DocsNav sections={docsSections} /><article class="docs-column" aria-label="Dynamoblobs documentation"><section class="docs-section prose"><Installation /></section><section class="docs-section prose"><Usage /></section><section class="docs-section prose"><Api /></section><section class="docs-section prose"><Examples /></section></article></div></main><DocsFooter /></div>
