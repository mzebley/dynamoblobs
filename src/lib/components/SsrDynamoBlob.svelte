<script lang="ts">
	import { onMount } from 'svelte';
	import { encodeBlobSeed, generateBlobPath } from '../../dynamoblobs.js';
	type BlobElement = HTMLElement & { generateNewBlob(duration?: number): unknown };
	let { element = $bindable(), class: className = '', points = 10, variance = 16, style = '', ...attributes }: { element?: BlobElement; class?: string; points?: number; variance?: number; style?: string; [key: string]: unknown } = $props();
	let path = $derived.by(() => {
		let value = points * 97 + variance * 13;
		return generateBlobPath({ points, variance, random: () => ((value = (value * 16807) % 2147483647) / 2147483647) });
	});
	let seed = $derived(encodeBlobSeed(path));

	// An early custom-element upgrade can add runtime classes before Svelte hydration
	// rewrites the authored class list. Restore the live class state after mount.
	onMount(() => {
		let cancelled = false;
		void customElements.whenDefined('dynamo-blob').then(() => {
			requestAnimationFrame(() => {
				if (cancelled || !element) return;
				const clickValue = element.getAttribute('data-blob-drift-click');
				const isClickable = clickValue !== null && !['false', '0', 'no', 'off'].includes(clickValue.trim().toLowerCase());
				element.classList.add('dynamo-blob-host');
				element.classList.toggle('dynamo-blob--drift', element.getAttribute('data-blob-is-drifting') === 'true');
				element.classList.toggle('dynamo-blob--clickable', isClickable);
			});
		});
		return () => {
			cancelled = true;
		};
	});
</script>

<dynamo-blob bind:this={element} class={className} data-blob-seed={seed} data-blob-points={points} data-blob-variance={variance} {style} aria-hidden="true" {...attributes}>
	<div class="dynamo-blob__turn">
		<svg class="dynamo-blob__skew" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" role="presentation" focusable="false">
			<g class="dynamo-blob__scale"><path class="dynamo-blob__path" d={path}></path></g>
		</svg>
	</div>
</dynamo-blob>
