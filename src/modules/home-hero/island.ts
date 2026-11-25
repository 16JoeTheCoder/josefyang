/**
 * Workshop desk (Home hero). Native scroll, never hijacked: crossing a scroll threshold plays a
 * fixed-length tween (lid opens, name lifts away); scrolling back past it reverses. The screen then
 * loops name → line → invitation. Below 861px, with reduced motion or without JS the CSS shows the
 * open laptop as a still composition and this never runs (except the link focus helper).
 */
import { gsap } from "gsap";
import { reducedMotion, type Unmount } from "../../core/island";

const QUERY = "(min-width: 861px) and (prefers-reduced-motion: no-preference)";
const OPEN_AT = 0.1; // share of the section's scroll travel
const CLOSE_AT = 0.06; // hysteresis so a resting trackpad never flickers the lid

export function mountDesk(root: HTMLElement): Unmount {
  const unlink = wireLink(root);
  const mq = window.matchMedia(QUERY);
  let teardown: Unmount | null = null;
  const sync = () => { teardown?.(); teardown = mq.matches ? start(root) : null; };
  sync();
  mq.addEventListener("change", sync);
  return () => { mq.removeEventListener("change", sync); teardown?.(); unlink(); };
}

/** "Scroll to projects" lands on the first featured build and moves focus there. */
function wireLink(root: HTMLElement): Unmount {
  const link = root.querySelector<HTMLAnchorElement>("[data-desk-link]");
  if (!link || link.getAttribute("href") !== "#featured") return () => {};
  const onClick = (e: MouseEvent) => {
    const floor = document.getElementById("featured");
    if (!floor) return;
    e.preventDefault();
    const y = floor.getBoundingClientRect().top + window.scrollY + 2;
    window.scrollTo({ top: y, behavior: reducedMotion() ? "instant" : "smooth" });
    floor.querySelector<HTMLElement>("[data-stop]")?.focus({ preventScroll: true });
    history.replaceState(null, "", "#featured");
  };
  link.addEventListener("click", onClick);
  return () => link.removeEventListener("click", onClick);
}

function start(root: HTMLElement): Unmount {
  const title = root.querySelector<HTMLElement>("[data-desk-title]")!;
  const glow = root.querySelector<HTMLElement>("[data-glow]");
  const laptop = root.querySelector<HTMLElement>("[data-laptop]")!;
  const beats = [...root.querySelectorAll<HTMLElement>("[data-beat]")];
  const pause = root.querySelector<HTMLButtonElement>("[data-desk-pause]");
  const pauseText = root.querySelector<HTMLElement>("[data-desk-pause-text]");

  let open = false;
  let userPaused = false;
  let visible = true;
  let raf = 0;

  // Screen loop: ~2s name, ~4s line, ~2s invitation, crossfades included.
  const loop = gsap.timeline({ paused: true, repeat: -1 });
  const [name, line, cta] = beats;
  if (name && line && cta) {
    loop
      .set([line, cta], { autoAlpha: 0 }).set(name, { autoAlpha: 1 })
      .to(name, { autoAlpha: 0, duration: 0.4 }, 1.8)
      .fromTo(line, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out" }, 2.1)
      .to(line, { autoAlpha: 0, duration: 0.4 }, 5.8)
      .fromTo(cta, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: "expo.out" }, 6.1)
      .to(cta, { autoAlpha: 0, duration: 0.4 }, 7.7)
      .to(name, { autoAlpha: 1, duration: 0.4 }, 8.0);
  }
  const shouldRun = () => open && visible && !userPaused && !document.hidden;
  const syncLoop = () => {
    if (shouldRun()) loop.play(); else loop.pause();
    root.toggleAttribute("data-offscreen", !visible || document.hidden);
  };

  const setOpen = (next: boolean, animate = true) => {
    if (next === open && animate) return;
    open = next;
    const d = animate ? 1 : 0;
    gsap.to(root, { "--open": next ? 158 : 0, duration: next ? 1.05 * d : 0.7 * d, ease: next ? "power3.inOut" : "power2.inOut", overwrite: "auto" });
    gsap.to(title, { autoAlpha: next ? 0 : 1, y: next ? -48 : 0, duration: 0.6 * d, ease: "expo.out", overwrite: "auto" });
    if (glow) gsap.to(glow, { opacity: next ? 1 : 0, duration: 0.9 * d, delay: next ? 0.45 * d : 0, ease: "power1.out", overwrite: "auto" });
    if (!next) { loop.pause(0); }
    else gsap.delayedCall(0.7 * d, syncLoop);
    syncLoop();
  };

  const progress = () => {
    const r = root.getBoundingClientRect();
    const travel = Math.max(1, root.offsetHeight - window.innerHeight);
    return -r.top / travel;
  };
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const p = progress();
      if (!open && p >= OPEN_AT) setOpen(true);
      else if (open && p < CLOSE_AT) setOpen(false);
    });
  };

  const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; syncLoop(); });
  io.observe(root);
  const onVis = () => syncLoop();
  document.addEventListener("visibilitychange", onVis);

  const onPause = () => {
    userPaused = !userPaused;
    pause?.setAttribute("aria-pressed", String(userPaused));
    if (pauseText && pause) pauseText.textContent = (userPaused ? pause.dataset.play : pause.dataset.pause) ?? "";
    root.toggleAttribute("data-paused", userPaused);
    syncLoop();
  };
  if (pause) { pause.hidden = false; pause.addEventListener("click", onPause); }

  setOpen(progress() >= OPEN_AT, false);
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVis);
    io.disconnect();
    pause?.removeEventListener("click", onPause);
    if (pause) pause.hidden = true;
    loop.kill();
    gsap.killTweensOf([laptop, root, title, glow]);
    gsap.set([laptop, root, title, glow, ...beats], { clearProps: "all" });
    root.removeAttribute("data-paused");
    root.removeAttribute("data-offscreen");
  };
}
