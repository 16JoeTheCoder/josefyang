/**
 * About print rig: as the section scrolls into view, one layer prints per milestone.
 * Reduced motion never mounts this, so the server-rendered final state (--p = printed) stays.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion, type Unmount } from "../../core/island";

gsap.registerPlugin(ScrollTrigger);

export function mountRig(root: HTMLElement): Unmount | void {
  if (reducedMotion()) return;
  const printed = Number(getComputedStyle(root).getPropertyValue("--printed")) || 0;
  if (!printed) return;
  const count = root.querySelector<HTMLElement>("[data-rig-count]");
  const items = [...root.querySelectorAll<HTMLElement>("[data-ms]")];
  let shown = -1;
  const set = (n: number) => {
    if (n === shown) return;
    shown = n;
    root.style.setProperty("--p", String(n));
    if (count) count.textContent = String(n);
    items.forEach((li, i) => li.classList.toggle("is-pending", i >= n));
  };
  set(0);
  const st = ScrollTrigger.create({
    trigger: root,
    start: "top 70%",
    end: "bottom 60%",
    onUpdate: (self) => set(Math.min(printed, Math.round(self.progress * printed + 0.49))),
    onLeave: () => set(printed),
  });
  // If the page loads already scrolled past the rig, show it fully printed.
  if (st.progress >= 1 || root.getBoundingClientRect().bottom < 0) set(printed);
  return () => { st.kill(); root.style.removeProperty("--p"); items.forEach((li) => li.classList.remove("is-pending")); };
}
