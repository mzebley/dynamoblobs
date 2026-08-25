/** Resolve after the initial browser paint so deep links target upgraded content. */
export function whenPageSettled(): Promise<void> {
	if (typeof window === 'undefined') return new Promise(() => {});
	return new Promise((resolve) => {
		const settle = () => requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		if (document.readyState === 'complete') settle();
		else window.addEventListener('load', settle, { once: true });
	});
}
