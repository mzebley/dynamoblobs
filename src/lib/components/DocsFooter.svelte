<footer class="site-footer">
	<div class="footer-project">
		<svg viewBox="0 0 100 100" aria-hidden="true" class="footer-blob"><path d="M50 11 Q71 9 84 27 Q98 44 86 64 Q75 87 50 89 Q26 92 12 71 Q0 51 14 30 Q28 10 50 11Z" /></svg>
		<nav aria-label="Project links" class="footer-links">
			<zbk-link href="https://github.com/mzebley/dynamoblobs" target="_blank" rel="noopener" variant="subtle sm">GitHub</zbk-link>
			<zbk-link href="https://www.npmjs.com/package/dynamoblobs" target="_blank" rel="noopener" variant="subtle sm">npm</zbk-link>
		</nav>
	</div>
	<p>An idea by <zbk-link href="https://markzebley.com" target="_blank" rel="noopener" variant="subtle">Mark Zebley</zbk-link>.</p>
</footer>

<style>
	.site-footer { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: var(--zbk-spacing-2); padding: var(--zbk-spacing-2) clamp(var(--zbk-spacing-105), 5vw, var(--zbk-spacing-card)) var(--zbk-spacing-1); background: var(--zbk-brand-canvas-muted); color: var(--zbk-brand-ink-emphasis); }
	.footer-project { display: flex; gap: var(--zbk-spacing-1); }
	.footer-blob { inline-size: var(--zbk-spacing-5); block-size: var(--zbk-spacing-5); fill: var(--zbk-brand-canvas); }
	.footer-links { display: flex; flex-direction: column; }
	p { margin: 0; font-size: var(--zbk-font-size-sm); }
	@media (max-width: 40rem) { .site-footer, .footer-links { align-items: flex-start; flex-direction: column; } }
</style>
