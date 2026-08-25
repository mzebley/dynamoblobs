export const docsSections = [
	{ id: 'installation', label: 'Installation' },
	{ id: 'usage', label: 'Usage' },
	{ id: 'api', label: 'API reference' },
	{ id: 'examples', label: 'Examples' }
] as const;

export const legacyTargets: Record<string, string> = {
	'installation-header': 'installation', 'usage-header': 'usage', 'data-attributes': 'api',
	'points-and-variance': 'attributes', 'deterministic-blobs': 'seed-modes',
	'available-functions': 'methods', 'generate-new-blob': 'methods', play: 'methods', pause: 'methods',
	'blob-wobble': 'motion-layers', 'blob-morph': 'motion-layers', 'blob-drift': 'motion-layers',
	'blob-master': 'state-properties', 'blob-observation': 'attributes', 'practicalApplicationHeader': 'examples',
	'layered-background': 'ambient-background', 'avatar-mask': 'organic-avatar', 'transition-flair': 'transition-example',
	deflect: 'methods', 'granular-controls': 'methods', 'npm-installation': 'npm-installation',
	'script-installation': 'script-installation', 'angular-installation': 'framework-installation',
	'eye-catching-headline': 'organic-avatar', 'generative-by-default': 'ambient-background',
	'play-example-blob': 'methods', 'regen-example-blob': 'methods', shuffle: 'transition-example',
	'widget_example_2': 'transition-example', 'widget_example_3': 'organic-avatar',
	'transition-blob-button': 'transition-example', 'transition-blob-example': 'transition-example',
	loading: 'usage', toc: 'quick-links', 'theme-toggle-input': 'theme-control', 'theme-toggle__within__clip': 'theme-control'
};
