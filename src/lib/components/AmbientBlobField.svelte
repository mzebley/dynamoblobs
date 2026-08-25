<script lang="ts">
	import { onMount } from 'svelte';
	import SsrDynamoBlob from './SsrDynamoBlob.svelte';

	let field = $state<HTMLElement>();

	onMount(() => {
		const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
		const syncMotion = () => {
			field?.querySelectorAll('dynamo-blob').forEach((blob) => {
				blob.setAttribute('data-blob-is-animating', String(!motionPreference.matches));
			});
		};

		syncMotion();
		motionPreference.addEventListener('change', syncMotion);
		return () => motionPreference.removeEventListener('change', syncMotion);
	});
</script>

<div bind:this={field} class="ambient-field" aria-hidden="true">
	<div class="ambient-lane ambient-lane-one">
		<SsrDynamoBlob
			class="ambient-blob ambient-blob-one ambient-primary"
			points={9}
			variance={15}
			data-blob-morph-autoplay="true"
			data-blob-morph-speed="17000"
			data-blob-morph-intensity="0.42"
			data-blob-drift-autoplay="true"
			data-blob-drift-speed="0.34"
			data-blob-drift-intensity="0.9"
		/>
	</div>
	<div class="ambient-lane ambient-lane-two">
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
		/>
	</div>
	<div class="ambient-lane ambient-lane-three">
		<SsrDynamoBlob
			class="ambient-blob ambient-blob-three ambient-primary"
			points={7}
			variance={17}
			data-blob-morph-autoplay="true"
			data-blob-morph-speed="19000"
			data-blob-morph-intensity="0.36"
			data-blob-drift-autoplay="true"
			data-blob-drift-speed="0.3"
			data-blob-drift-intensity="0.86"
		/>
	</div>
	<div class="ambient-lane ambient-lane-four">
		<SsrDynamoBlob
			class="ambient-blob ambient-blob-four ambient-secondary"
			points={10}
			variance={14}
			data-blob-morph-autoplay="true"
			data-blob-morph-speed="23000"
			data-blob-morph-intensity="0.44"
			data-blob-drift-autoplay="true"
			data-blob-drift-speed="0.26"
			data-blob-drift-intensity="1.12"
		/>
	</div>
	<div class="ambient-lane ambient-lane-five">
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
		/>
	</div>
</div>

<style>
	.ambient-field {
		position: absolute;
		z-index: 0;
		inset: 0;
		contain: layout paint;
		overflow: clip;
		pointer-events: none;
	}

	.ambient-lane {
		position: absolute;
		overflow: visible;
	}

	.ambient-lane-one {
		inset: -8% 42% 48% -10%;
	}

	.ambient-lane-two {
		inset: -6% -10% 43% 45%;
	}

	.ambient-lane-three {
		inset: 38% 38% -8% -12%;
	}

	.ambient-lane-four {
		inset: 40% -12% -10% 44%;
	}

	.ambient-lane-five {
		inset: 18% 18% 16% 18%;
	}

	:global(dynamo-blob.ambient-blob) {
		position: absolute;
		display: block;
		opacity: 0.28;
		mix-blend-mode: multiply;
	}

	:global(dynamo-blob.ambient-primary) {
		fill: var(--zbk-accent-primary-canvas);
	}

	:global(dynamo-blob.ambient-secondary) {
		fill: var(--zbk-accent-secondary-canvas-emphasis);
		opacity: 0.24;
	}

	:global(dynamo-blob.ambient-blob-one) {
		inline-size: clamp(25rem, 48vw, 50rem);
		block-size: clamp(25rem, 48vw, 50rem);
	}

	:global(dynamo-blob.ambient-blob-two) {
		inline-size: clamp(22rem, 41vw, 44rem);
		block-size: clamp(22rem, 41vw, 44rem);
	}

	:global(dynamo-blob.ambient-blob-three) {
		inline-size: clamp(27rem, 52vw, 54rem);
		block-size: clamp(27rem, 52vw, 54rem);
	}

	:global(dynamo-blob.ambient-blob-four) {
		inline-size: clamp(21rem, 38vw, 40rem);
		block-size: clamp(21rem, 38vw, 40rem);
	}

	:global(dynamo-blob.ambient-blob-five) {
		inline-size: clamp(18rem, 32vw, 34rem);
		block-size: clamp(18rem, 32vw, 34rem);
	}

	:global(html[data-zbk-theme='dark']) :global(dynamo-blob.ambient-blob) {
		opacity: 0.25;
		mix-blend-mode: screen;
	}

	:global(html[data-zbk-theme='dark']) :global(dynamo-blob.ambient-secondary) {
		opacity: 0.2;
	}

	@media (max-width: 44rem) {
		.ambient-lane-one {
			inset: -8% -5% 56% -42%;
		}

		.ambient-lane-two {
			inset: 2% -48% 52% 28%;
		}

		.ambient-lane-three {
			inset: 38% -4% -5% -48%;
		}

		.ambient-lane-four {
			inset: 48% -48% -8% 24%;
		}

		.ambient-lane-five {
			inset: 24% -10% 18% -10%;
		}

		:global(dynamo-blob.ambient-blob) {
			opacity: 0.24;
		}

		:global(dynamo-blob.ambient-secondary) {
			opacity: 0.2;
		}

		:global(dynamo-blob.ambient-blob-one) {
			inline-size: 34rem;
			block-size: 34rem;
		}

		:global(dynamo-blob.ambient-blob-two) {
			inline-size: 29rem;
			block-size: 29rem;
		}

		:global(dynamo-blob.ambient-blob-three) {
			inline-size: 36rem;
			block-size: 36rem;
		}

		:global(dynamo-blob.ambient-blob-four) {
			inline-size: 27rem;
			block-size: 27rem;
		}

		:global(dynamo-blob.ambient-blob-five) {
			inline-size: 24rem;
			block-size: 24rem;
		}
	}
</style>
