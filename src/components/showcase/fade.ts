/**
 * Crossfade between stacked panels (GSAP). Panels share one grid cell while the island is mounted;
 * the inactive ones carry `hidden`. With `instant` (reduced motion) panels just swap.
 */
import { gsap } from "gsap";

export function showPanel(panels: HTMLElement[], index: number, instant: boolean): void {
  const next = panels[index];
  if (!next) return;
  gsap.killTweensOf(panels);
  for (const p of panels) {
    if (p === next) continue;
    if (instant || p.hidden) { p.hidden = true; gsap.set(p, { clearProps: "opacity" }); continue; }
    gsap.to(p, { opacity: 0, duration: 0.28, ease: "power2.out", onComplete: () => { p.hidden = true; gsap.set(p, { clearProps: "opacity" }); } });
  }
  const wasHidden = next.hidden;
  next.hidden = false;
  if (instant || !wasHidden) { gsap.set(next, { clearProps: "opacity" }); return; }
  gsap.fromTo(next, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "power2.out", clearProps: "opacity" });
}

/** Start loading hidden images once the browser is idle, so the first swap is not blank. */
export function warmImages(root: HTMLElement): void {
  const run = () => root.querySelectorAll<HTMLImageElement>("img").forEach((i) => { i.loading = "eager"; });
  if ("requestIdleCallback" in window) window.requestIdleCallback(run); else setTimeout(run, 600);
}
