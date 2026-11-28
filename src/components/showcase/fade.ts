/**
 * Crossfade between stacked panels with the Web Animations API (no GSAP: keeps ~70 KB off project pages).
 * Panels share one grid cell while the island is mounted; the inactive ones carry `hidden`.
 * With `instant` (reduced motion) panels just swap.
 */
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export function showPanel(panels: HTMLElement[], index: number, instant: boolean): void {
  const next = panels[index];
  if (!next) return;
  for (const p of panels) p.getAnimations().forEach((a) => a.cancel());
  for (const p of panels) {
    if (p === next) continue;
    if (instant || p.hidden || !p.animate) { p.hidden = true; continue; }
    const out = p.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, easing: EASE });
    out.onfinish = () => { p.hidden = true; };
  }
  const wasHidden = next.hidden;
  next.hidden = false;
  if (instant || !wasHidden || !next.animate) return;
  next.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: EASE });
}

/**
 * Load the hidden panels' images only on intent (pointer over or focus on the controls), never all upfront.
 * Returns a cleanup function.
 */
export function warmOnIntent(controls: Element[], panelFor: (control: Element) => HTMLElement | undefined): () => void {
  const warm = (event: Event) => panelFor(event.currentTarget as Element)?.querySelectorAll("img").forEach((img) => { img.loading = "eager"; });
  for (const c of controls) { c.addEventListener("pointerenter", warm); c.addEventListener("focus", warm); }
  return () => { for (const c of controls) { c.removeEventListener("pointerenter", warm); c.removeEventListener("focus", warm); } };
}
