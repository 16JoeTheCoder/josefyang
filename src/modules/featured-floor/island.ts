import type { Unmount } from "../../core/island";

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
const mix = (from: number, to: number, t: number) => from + (to - from) * t;

export function mountFloor(root: HTMLElement): Unmount | void {
  const stage = root.querySelector<HTMLElement>("[data-stage]");
  const scene = root.querySelector<HTMLElement>("[data-scene]");
  const world = root.querySelector<HTMLElement>("[data-world]");
  const controls = root.querySelector<HTMLElement>("[data-floor-controls]");
  if (!stage || !scene || !world || !controls) return;

  const pieces = [...world.querySelectorAll<HTMLElement>("[data-piece]")];
  const specs = [...root.querySelectorAll<HTMLElement>("[data-spec]")];
  const buttons = [...controls.querySelectorAll<HTMLButtonElement>("[data-floor-go]")];
  const prev = controls.querySelector<HTMLButtonElement>("[data-floor-prev]")!;
  const next = controls.querySelector<HTMLButtonElement>("[data-floor-next]")!;
  const counter = controls.querySelector<HTMLElement>("[data-floor-count]");
  const status = controls.querySelector<HTMLElement>("[data-floor-status]")!;
  const motion = matchMedia("(prefers-reduced-motion: reduce), (max-height: 580px)");
  const points = pieces.map(({ dataset }) => ({ x: Number(dataset.x), y: Number(dataset.y) }));
  const last = points.length - 1;
  if (last < 0) return;
  let current = -1;
  let target: number | null = null;
  let frame = 0;
  let settle = 0;
  let origin = 0;
  let step = 1;
  let scale = 1;

  function select(index: number) {
    if (current === index) return;
    if (specs[current]?.contains(document.activeElement)) stage!.focus({ preventScroll: true });
    current = index;
    pieces.forEach((piece, i) => piece.classList.toggle("is-current", i === index));
    specs.forEach((spec, i) => { spec.hidden = i !== index; });
    buttons.forEach((button, i) => {
      if (i === index) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
    });
    prev.setAttribute("aria-disabled", String(index === 0));
    next.setAttribute("aria-disabled", String(index === last));
    if (counter) counter.textContent = String(index + 1).padStart(2, "0");
    status.textContent = (buttons[index]?.getAttribute("aria-label") ?? "") + ", " + (index + 1) + " / " + (last + 1);
  }

  function render() {
    frame = 0;
    const pinned = root.hasAttribute("data-pinned");
    const position = pinned ? clamp((window.scrollY - origin) / step, last) : Math.max(0, current);
    const from = Math.floor(position);
    const to = Math.min(last, from + 1);
    const fraction = position - from;
    const t = fraction * fraction * (3 - 2 * fraction);
    const overview = pinned && from === 0 ? .18 * (1 - t) : 0;
    const zoom = scale * (1 - overview - .13 * Math.sin(Math.PI * fraction));
    const x = mix(points[from]!.x, points[to]!.x, t) + (points[1]?.x ?? 0) * overview * .75;
    const y = mix(points[from]!.y, points[to]!.y, t) + (points[1]?.y ?? 0) * overview * .75;
    world!.style.transform = "translate3d(" + (-x * zoom) + "px," + (-y * zoom) + "px,0) scale(" + zoom + ")";
    select(Math.round(position));
  }

  function measure() {
    origin = root.getBoundingClientRect().top + window.scrollY;
    step = Math.max(1, stage!.clientHeight * .6);
    scale = Math.max(.23, Math.min(1.12, scene!.clientWidth / (innerWidth <= 720 ? 590 : 780), scene!.clientHeight / 490));
    render();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }

  function go(index: number) {
    const destination = clamp(index, last);
    if (!root.hasAttribute("data-pinned")) {
      select(destination);
      render();
      return;
    }
    target = destination;
    window.scrollTo({ top: origin + destination * step, behavior: "smooth" });
    clearTimeout(settle);
    settle = window.setTimeout(() => { target = null; }, 750);
  }

  function onKey(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
    const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;
    const element = event.target as HTMLElement;
    if (element.closest("input, textarea, select, [contenteditable], [popover]:popover-open")) return;
    if (!root.contains(element) && element !== document.body && element !== document.documentElement) return;
    const rect = stage!.getBoundingClientRect();
    if (rect.top > 80 || rect.bottom < innerHeight * .55) return;
    if (event.repeat) { event.preventDefault(); return; }
    const destination = (target ?? current) + direction;
    if (destination < 0 || destination > last) return;
    event.preventDefault();
    go(destination);
  }

  function onClick(event: MouseEvent) {
    const element = (event.target as HTMLElement).closest<HTMLElement>("[data-floor-go], [data-floor-prev], [data-floor-next], [data-floor-skip]");
    if (!element) return;
    if (element.hasAttribute("data-floor-skip")) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const id = element.getAttribute("href")?.slice(1);
      if (!id) return;
      const exit = document.getElementById(id);
      if (exit) {
        event.preventDefault();
        exit.focus({ preventScroll: true });
        window.scrollTo({ top: exit.getBoundingClientRect().top + window.scrollY, behavior: motion.matches ? "instant" : "smooth" });
      }
      return;
    }
    if (element.getAttribute("aria-disabled") === "true") return;
    const index = target ?? current;
    go(element.dataset.floorGo != null ? Number(element.dataset.floorGo) : index + (element === next ? 1 : -1));
  }

  function releaseTarget() {
    clearTimeout(settle);
    target = null;
  }

  function syncMotion() {
    const leavingPinned = root.hasAttribute("data-pinned") && motion.matches;
    const wasInStage = stage!.getBoundingClientRect().bottom > innerHeight / 2;
    root.toggleAttribute("data-pinned", !motion.matches && last > 0);
    measure();
    if (leavingPinned && wasInStage) window.scrollTo({ top: origin, behavior: "instant" });
  }

  const hour = root.querySelector<HTMLElement>("[data-hour]");
  const minute = root.querySelector<HTMLElement>("[data-minute]");
  function updateWatch() {
    const date = new Date();
    if (hour) hour.style.rotate = (date.getHours() % 12 * 30 + date.getMinutes() / 2) + "deg";
    if (minute) minute.style.rotate = (date.getMinutes() * 6) + "deg";
  }
  updateWatch();
  const watchTimer = hour ? window.setInterval(updateWatch, 60_000) : 0;

  root.setAttribute("data-ready", "");
  controls.hidden = false;
  syncMotion();
  const resize = new ResizeObserver(measure);
  resize.observe(stage);
  resize.observe(scene);
  if (location.hash === "#featured") window.scrollTo({ top: origin, behavior: "instant" });
  motion.addEventListener("change", syncMotion);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("wheel", releaseTarget, { passive: true });
  window.addEventListener("touchstart", releaseTarget, { passive: true });
  document.addEventListener("keydown", onKey);
  root.addEventListener("click", onClick);

  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(settle);
    resize.disconnect();
    clearInterval(watchTimer);
    motion.removeEventListener("change", syncMotion);
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("wheel", releaseTarget);
    window.removeEventListener("touchstart", releaseTarget);
    document.removeEventListener("keydown", onKey);
    root.removeEventListener("click", onClick);
  };
}
