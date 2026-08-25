<script lang="ts">
	import { onMount } from 'svelte';
	import {
		createSeededRandom,
		generateBlobPath,
		interpolateBlob,
		nextMorphShape,
		parseBlobPath,
	} from '../../dynamoblobs.js';

	const random = createSeededRandom('studio-crop-example');
	const initialPath = generateBlobPath({ points: 9, variance: 17, random });
	let cropPath = $state(initialPath);

	onMount(() => {
		const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
		let frame = 0;
		let pause = 0;
		let activePath = initialPath;

		function stop() {
			cancelAnimationFrame(frame);
			clearTimeout(pause);
		}

		function morph() {
			if (motionPreference.matches) return;
			const from = parseBlobPath(activePath);
			const targetPath = nextMorphShape(activePath, { variance: 17, intensity: 0.48, random });
			const target = parseBlobPath(targetPath);
			const startedAt = performance.now();

			function draw(now: number) {
				const progress = Math.min((now - startedAt) / 4200, 1);
				const eased = progress < 0.5
					? 4 * progress * progress * progress
					: 1 - Math.pow(-2 * progress + 2, 3) / 2;
				cropPath = interpolateBlob(from, target, eased);

				if (progress < 1) {
					frame = requestAnimationFrame(draw);
					return;
				}

				activePath = targetPath;
				pause = window.setTimeout(morph, 900);
			}

			frame = requestAnimationFrame(draw);
		}

		function handleMotionChange() {
			stop();
			if (motionPreference.matches) {
				activePath = initialPath;
				cropPath = initialPath;
			} else {
				morph();
			}
		}

		motionPreference.addEventListener('change', handleMotionChange);
		morph();

		return () => {
			stop();
			motionPreference.removeEventListener('change', handleMotionChange);
		};
	});
</script>

<figure class="crop-demo">
	<div class="crop-art">
		<svg viewBox="0 0 100 100" role="img" aria-labelledby="studio-crop-title studio-crop-description">
			<title id="studio-crop-title">A ceramic artist's sunlit studio</title>
			<desc id="studio-crop-description">The studio photograph is revealed through a gently morphing blob-shaped crop.</desc>
			<defs>
				<clipPath id="studio-blob-crop">
					<path d={cropPath} />
				</clipPath>
			</defs>
			<path class="crop-shadow" d={cropPath} transform="translate(3 3)" aria-hidden="true" />
			<image
				href="/example-studio.svg"
				width="100"
				height="100"
				preserveAspectRatio="xMidYMid slice"
				clip-path="url(#studio-blob-crop)"
			/>
		</svg>
	</div>
	<figcaption>
		<p class="demo-eyebrow">Studio visit · 06</p>
		<h4>Let the crop carry the character.</h4>
		<p>The source image stays rectangular and useful. Only the SVG clip path changes, so the same asset can still serve ordinary image layouts elsewhere.</p>
	</figcaption>
</figure>

<style>
	.crop-demo {
		display: grid;
		grid-template-columns: minmax(14rem, 0.92fr) minmax(0, 1.08fr);
		align-items: center;
		gap: clamp(var(--zbk-spacing-105), 5vw, var(--zbk-spacing-4));
		padding: clamp(var(--zbk-spacing-105), 5vw, var(--zbk-spacing-3));
		margin-block: var(--zbk-spacing-2) var(--zbk-spacing-3);
		border: var(--zbk-border-width-sm) solid var(--zbk-brand-border-muted);
		border-radius: var(--zbk-border-radius-lg);
		background: var(--zbk-app-canvas-subtle);
		box-shadow: var(--zbk-elevation-sm);
		overflow: clip;
	}

	.crop-art {
		position: relative;
		inline-size: min(100%, 23rem);
		justify-self: center;
	}

	.crop-art::before {
		position: absolute;
		inset: 8% 2% 2% 10%;
		border-radius: 48% 52% 45% 55%;
		background: var(--zbk-accent-secondary-canvas-muted);
		content: '';
		transform: rotate(-8deg);
	}

	.crop-art svg {
		position: relative;
		display: block;
		inline-size: 100%;
		aspect-ratio: 1;
	}

	.crop-shadow {
		fill: var(--zbk-brand-canvas-emphasis);
		opacity: 0.18;
	}

	figcaption {
		display: grid;
		gap: var(--zbk-spacing-05);
	}

	.demo-eyebrow {
		margin: 0;
		color: var(--zbk-accent-primary-ink-emphasis);
		font-family: var(--zbk-font-family-alt);
		font-size: var(--zbk-font-size-sm);
		font-weight: var(--zbk-font-weight-bold);
		letter-spacing: var(--zbk-letter-spacing-wide);
		text-transform: uppercase;
	}

	h4 {
		margin: 0;
		color: var(--zbk-brand-ink-emphasis);
		font-family: var(--zbk-font-family-heading);
		font-size: clamp(var(--zbk-font-size-2xl), 4vw, var(--zbk-font-size-3xl));
		line-height: var(--zbk-line-height-2);
	}

	figcaption p:not(.demo-eyebrow) {
		margin: 0;
		color: var(--zbk-brand-ink);
	}

	@media (max-width: 44rem) {
		.crop-demo {
			grid-template-columns: minmax(0, 1fr);
		}

		.crop-art {
			inline-size: min(78vw, 20rem);
		}
	}
</style>
