<script lang="ts">
	import { onMount } from 'svelte';
	import { generateBlobAndWait } from '../blobCompletion.js';
	import SsrDynamoBlob from './SsrDynamoBlob.svelte';
	const lifetime = new AbortController();

	type Blob = HTMLElement & { generateNewBlob(duration?: number): unknown };
	const steps = [
		{
			label: 'Collect',
			title: 'Find the signal',
			description: 'Gather the references, fragments, and half-formed ideas worth carrying forward.',
		},
		{
			label: 'Shape',
			title: 'Give it a point of view',
			description: 'Turn the useful pieces into a direction with enough character to be remembered.',
		},
		{
			label: 'Release',
			title: 'Put it in the world',
			description: 'Ship the smallest complete version, watch what happens, and let the next shape emerge.',
		},
	];

	let blob = $state<Blob>();
	let button = $state<HTMLElement & { focus(): void }>();
	let activeIndex = $state(0);
	let busy = $state(false);
	let reducedMotion = $state(false);
	let status = $derived(
		`${steps[activeIndex].label}: ${steps[activeIndex].title}. Step ${activeIndex + 1} of ${steps.length}.`,
	);

	async function next() {
		if (busy) return;
		busy = true;
		activeIndex = activeIndex >= steps.length - 1 ? 0 : activeIndex + 1;
		const duration = reducedMotion ? 1 : 560;

		if (blob) await generateBlobAndWait(blob, duration, lifetime.signal);
		if (lifetime.signal.aborted) return;

		busy = false;
		button?.focus();
	}

	onMount(() => {
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		reducedMotion = query.matches;
		const change = (event: MediaQueryListEvent) => (reducedMotion = event.matches);
		query.addEventListener('change', change);
		return () => {
			lifetime.abort();
			query.removeEventListener('change', change);
		};
	});
</script>

<section class="transition-demo" data-step={activeIndex} aria-label="Three-step creative process">
	<div class="transition-visual" aria-hidden="true">
		<span class="step-number">0{activeIndex + 1}</span>
		<SsrDynamoBlob
			bind:element={blob}
			class="transition-blob"
			points={9}
			variance={18}
			data-blob-wobble-speed="26000"
			style="width:min(22rem,76vw);height:min(22rem,76vw)"
		/>
	</div>

	<div class="transition-content">
		<div class="transition-window">
			<div class="transition-track" style={`--active-slide: ${activeIndex}`}>
				{#each steps as step, index}
					<div class="transition-slide" inert={index !== activeIndex} aria-hidden={index !== activeIndex}>
						<p>{step.label}</p>
						<h4>{step.title}</h4>
						<span>{step.description}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="transition-footer">
			<ol aria-label={`Step ${activeIndex + 1} of ${steps.length}`}>
				{#each steps as _, index}
					<li class:active={index === activeIndex}><span class="visually-hidden">Step {index + 1}</span></li>
				{/each}
			</ol>
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<zbk-button bind:this={button} data-transition-next variant="wave-action wave-pop lg" loading={busy ? true : undefined} onclick={next}>
				<span style="min-width:max-content;display:flex">{activeIndex === steps.length - 1 ? 'Start again' : 'Next step'}</span>
				<span slot="icon" data-position="end" aria-hidden="true">
					<svg viewBox="0 0 24 24"><path d={activeIndex === steps.length - 1 ? 'M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6' : 'M9 18l6-6-6-6'} /></svg>
				</span>
			</zbk-button>
		</div>
	</div>
	<p class="visually-hidden" role="status" aria-live="polite">{status}</p>
</section>

<style>
	.transition-demo {
		display: grid;
		grid-template-columns: minmax(15rem, 0.9fr) minmax(0, 1.1fr);
		min-block-size: 25rem;
		margin-block: var(--zbk-spacing-2) var(--zbk-spacing-3);
		overflow: clip;
		border: var(--zbk-border-width-sm) solid var(--zbk-app-border);
		border-radius: var(--zbk-border-radius-lg);
		background: var(--zbk-app-canvas-subtle);
		box-shadow: var(--zbk-elevation-sm);
	}

	.transition-visual {
		position: relative;
		display: grid;
		min-block-size: 25rem;
		overflow: clip;
		place-items: center;
		background: var(--zbk-accent-primary-canvas-muted);
		transition: background-color var(--zbk-transition-duration-slow) ease;
	}

	.transition-demo[data-step='1'] .transition-visual {
		background: var(--zbk-accent-secondary-canvas-muted);
	}

	.transition-demo[data-step='2'] .transition-visual {
		background: var(--zbk-brand-canvas-muted);
	}

	.step-number {
		position: absolute;
		z-index: 2;
		inset-block-start: var(--zbk-spacing-1);
		inset-inline-start: var(--zbk-spacing-105);
		color: var(--zbk-brand-ink-emphasis);
		font-family: var(--zbk-font-family-alt);
		font-size: var(--zbk-font-size-lg);
		font-weight: var(--zbk-font-weight-bold);
		letter-spacing: var(--zbk-letter-spacing-wide);
	}

	:global(dynamo-blob.transition-blob) {
		display: block;
		fill: var(--zbk-accent-primary-canvas-emphasis);
		transition: fill var(--zbk-transition-duration-slow) ease;
	}

	.transition-demo[data-step='1'] :global(dynamo-blob.transition-blob) {
		fill: var(--zbk-accent-secondary-canvas-emphasis);
	}

	.transition-demo[data-step='2'] :global(dynamo-blob.transition-blob) {
		fill: var(--zbk-brand-canvas-emphasis);
	}

	.transition-content {
		display: flex;
		min-inline-size: 0;
		flex-direction: column;
		justify-content: space-between;
		padding: clamp(var(--zbk-spacing-2), 5vw, var(--zbk-spacing-4));
	}

	.transition-window {
		inline-size: 100%;
		overflow: hidden;
	}

	.transition-track {
		display: flex;
		inline-size: 300%;
		transform: translateX(calc(var(--active-slide) * -33.333333%));
		transition: transform var(--zbk-transition-duration-slow, 500ms) var(--zbk-transition-playful-motion-function-default, ease);
	}

	.transition-slide {
		display: flex;
		inline-size: 33.333333%;
		flex-direction: column;
		justify-content: center;
		padding-inline-end: var(--zbk-spacing-1);
	}

	.transition-slide p {
		margin: 0 0 var(--zbk-spacing-1);
		color: var(--zbk-accent-primary-ink-emphasis);
		font-family: var(--zbk-font-family-alt);
		font-size: var(--zbk-font-size-sm);
		font-weight: var(--zbk-font-weight-bold);
		letter-spacing: var(--zbk-letter-spacing-wide);
		text-transform: uppercase;
	}

	.transition-slide h4 {
		margin: 0 0 var(--zbk-spacing-1);
		color: var(--zbk-brand-ink-emphasis);
		font-family: var(--zbk-font-family-heading);
		font-size: clamp(var(--zbk-font-size-2xl), 4vw, var(--zbk-font-size-4xl));
		line-height: var(--zbk-line-height-2);
	}

	.transition-slide span {
		color: var(--zbk-app-ink);
	}

	.transition-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--zbk-spacing-1);
		padding-block-start: var(--zbk-spacing-2);
	}

	.transition-footer ol {
		display: flex;
		gap: var(--zbk-spacing-05);
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.transition-footer li {
		inline-size: var(--zbk-spacing-105);
		block-size: var(--zbk-spacing-025);
		border-radius: var(--zbk-border-radius-xl);
		background: var(--zbk-brand-canvas-muted);
		transition: inline-size var(--zbk-transition-duration-default) ease, background-color var(--zbk-transition-duration-default) ease;
		margin:0;
	}

	.transition-footer li.active {
		inline-size: var(--zbk-spacing-3);
		background: var(--zbk-accent-primary-canvas-emphasis);
	}

	svg {
		inline-size: var(--zbk-spacing-105);
		block-size: var(--zbk-spacing-105);
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}

	@media (max-width: 44rem) {
		.transition-demo {
			grid-template-columns: minmax(0, 1fr);
		}

		.transition-visual {
			min-block-size: 18rem;
		}

		.transition-content {
			min-block-size: 23rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.transition-track,
		.transition-visual,
		:global(dynamo-blob.transition-blob),
		.transition-footer li {
			transition-duration: 0.01ms;
		}
	}
</style>
