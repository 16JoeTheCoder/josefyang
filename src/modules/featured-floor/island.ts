/**
 * Home floor pan (03-pages Home §2). Native scroll drives it: no wheel hijacking, so wheel, trackpad,
 * touch, scrollbar, zoom and keyboard all keep working. Scroll progress picks a stop; GSAP pans the
 * camera to it. Below 861px or with reduced motion this never runs and the CSS list layout shows.
 */
import { gsap } from "gsap";
import type { Unmount } from "../../core/island";

const QUERY = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";

export function mountFloor(root: HTMLElement): Unmount {
  const mq = window.matchMedia(QUERY);
  let teardown: Unmount | null = null;
  const sync = () => {
    teardown?.();
    teardown = mq.matches ? start(root) : null;
  };
  sync();
  mq.addEventListener("change", sync);
  const clock = startWatch(root);
  return () => { mq.removeEventListener("change", sync); teardown?.(); clock(); };
}

function start(root: HTMLElement): Unmount {
  const stage = root.querySelector<HTMLElement>("[data-floor-stage]")!;
  const plane = root.querySelector<HTMLElement>("[data-floor-plane]")!;
  const stops = [...root.querySelectorAll<HTMLElement>("[data-stop]")];
  const counter = root.querySelector<HTMLElement>("[data-floor-index]");
  const n = stops.length;
  let current = 0;
  let raf = 0;

  const top = () => root.getBoundingClientRect().top + window.scrollY;
  const seg = () => Math.max(1, (root.offsetHeight - window.innerHeight) / n);
  const indexFromScroll = () => Math.min(n - 1, Math.max(0, Math.floor((window.scrollY - top()) / seg())));
  const scrollToStop = (i: number) => window.scrollTo({ top: top() + (i + 0.5) * seg(), behavior: "instant" });

  const go = (i: number, animate = true) => {
    if (i === current && animate) return;
    current = i;
    stops.forEach((s, k) => s.classList.toggle("is-current", k === i));
    if (counter) counter.textContent = String(i + 1);
    const s = stops[i]!;
    const to = { "--cx": `${s.dataset.x}px`, "--cy": `${s.dataset.y}px` };
    if (!animate) { gsap.set(plane, to); return; }
    gsap.to(plane, { ...to, duration: 0.82, ease: "expo.out", overwrite: "auto" });
    gsap.fromTo(plane, { "--s": 0.975 }, { "--s": 1, duration: 0.9, ease: "expo.out", overwrite: false });
  };

  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; go(indexFromScroll()); });
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.target !== stage) return;
    const next = ["ArrowRight", "ArrowDown", "PageDown"].includes(e.key) ? current + 1
      : ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) ? current - 1 : null;
    if (next === null || next < 0 || next >= n) return; // past the ends: let the page scroll on
    e.preventDefault();
    scrollToStop(next);
  };

  // Tabbing to a button on another stop brings the camera there.
  const onFocus = (e: FocusEvent) => {
    const s = (e.target as HTMLElement).closest<HTMLElement>("[data-stop]");
    if (!s) return;
    const i = Number(s.dataset.stop);
    if (i !== indexFromScroll()) scrollToStop(i);
  };

  go(indexFromScroll(), false);
  window.addEventListener("scroll", onScroll, { passive: true });
  stage.addEventListener("keydown", onKey);
  stage.addEventListener("focusin", onFocus);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    stage.removeEventListener("keydown", onKey);
    stage.removeEventListener("focusin", onFocus);
    gsap.killTweensOf(plane);
    stops.forEach((s, k) => s.classList.toggle("is-current", k === 0));
  };
}

/** The watch on the floor shows the real time. */
function startWatch(root: HTMLElement): Unmount {
  const w = root.querySelector<SVGElement>("[data-watch]");
  if (!w) return () => {};
  const set = (sel: string, deg: number) => w.querySelector(sel)?.setAttribute("transform", `rotate(${deg} 70 45)`);
  const tick = () => {
    const d = new Date();
    set("[data-h]", ((d.getHours() % 12) + d.getMinutes() / 60) * 30);
    set("[data-m]", (d.getMinutes() + d.getSeconds() / 60) * 6);
    set("[data-s]", d.getSeconds() * 6);
  };
  tick();
  const id = window.setInterval(tick, 1000);
  return () => window.clearInterval(id);
}
