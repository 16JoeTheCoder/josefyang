/**
 * Projects character select (03-pages Projects). One state: the current index.
 * Native horizontal scroll-snap does the moving (touch, trackpad, wheel+shift, scrollbar all work);
 * we only read which card is centred. Lock-in = short exit animation, then navigate to /builds/<slug>.
 * The URL hash always names the current build, so "Back to the selector" (/projects#slug) lands on it.
 */
import { gsap } from "gsap";
import { navigate } from "astro:transitions/client";
import { reducedMotion, type Unmount } from "../../core/island";

export function mountSelector(root: HTMLElement): Unmount | void {
  const track = root.querySelector<HTMLElement>("[data-track]");
  if (!track) return;
  const cards = [...track.querySelectorAll<HTMLElement>("[data-card]")];
  const pos = root.querySelector<HTMLElement>("[data-pos]");
  const lock = root.querySelector<HTMLAnchorElement>("[data-lock]");
  const prev = root.querySelector<HTMLButtonElement>("[data-prev]");
  const next = root.querySelector<HTMLButtonElement>("[data-next]");
  if (reducedMotion()) return; // CSS shows a plain grid of links

  cards.forEach((c) => c.querySelector<HTMLElement>("[data-name-link]")?.setAttribute("tabindex", "-1"));
  let current = -1;
  let raf = 0;
  let locking = false;

  const set = (i: number) => {
    if (i === current) return;
    current = i;
    cards.forEach((c, k) => c.setAttribute("aria-selected", k === i ? "true" : "false"));
    const slug = cards[i]!.dataset.slug!;
    if (pos) pos.textContent = String(i + 1);
    if (lock) lock.href = `/builds/${slug}`;
    if (prev) prev.disabled = i === 0;
    if (next) next.disabled = i === cards.length - 1;
    history.replaceState(history.state, "", `#${slug}`);
  };

  const centre = (i: number, behavior: ScrollBehavior) => {
    const c = cards[Math.max(0, Math.min(cards.length - 1, i))]!;
    track.scrollTo({ left: c.offsetLeft - (track.clientWidth - c.offsetWidth) / 2, behavior });
  };

  const nearest = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let d = Infinity;
    cards.forEach((c, k) => { const dd = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (dd < d) { d = dd; best = k; } });
    return best;
  };

  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; set(nearest()); });
  };

  const doLock = (e?: Event) => {
    e?.preventDefault();
    if (locking) return;
    locking = true;
    const slug = cards[current]!.dataset.slug!;
    const card = cards[current]!;
    const tl = gsap.timeline({ onComplete: () => { void navigate(`/builds/${slug}`); } });
    tl.to(cards.filter((c) => c !== card), { opacity: 0, duration: 0.25, ease: "power2.out" }, 0)
      .to(root.querySelectorAll(".sel-head, .sel-controls, .sel-hint, .card-info"), { opacity: 0, y: 12, duration: 0.25, ease: "power2.out" }, 0)
      .to(card.querySelector(".card-img"), { scale: 1.06, duration: 0.45, ease: "expo.out" }, 0);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); centre(current + 1, "smooth"); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); centre(current - 1, "smooth"); }
    else if (e.key === "Home") { e.preventDefault(); centre(0, "smooth"); }
    else if (e.key === "End") { e.preventDefault(); centre(cards.length - 1, "smooth"); }
    else if (e.key === "Enter" || e.key === " ") doLock(e);
  };

  const onClick = (e: MouseEvent) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>("[data-card]");
    if (!card) return;
    const i = Number(card.dataset.index);
    e.preventDefault();
    if (i === current) doLock(); else centre(i, "smooth");
  };

  // Vertical wheel over the track moves sideways only while there is somewhere to go; then the page scrolls on.
  const onWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    const atStart = track.scrollLeft <= 1 && e.deltaY < 0;
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1 && e.deltaY > 0;
    if (atStart || atEnd) return;
    e.preventDefault();
    track.scrollBy({ left: e.deltaY, behavior: "auto" });
  };

  const fromHash = decodeURIComponent(location.hash.slice(1));
  const start = Math.max(0, cards.findIndex((c) => c.dataset.slug === fromHash));
  centre(start, "instant");
  set(start);

  track.addEventListener("scroll", onScroll, { passive: true });
  track.addEventListener("keydown", onKey);
  track.addEventListener("click", onClick);
  track.addEventListener("wheel", onWheel, { passive: false });
  const p = () => centre(current - 1, "smooth");
  const n = () => centre(current + 1, "smooth");
  prev?.addEventListener("click", p);
  next?.addEventListener("click", n);
  lock?.addEventListener("click", doLock);
  const onResize = () => centre(current, "instant");
  window.addEventListener("resize", onResize);

  return () => {
    cancelAnimationFrame(raf);
    track.removeEventListener("scroll", onScroll);
    track.removeEventListener("keydown", onKey);
    track.removeEventListener("click", onClick);
    track.removeEventListener("wheel", onWheel);
    prev?.removeEventListener("click", p);
    next?.removeEventListener("click", n);
    lock?.removeEventListener("click", doLock);
    window.removeEventListener("resize", onResize);
  };
}
