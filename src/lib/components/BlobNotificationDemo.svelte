<script lang="ts">
	import { onMount } from 'svelte';
	import SsrDynamoBlob from './SsrDynamoBlob.svelte';

	type BlobElement = HTMLElement & { generateNewBlob(duration?: number): unknown };
	let notificationBlob = $state<BlobElement>();

	onMount(() => {
		const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotion = () => {
			notificationBlob?.setAttribute('data-blob-is-animating', String(!motionPreference.matches));
		};

		syncMotion();
		motionPreference.addEventListener('change', syncMotion);
		return () => motionPreference.removeEventListener('change', syncMotion);
	});
</script>

<div class="notification-stage">
	<article class="notification" aria-labelledby="notification-title">
		<div class="notification-mark" aria-hidden="true">
			<SsrDynamoBlob
				bind:element={notificationBlob}
				class="notification-blob"
				points={8}
				variance={17}
				data-blob-morph-autoplay="true"
				data-blob-morph-speed="9200"
				style="width:100%;height:100%"
			/>
			<svg viewBox="0 0 24 24">
				<path d="m6.5 12.5 3.4 3.4 7.6-8" />
			</svg>
		</div>
		<div class="notification-copy">
			<p class="demo-eyebrow">Export complete</p>
			<h4 id="notification-title">Your field guide is ready.</h4>
			<p>field-guide-06.pdf · 18.4 MB</p>
		</div>
		<time datetime="2026-08-24T18:42:00-05:00">Just now</time>
	</article>
</div>

<style>
	.notification-stage {
		display: grid;
		min-block-size: 18rem;
		place-items: center;
		padding: clamp(var(--zbk-spacing-105), 6vw, var(--zbk-spacing-4));
		margin-block: var(--zbk-spacing-2) var(--zbk-spacing-3);
		border: var(--zbk-border-width-sm) solid var(--zbk-brand-border-muted);
		border-radius: var(--zbk-border-radius-lg);
		background:
			radial-gradient(circle at 12% 18%, var(--zbk-accent-secondary-canvas-subtle), transparent 38%),
			var(--zbk-app-canvas-subtle);
		box-shadow: var(--zbk-elevation-sm);
		overflow: clip;
	}

	.notification {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--zbk-spacing-105);
		inline-size: min(100%, 35rem);
		padding: var(--zbk-spacing-105);
		border: var(--zbk-border-width-sm) solid var(--zbk-brand-border-muted);
		border-radius: var(--zbk-border-radius-lg);
		background: var(--zbk-app-canvas);
		box-shadow: var(--zbk-elevation-md);
	}

	.notification-mark {
		position: relative;
		display: grid;
		inline-size: 5rem;
		aspect-ratio: 1;
		place-items: center;
	}

	:global(dynamo-blob.notification-blob) {
		position: absolute;
		inset: 0;
		display: block;
		fill: var(--zbk-accent-primary-canvas-emphasis);
	}

	.notification-mark svg {
		position: relative;
		inline-size: 1.75rem;
		block-size: 1.75rem;
		fill: none;
		stroke: var(--zbk-accent-primary-ink-inverse-emphasis);
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2.4;
	}

	.notification-copy {
		display: grid;
		gap: var(--zbk-spacing-025);
		min-inline-size: 0;
	}

	.demo-eyebrow {
		margin: 0;
		color: var(--zbk-accent-primary-ink-emphasis);
		font-family: var(--zbk-font-family-alt);
		font-size: var(--zbk-font-size-xs);
		font-weight: var(--zbk-font-weight-bold);
		letter-spacing: var(--zbk-letter-spacing-wide);
		text-transform: uppercase;
	}

	h4,
	.notification-copy p:not(.demo-eyebrow),
	time {
		margin: 0;
	}

	h4 {
		color: var(--zbk-brand-ink-emphasis);
		font-family: var(--zbk-font-family-heading);
		font-size: var(--zbk-font-size-lg);
		line-height: var(--zbk-line-height-2);
	}

	.notification-copy p:not(.demo-eyebrow),
	time {
		color: var(--zbk-brand-ink);
		font-size: var(--zbk-font-size-sm);
	}

	time {
		align-self: start;
		white-space: nowrap;
	}

	@media (max-width: 36rem) {
		.notification-stage {
			padding: var(--zbk-spacing-1);
		}

		.notification {
			grid-template-columns: minmax(0, 1fr);
			align-items: start;
		}

		.notification-mark {
			inline-size: 4rem;
		}

		time {
			grid-column: 1;
		}
	}
</style>
