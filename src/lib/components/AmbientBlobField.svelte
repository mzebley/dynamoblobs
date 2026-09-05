<script lang="ts">
	import { onMount } from 'svelte';
	import SsrDynamoBlob from './SsrDynamoBlob.svelte';

	let field = $state<HTMLElement>();
	let isReady = $state(false);

	onMount(() => {
		let cancelled = false;
		let revealFrame: number | undefined;
		const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotion = () => {
			field?.querySelectorAll('dynamo-blob').forEach((blob) => {
				blob.setAttribute('data-blob-is-animating', String(!motionPreference.matches));
			});
		};
		const revealWhenReady = async () => {
			await customElements.whenDefined('dynamo-blob');
			if (cancelled) return;
			revealFrame = requestAnimationFrame(() => {
				revealFrame = requestAnimationFrame(() => {
					revealFrame = undefined;
					if (!cancelled) isReady = true;
				});
			});
		};

		syncMotion();
		void revealWhenReady();
		motionPreference.addEventListener('change', syncMotion);
		return () => {
			cancelled = true;
			if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
			motionPreference.removeEventListener('change', syncMotion);
		};
	});
</script>

<div bind:this={field} class:ambient-field-ready={isReady} class="ambient-field" aria-hidden="true">
	<SsrDynamoBlob
		class="ambient-blob ambient-blob-one ambient-primary"
		points={9}
		variance={4}
		data-blob-morph-autoplay="true"
		data-blob-morph-speed="17000"
		data-blob-morph-intensity="0.42"
		data-blob-drift-autoplay="true"
		data-blob-drift-speed="0.34"
		data-blob-drift-intensity="0.9"
		data-blob-drift-start-position="current"
	/>
	<SsrDynamoBlob
		class="ambient-blob ambient-blob-two ambient-secondary"
		points={12}
		variance={13}
		data-blob-morph-autoplay="true"
		data-blob-morph-speed="21000"
		data-blob-morph-intensity="0.38"
		data-blob-drift-autoplay="true"
		data-blob-drift-speed="0.28"
		data-blob-drift-intensity="1.08"
		data-blob-drift-start-position="current"
	/>
	<SsrDynamoBlob
		class="ambient-blob ambient-blob-three ambient-primary"
		points={7}
		variance={7}
		data-blob-morph-autoplay="true"
		data-blob-morph-speed="19000"
		data-blob-morph-intensity="0.36"
		data-blob-drift-autoplay="true"
		data-blob-drift-speed="0.3"
		data-blob-drift-intensity="0.86"
		data-blob-drift-start-position="current"
	/>
	<SsrDynamoBlob
		class="ambient-blob ambient-blob-four ambient-secondary"
		points={10}
		variance={4}
		data-blob-morph-autoplay="true"
		data-blob-morph-speed="23000"
		data-blob-morph-intensity="0.44"
		data-blob-drift-autoplay="true"
		data-blob-drift-speed="0.26"
		data-blob-drift-intensity="1.12"
		data-blob-drift-start-position="current"
	/>
	<SsrDynamoBlob
		class="ambient-blob ambient-blob-five ambient-primary"
		points={14}
		variance={12}
		data-blob-morph-autoplay="true"
		data-blob-morph-speed="25000"
		data-blob-morph-intensity="0.4"
		data-blob-drift-autoplay="true"
		data-blob-drift-speed="0.23"
		data-blob-drift-intensity="0.94"
		data-blob-drift-start-position="current"
	/>
</div>

<style>
	.ambient-field {
		position: absolute;
		z-index: 0;
		inset-block: -18rem;
		inset-inline: -12rem;
		contain: layout;
		pointer-events: none;
		opacity: 0;
		transition: opacity var(--zbk-transition-duration-slow, 500ms) ease;
	}

	.ambient-field-ready {
		opacity: 1;
	}

	:global(dynamo-blob.ambient-blob) {
		position: absolute;
		display: block;
		opacity: 0.1125;
		mix-blend-mode: multiply;
	}

	:global(dynamo-blob.ambient-primary) {
		fill: var(--zbk-accent-primary-canvas);
	}

	:global(dynamo-blob.ambient-secondary) {
		fill: var(--zbk-accent-secondary-canvas-emphasis);
		/* opacity: 0.24; */
	}

	:global(dynamo-blob.ambient-blob-one) {
		inset-block-start: 5%;
		inset-inline-start: 6%;
		inline-size: clamp(31.25rem, 60vw, 62.5rem);
		block-size: clamp(31.25rem, 60vw, 62.5rem);
	}

	:global(dynamo-blob.ambient-blob-two) {
		inset-block-start: 14%;
		inset-inline-start: 59%;
		inline-size: clamp(27.5rem, 51.25vw, 55rem);
		block-size: clamp(27.5rem, 51.25vw, 55rem);
	}

	:global(dynamo-blob.ambient-blob-three) {
		inset-block-start: 41%;
		inset-inline-start: 8%;
		inline-size: clamp(33.75rem, 65vw, 67.5rem);
		block-size: clamp(33.75rem, 65vw, 67.5rem);
	}

	:global(dynamo-blob.ambient-blob-four) {
		inset-block-start: 50%;
		inset-inline-start: 58%;
		inline-size: clamp(26.25rem, 47.5vw, 50rem);
		block-size: clamp(26.25rem, 47.5vw, 50rem);
	}

	:global(dynamo-blob.ambient-blob-five) {
		inset-block-start: 35%;
		inset-inline-start: 33%;
		inline-size: clamp(22.5rem, 40vw, 42.5rem);
		block-size: clamp(22.5rem, 40vw, 42.5rem);
	}

	:global(dynamo-blob.ambient-blob.dynamo-blob--drift) {
		inset-block-start: 0;
		inset-inline-start: 0;
	}

	:global(html[data-zbk-theme='dark']) :global(dynamo-blob.ambient-blob) {
		opacity: 0.25;
		mix-blend-mode: screen;
	}

	:global(html[data-zbk-theme='dark']) :global(dynamo-blob.ambient-secondary) {
		opacity: 0.2;
	}

	@media (max-width: 44rem) {
		.ambient-field {
			inset-inline: -24rem;
		}

		:global(dynamo-blob.ambient-blob) {
			opacity: 0.24;
		}

		:global(dynamo-blob.ambient-secondary) {
			opacity: 0.2;
		}

		:global(dynamo-blob.ambient-blob-one) {
			inset-inline-start: 8%;
			inline-size: 42.5rem;
			block-size: 42.5rem;
		}

		:global(dynamo-blob.ambient-blob-two) {
			inset-inline-start: 50%;
			inline-size: 36.25rem;
			block-size: 36.25rem;
		}

		:global(dynamo-blob.ambient-blob-three) {
			inset-inline-start: 11%;
			inline-size: 45rem;
			block-size: 45rem;
		}

		:global(dynamo-blob.ambient-blob-four) {
			inset-inline-start: 47%;
			inline-size: 33.75rem;
			block-size: 33.75rem;
		}

		:global(dynamo-blob.ambient-blob-five) {
			inset-inline-start: 34%;
			inline-size: 30rem;
			block-size: 30rem;
		}
	}
</style>
