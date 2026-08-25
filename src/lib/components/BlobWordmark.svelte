<script lang="ts">
	import { onMount } from 'svelte';
	import { createSeededRandom, encodeBlobSeed, generateBlobPath } from '../../dynamoblobs.js';
	import { WORDMARK_PATH_D } from './blobWordmark.path';

	type BlobElement = HTMLElement & {
		pause(): void;
	};

	type BlobWordmarkProps = {
		baseColor?: string;
		blobColor?: string;
		animated?: boolean;
	};

	const rawSpecs = [
		{ x: 8, y: -6, scale: 2.75, points: 8, variance: 16, speed: 6200, seed: 'wordmark-one' },
		{ x: 238, y: 22, scale: 2.35, points: 11, variance: 20, speed: 7600, seed: 'wordmark-two' },
		{ x: 438, y: -28, scale: 2.9, points: 7, variance: 14, speed: 6800, seed: 'wordmark-three' },
		{ x: 690, y: 18, scale: 2.45, points: 10, variance: 18, speed: 8300, seed: 'wordmark-four' },
		{ x: 902, y: -18, scale: 2.8, points: 9, variance: 15, speed: 7100, seed: 'wordmark-five' },
		{ x: 1150, y: 12, scale: 2.5, points: 12, variance: 19, speed: 8900, seed: 'wordmark-six' },
	];

	const blobSpecs = rawSpecs.map((spec) => {
		const path = generateBlobPath({
			points: spec.points,
			variance: spec.variance,
			random: createSeededRandom(spec.seed),
		});
		return { ...spec, path, encodedSeed: encodeBlobSeed(path) };
	});

	let { baseColor, blobColor, animated = true }: BlobWordmarkProps = $props();
	const instanceId = $props.id();
	const wordmarkPathId = `dynamoblobs-wordmark-path-${instanceId}`;
	const clipId = `dynamoblobs-wordmark-clip-${instanceId}`;
	let root = $state<HTMLDivElement>();

	onMount(() => {
		if (!root) return;

		let active = true;
		const cleanup: Array<() => void> = [];
		const connectGenerator = (generator: BlobElement, visiblePath: SVGPathElement) => {
			let sourcePath: SVGPathElement | null = null;
			let pathObserver: MutationObserver | null = null;

			const syncPath = () => {
				const pathData = sourcePath?.getAttribute('d');
				if (pathData) visiblePath.setAttribute('d', pathData);
			};

			const connectSourcePath = () => {
				const nextPath = generator.querySelector<SVGPathElement>('path');
				if (!nextPath || nextPath === sourcePath) return;

				pathObserver?.disconnect();
				sourcePath = nextPath;
				syncPath();
				pathObserver = new MutationObserver(syncPath);
				pathObserver.observe(sourcePath, { attributes: true, attributeFilter: ['d'] });
			};

			const hostObserver = new MutationObserver(connectSourcePath);
			hostObserver.observe(generator, { childList: true, subtree: true });
			connectSourcePath();

			cleanup.push(() => {
				hostObserver.disconnect();
				pathObserver?.disconnect();
				generator.pause();
			});
		};

		void customElements.whenDefined('dynamo-blob').then(() => {
			if (!active || !root) return;
			const generators = root.querySelectorAll<BlobElement>('[data-wordmark-generator]');
			const visiblePaths = root.querySelectorAll<SVGPathElement>('[data-wordmark-blob]');
			generators.forEach((generator, index) => {
				const visiblePath = visiblePaths[index];
				if (visiblePath) connectGenerator(generator, visiblePath);
			});
		});

		return () => {
			active = false;
			cleanup.forEach((disconnect) => disconnect());
		};
	});
</script>

<div
	bind:this={root}
	class="blob-wordmark"
	data-blob-wordmark
	data-blob-wordmark-animated={animated ? 'true' : 'false'}
	style:--dynamo-wordmark-base-color={baseColor}
	style:--dynamo-wordmark-blob-color={blobColor}
>
	<svg viewBox="0 0 1440 260" aria-hidden="true" focusable="false">
		<defs>
			<path id={wordmarkPathId} d={WORDMARK_PATH_D}></path>
			<clipPath id={clipId} clipPathUnits="userSpaceOnUse">
				<use href={`#${wordmarkPathId}`}></use>
			</clipPath>
		</defs>

		<use class="wordmark-base" href={`#${wordmarkPathId}`}></use>
		<g class="wordmark-blobs" clip-path={`url(#${clipId})`}>
			{#each blobSpecs as blob}
				<path
					data-wordmark-blob
					d={blob.path}
					transform={`translate(${blob.x} ${blob.y}) scale(${blob.scale})`}
				></path>
			{/each}
		</g>
	</svg>

	<div class="blob-generators" aria-hidden="true">
		{#each blobSpecs as blob}
			<dynamo-blob
				data-wordmark-generator
				data-blob-points={String(blob.points)}
				data-blob-variance={String(blob.variance)}
				data-blob-seed={blob.encodedSeed}
				data-blob-wobble-autoplay="false"
				data-blob-morph-autoplay={animated ? 'true' : undefined}
				data-blob-morph-speed={String(blob.speed)}
			></dynamo-blob>
		{/each}
	</div>
</div>

<style>
	.blob-wordmark {
		position: relative;
		inline-size: 100%;
		color: var(--dynamo-wordmark-base-color, var(--zbk-accent-primary-ink, #274848));
	}

	svg {
		display: block;
		inline-size: 100%;
		block-size: auto;
		overflow: visible;
	}

	.wordmark-base {
		fill: currentColor;
	}

	.wordmark-blobs {
		fill: var(--dynamo-wordmark-blob-color, var(--zbk-accent-secondary-canvas-emphasis, #e6c554));
	}

	.blob-generators {
		position: absolute;
		inline-size: 1px;
		block-size: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		pointer-events: none;
	}
</style>
