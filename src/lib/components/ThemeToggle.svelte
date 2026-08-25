<script lang="ts">
	import { onMount } from 'svelte';
	const storageKey = 'dynamoblobs-theme';
	let dark = $state(false);
	let toggle: (HTMLElement & { checked?: boolean }) | undefined;

	function apply(theme: 'light' | 'dark', source: 'manual' | 'system') {
		const root = document.documentElement;
		root.dataset.zbkTheme = theme;
		root.dataset.themeSource = source;
		dark = theme === 'dark';
		if (toggle) toggle.checked = dark;
	}

	function change(event: Event) {
		const control = event.currentTarget as HTMLElement & { checked?: boolean };
		const theme = control.checked ? 'dark' : 'light';
		apply(theme, 'manual');
		try {
			localStorage.setItem(storageKey, theme);
		} catch (error) {
			// The theme still applies for this page when storage is unavailable.
		}
	}

	onMount(() => {
		const root = document.documentElement;
		apply(root.dataset.zbkTheme === 'dark' ? 'dark' : 'light', root.dataset.themeSource === 'manual' ? 'manual' : 'system');
		const query = matchMedia('(prefers-color-scheme: dark)');
		const systemChange = (event: MediaQueryListEvent) => {
			if (root.dataset.themeSource !== 'manual') apply(event.matches ? 'dark' : 'light', 'system');
		};
		query.addEventListener('change', systemChange);
		return () => query.removeEventListener('change', systemChange);
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<zbk-toggle bind:this={toggle} id="theme-control" data-theme-toggle checked={dark} aria-label="Dark theme" onchange={change}>
	Dark mode
</zbk-toggle>
