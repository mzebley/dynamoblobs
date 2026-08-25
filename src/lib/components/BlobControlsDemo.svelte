<script lang="ts">
	import { onMount } from 'svelte';
	import SsrDynamoBlob from './SsrDynamoBlob.svelte';
	type BlobControl = HTMLElement & {
		generateNewBlob(duration?: number): unknown;
		playWobble(duration?: number): unknown;
		pauseWobble(): unknown;
		playMorph(duration?: number): unknown;
		pauseMorph(): unknown;
		playDrift(speed?: number): unknown;
		pauseDrift(): unknown;
		deflect(): unknown;
		isWobbling: boolean;
		isMorphing: boolean;
		isDrifting: boolean;
	};
	let { compact = false }: { compact?: boolean } = $props();
	let blob = $state<BlobControl>();
	let ready = $state(false);
	let reducedMotion = $state(false);
	let regenerating = $state(false);
	let wobbling = $state(false);
	let morphing = $state(false);
	let drifting = $state(false);
	let status = $state('Preparing the live blob controls.');

	function syncMotionState() {
		wobbling = blob?.isWobbling ?? false;
		morphing = blob?.isMorphing ?? false;
		drifting = blob?.isDrifting ?? false;
	}

	async function regenerate() {
		if (!blob || regenerating) return;
		regenerating = true;
		const duration = reducedMotion ? 1 : compact ? 800 : 500;
		status = 'Generating a new blob.';
		await new Promise<void>((resolve) => {
			const fallback = window.setTimeout(resolve, duration + 150);
			blob?.addEventListener('dynamo-blob-complete', () => { clearTimeout(fallback); resolve(); }, { once: true });
			blob?.generateNewBlob(duration);
		});
		status = 'Generated a new deterministic blob silhouette.';
		regenerating = false;
	}

	function wobble() {
		if (!blob) return;
		if (blob.isWobbling) {
			blob.pauseWobble();
			status = 'Wobble paused.';
		} else if (reducedMotion) {
			blob.generateNewBlob(1);
			status = 'Reduced motion is enabled, so the blob changed without continuous wobbling.';
		} else {
			blob.playWobble();
			status = 'Wobble started.';
		}
		syncMotionState();
	}

	function morph() {
		if (!blob) return;
		if (blob.isMorphing) {
			blob.pauseMorph();
			status = 'Morphing paused.';
		} else if (reducedMotion) {
			blob.generateNewBlob(1);
			status = 'Reduced motion is enabled, so the blob changed without continuous morphing.';
		} else {
			blob.playMorph(3600);
			status = 'Morphing started.';
		}
		syncMotionState();
	}

	function drift() {
		if (!blob) return;
		if (blob.isDrifting) {
			blob.pauseDrift();
			status = 'Drift paused.';
		} else if (reducedMotion) {
			blob.generateNewBlob(1);
			status = 'Reduced motion is enabled, so the blob changed without continuous drifting.';
		} else {
			blob.playDrift(1);
			status = 'Drift started.';
		}
		syncMotionState();
	}

	function deflect() { blob?.deflect(); status = 'Blob deflected.'; }

	onMount(() => {
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = query.matches;
		void customElements.whenDefined('dynamo-blob').then(() => {
			syncMotionState();
			ready = true;
			status = 'Live blob controls are ready.';
		});
		const change = (event: MediaQueryListEvent) => {
			reducedMotion = event.matches;
			if (reducedMotion && (blob?.isWobbling || blob?.isMorphing || blob?.isDrifting)) {
				blob.pauseWobble();
				blob.pauseMorph();
				blob.pauseDrift();
				syncMotionState();
				status = 'Continuous motion paused because reduced motion was enabled.';
			}
		};
		query.addEventListener('change', change);
		return () => { query.removeEventListener('change', change); blob?.pauseWobble(); blob?.pauseMorph(); blob?.pauseDrift(); };
	});
</script>

<div class:compact class="blob-controls-demo" aria-label="Interactive blob controls">
	<div class="blob-stage"><SsrDynamoBlob bind:element={blob} class="demo-blob" points={12} variance={18} data-blob-drift-start-position="center" style={compact ? 'width:clamp(7rem,18vw,11rem);height:clamp(7rem,18vw,11rem)' : 'width:9rem;height:9rem'} /></div>
	<div class="demo-controls" role="group" aria-label={compact ? 'Header blob controls' : 'Blob controls'}>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<zbk-button data-blob-regenerate variant="wave-action wave-pop lg" loading={regenerating ? true : undefined} disabled={!ready ? true : undefined} onclick={regenerate}>
			<span slot="icon" data-position="start" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg></span>
			{compact ? 'Regen Header' : 'New Blob'}
		</zbk-button>
		{#if !compact}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<zbk-button variant="wave-action wave-pop lg" aria-pressed={wobbling} disabled={!ready ? true : undefined} onclick={wobble}>{wobbling ? 'Pause wobble' : 'Play wobble'}</zbk-button>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<zbk-button variant="wave-action wave-pop lg" aria-pressed={morphing} disabled={!ready ? true : undefined} onclick={morph}>{morphing ? 'Pause morph' : 'Play morph'}</zbk-button>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<zbk-button variant="wave-action wave-pop lg" aria-pressed={drifting} disabled={!ready ? true : undefined} onclick={drift}>{drifting ? 'Pause drift' : 'Play drift'}</zbk-button>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<zbk-button variant="wave-action wave-pop lg" disabled={!ready ? true : undefined} onclick={deflect}>Deflect</zbk-button>
		{/if}
	</div>
	<p class="demo-status visually-hidden" role="status" aria-live="polite">{status}</p>
</div>

<style>
	.blob-controls-demo { inline-size: 100%; margin-block: var(--zbk-spacing-105) var(--zbk-spacing-2); }
	.blob-stage { position: relative; display: grid; place-items: center; min-block-size: var(--zbk-spacing-15); overflow: clip; background: var(--zbk-app-canvas-subtle); }
	:global(dynamo-blob.demo-blob) { display: block; fill: var(--zbk-accent-primary-canvas); }
	.demo-controls { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--zbk-spacing-105); padding-block-start: var(--zbk-spacing-1); }
	.demo-controls svg { inline-size: 1em; block-size: 1em; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2; }
	.compact { margin: 0; }
	.compact .blob-stage { min-block-size: clamp(3rem, 8vw, 5.5rem); background: var(--zbk-app-canvas); }
	.compact :global(dynamo-blob.demo-blob) { fill: var(--zbk-brand-canvas-emphasis); transform: translateY(35%); }
	.compact .demo-controls { padding-block: var(--zbk-spacing-2); background: var(--zbk-app-canvas); }
</style>
