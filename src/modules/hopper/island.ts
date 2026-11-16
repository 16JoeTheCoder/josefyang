/**
 * The hopper (03-pages Failures). Pointer drag (not HTML5 drag-and-drop) drops a tile into the hopper;
 * a tap or click feeds it straight in; keyboard users focus a tile and press it or "Feed it in".
 * Reduced motion never mounts this: CSS shows the list of expandable slips instead.
 */
import { gsap } from "gsap";
import { reducedMotion, type Unmount } from "../../core/island";

export function mountHopper(root: HTMLElement): Unmount | void {
  if (reducedMotion()) return;
  const tiles = [...root.querySelectorAll<HTMLButtonElement>("[data-tile]")];
  const mouth = root.querySelector<HTMLElement>("[data-mouth]");
  const paper = root.querySelector<HTMLElement>("[data-paper]");
  const feedBtn = root.querySelector<HTMLButtonElement>("[data-feed]");
  const slips = [...root.querySelectorAll<HTMLElement>("[data-slip]")];
  const wait = root.querySelector<HTMLElement>("[data-wait]");
  const panel = root.querySelector<HTMLElement>("[data-panel]");
  if (!mouth || !tiles.length) return;

  let selected = tiles[0]!;
  let busy = false;
  const select = (t: HTMLButtonElement) => {
    selected = t;
    tiles.forEach((x) => x.setAttribute("aria-pressed", x === t ? "true" : "false"));
  };
  select(selected);

  const show = (slug: string) => {
    if (wait) wait.hidden = true;
    slips.forEach((s) => { s.hidden = s.dataset.slip !== slug; });
    const r = panel?.getBoundingClientRect();
    if (panel && r && r.top > window.innerHeight * 0.85) panel.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const feed = (t: HTMLButtonElement) => {
    if (busy) return;
    busy = true;
    select(t);
    const tr = t.getBoundingClientRect();
    const mr = mouth.getBoundingClientRect();
    const dx = mr.left + mr.width / 2 - (tr.left + tr.width / 2) + Number(gsap.getProperty(t, "x"));
    const dy = mr.top + 10 - (tr.top + tr.height / 2) + Number(gsap.getProperty(t, "y"));
    gsap.timeline({ onComplete: () => { busy = false; } })
      .to(t, { x: dx, y: dy, rotation: 0, scale: 0.3, duration: 0.55, ease: "expo.in" })
      .to(t, { opacity: 0, duration: 0.12 }, "-=0.12")
      .add(() => show(t.dataset.tile!))
      .fromTo(paper, { height: 40 }, { height: 150, duration: 0.6, ease: "expo.out" })
      .to(paper, { height: 40, duration: 0.5, ease: "power2.inOut" }, "+=0.5")
      .set(t, { x: 0, y: 0, scale: 0.9 }, "<")
      .to(t, { opacity: 1, scale: 1, duration: 0.4, ease: "expo.out" }, "<");
  };

  // Pointer drag
  let drag: { t: HTMLButtonElement; x: number; y: number; moved: boolean; id: number } | null = null;
  let suppressClick = false;
  const onDown = (e: PointerEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-tile]");
    if (!t || busy || e.button !== 0) return;
    drag = { t, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.t.setPointerCapture(e.pointerId); drag.t.classList.add("is-drag"); }
    gsap.set(drag.t, { x: dx, y: dy });
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) return; // a plain click: handled by onClick
    suppressClick = true;
    d.t.classList.remove("is-drag");
    const tr = d.t.getBoundingClientRect();
    const mr = mouth.getBoundingClientRect();
    const cx = tr.left + tr.width / 2;
    const cy = tr.top + tr.height / 2;
    const inside = cx > mr.left - 40 && cx < mr.right + 40 && cy > mr.top - 80 && cy < mr.top + mr.height * 0.7;
    if (inside) feed(d.t);
    else gsap.to(d.t, { x: 0, y: 0, duration: 0.5, ease: "expo.out" });
  };
  const onClick = (e: MouseEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-tile]");
    if (!t) return;
    if (suppressClick) { suppressClick = false; return; }
    feed(t);
  };
  const onFocus = (e: FocusEvent) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-tile]");
    if (t) select(t);
  };
  const onFeed = () => feed(selected);

  root.addEventListener("pointerdown", onDown);
  root.addEventListener("pointermove", onMove);
  root.addEventListener("pointerup", onUp);
  root.addEventListener("pointercancel", onUp);
  root.addEventListener("click", onClick);
  root.addEventListener("focusin", onFocus);
  feedBtn?.addEventListener("click", onFeed);

  return () => {
    root.removeEventListener("pointerdown", onDown);
    root.removeEventListener("pointermove", onMove);
    root.removeEventListener("pointerup", onUp);
    root.removeEventListener("pointercancel", onUp);
    root.removeEventListener("click", onClick);
    root.removeEventListener("focusin", onFocus);
    feedBtn?.removeEventListener("click", onFeed);
    gsap.killTweensOf([...tiles, paper]);
  };
}
