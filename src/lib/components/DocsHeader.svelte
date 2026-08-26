<script lang="ts">
	import AmbientBlobField from './AmbientBlobField.svelte';
	import BlobWordmark from './BlobWordmark.svelte';
	import FontSizeStepper from './FontSizeStepper.svelte';
	import MarkSignature from './MarkSignature.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
</script>

<div class="intro-viewport">
	<AmbientBlobField />
	<header class="site-header width-full display-flex padding-inline-105 tablet:padding-inline-4 padding-block-105">
		<div class="display-flex width-full align-items-center gap-1 flex-direction-column">
			<div class="header-actions display-flex width-full gap-1 max-width-widescreen">
				<span class="display-flex width-full">
					<span class="signature-mark"><MarkSignature class="width-2 height-2" /></span>
				</span>
				<FontSizeStepper />
				<span class="display-flex width-full justify-content-end"><ThemeToggle /></span>
			</div>
			<div class="brand-lockup width-full padding-block-start-105 max-width-30">
				<h1 id="heading" class="visually-hidden">Dynamoblobs</h1>
				<BlobWordmark />
				<p class="prose font-lg text-center ink-brand margin-block-start-1">A dependency-free <strong class="ink-accent-primary-emphasis">HTML custom element</strong> for <strong class="ink-accent-primary-emphasis">generative SVG blobs</strong> that wobble, morph, and drift.</p>
				<p class="prose font-md text-center ink-brand margin-block-1"><em>Version 0.10.0 · 23.0 KB minified · 6.3 KB gzip.</em></p>
			</div>
		</div>
	</header>
</div>

<style>
	.intro-viewport {
		--intro-surface-break: clamp(28rem, 54svh, 36rem);
		position: relative;
		isolation: isolate;
		min-block-size: max(var(--zbk-spacing-mobile), 40svh);
		/* background: linear-gradient(
			to bottom,
			var(--zbk-brand-canvas-inverse-emphasis) 0 var(--intro-surface-break),
			var(--zbk-app-canvas) var(--intro-surface-break) 100%
		); */
		overflow-x: clip;
		overflow-y: visible;
	}

	.site-header {
		position: relative;
		z-index: 1;
		min-block-size: var(--intro-surface-break);
		background: transparent;
	}

	.header-actions { align-items: center; }
	.signature-mark { display: flex; align-items: center; justify-content: center; }
	.signature-mark :global(svg) { inline-size: var(--zbk-spacing-2); block-size: var(--zbk-spacing-2); }
	:global(html[data-zbk-theme='dark']) .signature-mark { --sig-ink: var(--zbk-brand-700); --sig-ink-action: var(--zbk-color-deepcurrent-500); --sig-ink-action-active: var(--zbk-color-blue-800); }

	@media (max-width: 44rem) {
		.intro-viewport {
			--intro-surface-break: clamp(30rem, 58svh, 34rem);
			min-block-size: max(var(--zbk-spacing-card), 50svh);
		}
	}
</style>
