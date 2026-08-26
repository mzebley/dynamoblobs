<script lang="ts">
  import { pushState } from "$app/navigation";
  import { onMount } from "svelte";
  import { legacyTargets } from "$lib/docs";
  import { whenPageSettled } from "$lib/pageSettled";
  let { sections }: { sections: readonly { id: string; label: string }[] } =
    $props();
  let showTop = $state(false);
  function targetFor(id: string) {
    return legacyTargets[id] ?? id;
  }
  let mobileNav: HTMLDetailsElement;
  function focusHash(id: string, smooth = true) {
    const target = document.getElementById(targetFor(id));
    if (!target) return;
    const root = document.documentElement;
    const savedScrollBehavior = root.style.scrollBehavior;
    if (!smooth || matchMedia("(prefers-reduced-motion: reduce)").matches)
      root.style.scrollBehavior = "auto";
    target.scrollIntoView({
      block: "start",
      behavior:
        smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "auto",
    });
    root.style.scrollBehavior = savedScrollBehavior;
    const hadTabindex = target.hasAttribute("tabindex");
    if (!hadTabindex) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    if (!hadTabindex)
      target.addEventListener(
        "blur",
        () => target.removeAttribute("tabindex"),
        { once: true },
      );
  }
  function follow(event: MouseEvent, id: string) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    pushState(`#${id}`, {});
    focusHash(id);
    mobileNav?.removeAttribute("open");
  }
  function top() {
    history.replaceState({}, "", location.pathname);
    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
    const heading = document.getElementById("heading");
    if (!heading) return;
    const hadTabindex = heading.hasAttribute("tabindex");
    if (!hadTabindex) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    if (!hadTabindex)
      heading.addEventListener(
        "blur",
        () => heading.removeAttribute("tabindex"),
        { once: true },
      );
  }
  onMount(() => {
    let cancelled = false;
    const id = decodeURIComponent(location.hash.slice(1));
    if (id)
      void whenPageSettled().then(() => {
        if (!cancelled) focusHash(id, false);
      });
    const scroll = () => (showTop = scrollY > 520);
    addEventListener("scroll", scroll, { passive: true });
    scroll();
    return () => {
      cancelled = true;
      removeEventListener("scroll", scroll);
    };
  });
</script>

<aside class="docs-nav" aria-label="Documentation navigation">
  <div class="desktop-rail">
    <nav
      class="desktop-nav"
      aria-labelledby="quick-links-heading"
      id="quick-links"
    >
      <p id="quick-links-heading" class="toc-heading">Quick links</p>
      <ul class="prose">
        {#each sections as section}<li>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions --><zbk-link
              href={"#" + section.id}
              onclick={(event: MouseEvent) => follow(event, section.id)}
              >{section.label}</zbk-link
            >
          </li>{/each}
        <li><hr class="prose margin-block-start-1 margin-block-end-05" /></li>
        <li>
          <zbk-link
            href="https://github.com/mzebley/dynamoblobs"
            target="_blank"
            rel="noopener">GitHub</zbk-link
          >
        </li>
        <li>
          <zbk-link
            href="https://www.npmjs.com/package/dynamoblobs"
            target="_blank"
            rel="noopener">npm</zbk-link
          >
        </li>
      </ul>
    </nav>
    <div
      class:visible={showTop}
      class="back-to-top-slot"
      inert={!showTop ? true : undefined}
    >
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions --><zbk-button
        variant="wave-action wave-pop lg"
        aria-label="Back to top"
        onclick={top}
        ><span slot="icon" data-position="start" aria-hidden="true"
          ><svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" /></svg
          ></span
        >Back to top</zbk-button
      >
    </div>
  </div>
  <details bind:this={mobileNav} class="mobile-nav">
    <summary class="toc-heading">Quick links</summary>
    <nav aria-label="Quick links">
      <ul class="prose">
        {#each sections as section}<li>
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions --><zbk-link
              href={"#" + section.id}
              onclick={(event: MouseEvent) => follow(event, section.id)}
              >{section.label}</zbk-link
            >
          </li>{/each}
        <li><hr class="prose"/></li>
        <li>
          <zbk-link
            href="https://github.com/mzebley/dynamoblobs"
            target="_blank"
            rel="noopener">GitHub</zbk-link
          >
        </li>
        <li>
          <zbk-link
            href="https://www.npmjs.com/package/dynamoblobs"
            target="_blank"
            rel="noopener">npm</zbk-link
          >
        </li>
      </ul>
    </nav>
  </details>
</aside>

<style>
  .docs-nav {
    min-inline-size: 0;
  }
  .desktop-rail {
    --docs-nav-sticky-inset: var(--zbk-spacing-2);
    position: sticky;
    inset-block-start: var(--docs-nav-sticky-inset);
    display: flex;
    flex-direction: column;
    block-size: calc(100svh - (var(--docs-nav-sticky-inset) * 2));
  }
  .desktop-nav {
    padding-inline: var(--zbk-spacing-105);
    padding-block: var(--zbk-spacing-1) var(--zbk-spacing-105);
    border: var(--zbk-border-width-sm) solid var(--zbk-info-border-subtle);
    background: var(--zbk-info-canvas-subtle);
    border-radius: var(--zbk-border-radius-lg);
    box-shadow: var(--zbk-spacing-05) var(--zbk-spacing-05) 0 0
      var(--zbk-accent-secondary-canvas-muted);
  }
  .desktop-nav li + li {
    margin-block-start: var(--zbk-spacing-025);
  }
  .back-to-top-slot {
    display: flex;
    justify-content: center;
    margin-block-start: auto;
    padding-block-start: var(--zbk-spacing-2);
    opacity: 0;
    visibility: hidden;
    transform: translateY(calc(100% + var(--docs-nav-sticky-inset)));
    transition:
      transform var(--zbk-transition-playful-motion-duration-default)
        var(--zbk-transition-playful-motion-function-default),
      opacity var(--zbk-transition-duration-default) ease,
      visibility 0s linear var(--zbk-transition-duration-default);
  }
  .back-to-top-slot.visible {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
    transition-delay: 0s;
  }
  .back-to-top-slot svg {
    inline-size: var(--zbk-spacing-105);
    block-size: var(--zbk-spacing-105);
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .toc-heading {
    color: var(--zbk-accent-secondary-ink-emphasis);
    margin-block-end: var(--zbk-spacing-025);
    font-size: var(--zbk-font-size-lg);
    font-weight: var(--zbk-font-weight-medium);
    font-family: var(--zbk-font-family-heading);
  }
  .mobile-nav {
    display: none;
  }
  @media (max-width: 64rem) {
    .desktop-rail {
      display: none;
    }
    .toc-heading {
      line-height: var(--zbk-line-height-3);
      margin-block-end: 0;
    }
    .mobile-nav {
      display: block;
      border: var(--zbk-border-width-sm) solid var(--zbk-info-border-subtle);
      background: var(--zbk-info-canvas-subtle);
      border-radius: var(--zbk-border-radius-lg);
      box-shadow: var(--zbk-spacing-05) var(--zbk-spacing-05) 0 0
        var(--zbk-accent-secondary-canvas-muted);
    }
    summary {
      min-block-size: var(--zbk-a11y-min-interaction-size);
      padding: var(--zbk-spacing-05) var(--zbk-spacing-1);
      cursor: pointer;
    }
    .mobile-nav nav {
      padding: 0 var(--zbk-spacing-1) var(--zbk-spacing-1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .back-to-top-slot {
      transition: none;
      transform: none;
    }
  }
</style>
