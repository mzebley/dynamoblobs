import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import mdsvexConfig from './mdsvex.config.js';

export default {
	extensions: ['.svelte', '.md'],
	compilerOptions: { runes: true },
	preprocess: [vitePreprocess(), mdsvex(mdsvexConfig)],
	kit: { adapter: adapter({ fallback: '404.html', strict: true }) }
};
