/**
 * Island lifecycle helper (architecture §9.3): mounts on astro:page-load, cleans up on astro:before-swap.
 * A crashing island leaves its static HTML in place (§11).
 */
export type Unmount = () => void;
export type Mount = (root: HTMLElement) => Unmount | void;

export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const registered = new Set<string>();

export function onPage(selector: string, mount: Mount): void {
  if (registered.has(selector)) return;
  registered.add(selector);
  let cleanups: Unmount[] = [];
  document.addEventListener("astro:page-load", () => {
    document.querySelectorAll<HTMLElement>(selector).forEach((root) => {
      try {
        const u = mount(root);
        if (u) cleanups.push(u);
      } catch (err) {
        console.error(`[island] ${selector} failed to mount`, err);
      }
    });
  });
  document.addEventListener("astro:before-swap", () => {
    cleanups.forEach((u) => { try { u(); } catch { /* ignore */ } });
    cleanups = [];
  });
}
