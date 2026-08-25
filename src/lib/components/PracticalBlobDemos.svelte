<script lang="ts">
	import SsrDynamoBlob from './SsrDynamoBlob.svelte';

	type BlobElement = HTMLElement & {
		generateNewBlob(duration?: number): unknown;
	};
	type PracticalBlobDemosProps = {
		demo: 'cover' | 'profile';
	};

	let { demo }: PracticalBlobDemosProps = $props();

	let coverBlobOne = $state<BlobElement>();
	let coverBlobTwo = $state<BlobElement>();
	let coverBlobThree = $state<BlobElement>();
	let remixing = $state(false);
	let status = $state('The generative cover is ready.');

	async function remixCover() {
		if (remixing) return;
		remixing = true;
		status = 'Remixing the cover artwork.';
		const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 700;
		const blobs = [coverBlobOne, coverBlobTwo, coverBlobThree].filter(
			(blob): blob is BlobElement => Boolean(blob),
		);

		await Promise.all(
			blobs.map(
				(blob) =>
					new Promise<void>((resolve) => {
						const fallback = window.setTimeout(resolve, duration + 180);
						blob.addEventListener(
							'dynamo-blob-complete',
							() => {
								clearTimeout(fallback);
								resolve();
							},
							{ once: true },
						);
						blob.generateNewBlob(duration);
					}),
			),
		);

		status = 'The cover artwork was remixed.';
		remixing = false;
	}
</script>

{#if demo === 'cover'}
<section class="cover-demo" aria-labelledby="cover-demo-title">
	<div class="cover-art" aria-hidden="true">
		<p class="cover-kicker">Field notes</p>
		<p class="cover-number">04</p>
		<SsrDynamoBlob
			bind:element={coverBlobOne}
			class="cover-blob cover-blob-one"
			points={8}
			variance={18}
			data-blob-morph-autoplay="true"
			data-blob-morph-speed="7200"
			style="width:13rem;height:13rem"
		/>
		<SsrDynamoBlob
			bind:element={coverBlobTwo}
			class="cover-blob cover-blob-two"
			points={12}
			variance={14}
			data-blob-morph-autoplay="true"
			data-blob-morph-speed="8800"
			style="width:10rem;height:10rem"
		/>
		<SsrDynamoBlob
			bind:element={coverBlobThree}
			class="cover-blob cover-blob-three"
			points={7}
			variance={20}
			data-blob-morph-autoplay="true"
			data-blob-morph-speed="6500"
			style="width:8rem;height:8rem"
		/>
	</div>

	<div class="cover-copy">
		<p class="demo-eyebrow">Generative campaign art</p>
		<h4 id="cover-demo-title">Make room for the strange ideas.</h4>
		<p>Layer a few low-speed blobs into a repeatable art direction, then let each impression feel slightly different.</p>
		<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
		<zbk-button variant="wave-action wave-pop lg" loading={remixing ? true : undefined} onclick={remixCover}>
			Remix the cover
			<span slot="icon" data-position="end" aria-hidden="true">
				<svg viewBox="0 0 24 24"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" /></svg>
			</span>
		</zbk-button>
	</div>
	<p class="visually-hidden" role="status" aria-live="polite">{status}</p>
</section>
{:else}
<article class="profile-demo" aria-labelledby="profile-demo-title">
	<div class="profile-avatar" aria-hidden="true">
		<SsrDynamoBlob
			class="profile-blob"
			points={9}
			variance={16}
			data-blob-morph-autoplay="true"
			data-blob-morph-speed="11000"
			style="width:100%;height:100%"
		/>
		<span>NA</span>
	</div>
	<div class="profile-copy">
		<p class="demo-eyebrow">Featured maker</p>
		<h4 id="profile-demo-title">Nia Alvarez</h4>
		<p>Turns discarded clay into quiet, useful objects from a one-room studio in Santa Fe.</p>
		<ul aria-label="Nia Alvarez specialties">
			<li>Wheel-thrown</li>
			<li>Reclaimed clay</li>
			<li>Small batch</li>
		</ul>
	</div>
</article>
{/if}

<style>
	.cover-demo,
	.profile-demo {
		margin-block: var(--zbk-spacing-2) var(--zbk-spacing-3);
		border: var(--zbk-border-width-sm) solid var(--zbk-brand-border-muted);
		border-radius: var(--zbk-border-radius-lg);
		overflow: clip;
		box-shadow: var(--zbk-elevation-sm);
	}

	.cover-demo {
		display: grid;
		grid-template-columns: minmax(0, 1.08fr) minmax(15rem, 0.92fr);
		min-block-size: 25rem;
		background: var(--zbk-brand-canvas-emphasis);
		color: var(--zbk-brand-ink-inverse-emphasis);
	}

	.cover-art {
		position: relative;
		isolation: isolate;
		min-block-size: 25rem;
		overflow: clip;
		background:
			linear-gradient(90deg, color-mix(in srgb, var(--zbk-brand-canvas-emphasis) 88%, transparent) 1px, transparent 1px),
			linear-gradient(color-mix(in srgb, var(--zbk-brand-canvas-emphasis) 88%, transparent) 1px, transparent 1px),
			var(--zbk-accent-primary-canvas-inverse-emphasis);
		background-size: var(--zbk-spacing-2) var(--zbk-spacing-2);
	}

	.cover-art::after {
		position: absolute;
		z-index: 2;
		inset: var(--zbk-spacing-1);
		border: var(--zbk-border-width-sm) solid color-mix(in srgb, var(--zbk-brand-canvas-inverse) 38%, transparent);
		border-radius: max(0px, calc(var(--zbk-border-radius-lg) - var(--zbk-spacing-1)));
		content: '';
		pointer-events: none;
	}

	.cover-kicker,
	.cover-number {
		position: absolute;
		z-index: 3;
		margin: 0;
		color: var(--zbk-brand-ink-inverse-emphasis);
		font-family: var(--zbk-font-family-alt);
		font-weight: var(--zbk-font-weight-bold);
		letter-spacing: var(--zbk-letter-spacing-wide);
		text-transform: uppercase;
	}

	.cover-kicker {
		inset-block-start: var(--zbk-spacing-2);
		inset-inline-start: var(--zbk-spacing-2);
		font-size: var(--zbk-font-size-sm);
	}

	.cover-number {
		inset-inline-end: var(--zbk-spacing-2);
		inset-block-end: var(--zbk-spacing-1);
		font-size: clamp(4rem, 11vw, 7.5rem);
		line-height: 1;
	}

	:global(dynamo-blob.cover-blob) {
		position: absolute;
		z-index: 1;
		display: block;
	}

	:global(dynamo-blob.cover-blob-one) {
		inset-block-start: 12%;
		inset-inline-start: 4%;
		fill: var(--zbk-accent-secondary-canvas-emphasis);
	}

	:global(dynamo-blob.cover-blob-two) {
		inset-block-start: 38%;
		inset-inline-start: 46%;
		fill: var(--zbk-accent-primary-canvas-muted);
	}

	:global(dynamo-blob.cover-blob-three) {
		inset-block-start: -5%;
		inset-inline-start: 58%;
		fill: var(--zbk-brand-canvas-inverse);
		opacity: 0.72;
	}

	.cover-copy {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: var(--zbk-spacing-1);
		padding: clamp(var(--zbk-spacing-2), 5vw, var(--zbk-spacing-4));
	}

	.demo-eyebrow {
		margin: 0;
		color: var(--zbk-brand-ink-inverse-emphasis);
		font-family: var(--zbk-font-family-alt);
		font-size: var(--zbk-font-size-sm);
		font-weight: var(--zbk-font-weight-bold);
		letter-spacing: var(--zbk-letter-spacing-wide);
		text-transform: uppercase;
	}

	.cover-copy h4,
	.profile-copy h4 {
		margin: 0;
		font-family: var(--zbk-font-family-heading);
		line-height: var(--zbk-line-height-2);
	}

	.cover-copy h4 {
		color: inherit;
		font-size: clamp(var(--zbk-font-size-2xl), 4vw, var(--zbk-font-size-4xl));
	}

	.cover-copy p:not(.demo-eyebrow),
	.profile-copy p:not(.demo-eyebrow) {
		margin: 0;
	}

	.cover-copy svg {
		inline-size: 1em;
		block-size: 1em;
		fill: none;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
		stroke-width: 2;
	}

	.profile-demo {
		display: grid;
		grid-template-columns: minmax(10rem, 0.72fr) minmax(0, 1.28fr);
		align-items: center;
		gap: clamp(var(--zbk-spacing-105), 5vw, var(--zbk-spacing-3));
		padding: clamp(var(--zbk-spacing-105), 5vw, var(--zbk-spacing-3));
		background: var(--zbk-app-canvas-subtle);
	}

	.profile-avatar {
		position: relative;
		display: grid;
		inline-size: min(100%, 13rem);
		aspect-ratio: 1;
		place-items: center;
		justify-self: center;
	}

	:global(dynamo-blob.profile-blob) {
		position: absolute;
		inset: 0;
		display: block;
		fill: var(--zbk-accent-primary-canvas-emphasis);
	}

	.profile-avatar span {
		position: relative;
		color: var(--zbk-accent-primary-ink-inverse-emphasis);
		font-family: var(--zbk-font-family-heading);
		font-size: clamp(var(--zbk-font-size-3xl), 9vw, var(--zbk-font-size-5xl));
		font-weight: var(--zbk-font-weight-bold);
		letter-spacing: var(--zbk-letter-spacing-tight);
	}

	.profile-copy {
		display: grid;
		gap: var(--zbk-spacing-05);
	}

	.profile-copy .demo-eyebrow {
		color: var(--zbk-accent-primary-ink-emphasis);
	}

	.profile-copy h4 {
		color: var(--zbk-brand-ink-emphasis);
		font-size: var(--zbk-font-size-2xl);
	}

	.profile-copy ul {
		display: flex;
		flex-wrap: wrap;
		gap: var(--zbk-spacing-05);
		padding: 0;
		margin: var(--zbk-spacing-05) 0 0;
		list-style: none;
	}

	.profile-copy li {
		padding: var(--zbk-spacing-025) var(--zbk-spacing-05);
		border: var(--zbk-border-width-sm) solid var(--zbk-brand-border-muted);
		border-radius: var(--zbk-border-radius-xl);
		color: var(--zbk-brand-ink);
		font-size: var(--zbk-font-size-sm);
	}

	@media (max-width: 44rem) {
		.cover-demo,
		.profile-demo {
			grid-template-columns: minmax(0, 1fr);
		}

		.cover-demo,
		.cover-art {
			min-block-size: 20rem;
		}

		.cover-copy {
			padding-block: var(--zbk-spacing-3);
		}

		.profile-avatar {
			inline-size: min(72vw, 12rem);
		}
	}
</style>
