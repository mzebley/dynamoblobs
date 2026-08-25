<script lang="ts">
	import { encodeBlobSeed, generateBlobPath } from '../../dynamoblobs.js';
	type BlobElement = HTMLElement & { generateNewBlob(duration?: number): unknown };
	let { element = $bindable(), class: className = '', points = 10, variance = 16, style = '', ...attributes }: { element?: BlobElement; class?: string; points?: number; variance?: number; style?: string; [key: string]: unknown } = $props();
	let path = $derived.by(() => {
		let value = points * 97 + variance * 13;
		return generateBlobPath({ points, variance, random: () => ((value = (value * 16807) % 2147483647) / 2147483647) });
	});
	let seed = $derived(encodeBlobSeed(path));
</script>

<dynamo-blob bind:this={element} class={className} data-blob-seed={seed} data-blob-points={points} data-blob-variance={variance} {style} aria-hidden="true" {...attributes}>
	<div class="dynamo-blob__turn">
		<svg class="dynamo-blob__skew" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" role="presentation" focusable="false">
			<g class="dynamo-blob__scale"><path class="dynamo-blob__path" d={path}></path></g>
		</svg>
	</div>
</dynamo-blob>
