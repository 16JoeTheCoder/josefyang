import type { Unmount } from "../../core/island";

const GESTURE_GAP = 150;
const WHEEL_THRESHOLD = 32;
const GALLERY_ENTRY_TOLERANCE = 24;

export function mountSelector(root: HTMLElement): Unmount | void {
  const gallery = root.querySelector<HTMLElement>("[data-gallery]");
  const track = root.querySelector<HTMLElement>("[data-track]");
  if (!gallery || !track) return;
  const cards = [...track.querySelectorAll<HTMLElement>("[data-card]")];
  const details = [...root.querySelectorAll<HTMLElement>("[data-detail]")];
  const controls = root.querySelector<HTMLElement>("[data-controls]");
  const pos = root.querySelector<HTMLElement>("[data-pos]");
  const prev = root.querySelector<HTMLButtonElement>("[data-prev]");
  const next = root.querySelector<HTMLButtonElement>("[data-next]");
  const last = cards.length - 1;
  if (last < 0) return;
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const events = new AbortController();
  const { signal } = events;
  let current = -1;
  let movingTo: number | null = null;
  let scrollEndTimer = 0;
  let wheelAt = -Infinity;
  let wheelDirection = 0;
  let wheelAmount = 0;
  let wheelClaimed = false;
  let wheelOwner: "page" | "gallery" = "page";
  let overviewOpen = false;
  let lastPageY = window.scrollY;

  function select(index: number, updateHash = true) {
    if (current === index) return;
    if (cards[current]?.contains(document.activeElement)) track!.focus({ preventScroll: true });
    current = index;
    cards.forEach((card, i) => {
      card.toggleAttribute("data-active", i === index);
      const link = card.querySelector<HTMLAnchorElement>("[data-select]");
      if (link) link.tabIndex = i === index ? 0 : -1;
      details[i]!.hidden = i !== index;
    });
    if (pos) pos.textContent = String(index + 1).padStart(2, "0");
    prev?.setAttribute("aria-disabled", String(index === 0));
    next?.setAttribute("aria-disabled", String(index === last));
    if (updateHash) history.replaceState(history.state, "", "#" + cards[index]!.dataset.slug);
  }

  function center(index: number, smooth: boolean) {
    const card = cards[index]!;
    const left = track!.scrollLeft + card.getBoundingClientRect().left - track!.getBoundingClientRect().left
      - (track!.clientWidth - card.offsetWidth) / 2;
    track!.scrollTo({ left, behavior: smooth && !motion.matches ? "smooth" : "instant" });
  }

  function finishScroll() {
    clearTimeout(scrollEndTimer);
    movingTo = null;
    const middle = track!.getBoundingClientRect().left + track!.clientWidth / 2;
    let closest = current;
    let distance = Infinity;
    cards.forEach((card, i) => {
      const rect = card.getBoundingClientRect();
      const delta = Math.abs(rect.left + rect.width / 2 - middle);
      if (delta < distance) { closest = i; distance = delta; }
    });
    if (closest >= 0) select(closest);
  }

  function go(index: number, smooth = true, updateHash = true) {
    const destination = Math.min(last, Math.max(0, index));
    movingTo = destination;
    select(destination, updateHash);
    center(destination, smooth);
    clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(finishScroll, 650);
  }

  function atGallery() {
    const bounds = gallery!.getBoundingClientRect();
    return bounds.top >= -GALLERY_ENTRY_TOLERANCE && bounds.top < innerHeight * .5;
  }

  function open(smooth = true, record = true) {
    const detail = details[current];
    if (!detail) return;
    overviewOpen = true;
    const hash = "#" + detail.id;
    if (record && location.hash !== hash) history.pushState(history.state, "", hash);
    detail.focus({ preventScroll: true });
    detail.scrollIntoView({ block: "start", behavior: smooth && !motion.matches ? "smooth" : "instant" });
  }

  function returnToGallery(smooth = true, record = true) {
    overviewOpen = false;
    if (record) history.replaceState(history.state, "", "#" + cards[current]!.dataset.slug);
    track!.focus({ preventScroll: true });
    gallery!.scrollIntoView({ block: "start", behavior: smooth && !motion.matches ? "smooth" : "instant" });
  }

  function onPageScroll() {
    const movingUp = window.scrollY < lastPageY;
    lastPageY = window.scrollY;
    if (!movingUp || !atGallery()) return;
    if (overviewOpen) {
      overviewOpen = false;
      history.replaceState(history.state, "", "#" + cards[current]!.dataset.slug);
    }
    if (details[current]?.contains(document.activeElement)) track!.focus({ preventScroll: true });
  }

  function beginWheel(event: WheelEvent, owner: "page" | "gallery") {
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const delta = horizontal ? event.deltaX : event.deltaY;
    if (!delta || event.ctrlKey || event.metaKey) return 0;
    const direction = Math.sign(delta);
    const now = performance.now();
    if (now - wheelAt > GESTURE_GAP || direction !== wheelDirection) {
      wheelOwner = owner;
      wheelAmount = 0;
      wheelClaimed = false;
    }
    wheelAt = now;
    wheelDirection = direction;
    return delta;
  }

  function onOutsideWheel(event: WheelEvent) {
    if (!event.composedPath().includes(gallery!)) beginWheel(event, "page");
  }

  function onWheel(event: WheelEvent) {
    if (last === 0) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const canBrowse = horizontal || atGallery();
    const delta = beginWheel(event, canBrowse ? "gallery" : "page");
    if (!delta || !canBrowse || wheelOwner === "page" || !event.cancelable) return;
    if (wheelClaimed) { event.preventDefault(); return; }
    const destination = current + Math.sign(delta);
    if (destination < 0 || destination > last) { wheelOwner = "page"; return; }
    event.preventDefault();
    wheelAmount += Math.abs(delta) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track!.clientWidth : 1);
    if (wheelAmount >= WHEEL_THRESHOLD) {
      wheelClaimed = true;
      go(destination);
    }
  }

  function onKey(event: KeyboardEvent) {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    const element = event.target as HTMLElement;
    if (element.closest("input, textarea, select, [contenteditable], [popover]:popover-open")) return;
    if (details[current]?.contains(element) && (event.key === "ArrowUp" || event.key === "Escape")) {
      event.preventDefault();
      if (!event.repeat) returnToGallery();
      return;
    }
    if (!gallery!.contains(element) && element !== document.body && element !== document.documentElement) return;
    if (!atGallery()) return;
    const index = event.key === "ArrowRight" ? current + 1 : event.key === "ArrowLeft" ? current - 1
      : event.key === "Home" ? 0 : event.key === "End" ? last : null;
    const isAction = element.closest("a, button");
    const activates = event.key === "ArrowDown"
      || (event.key === " " && (element.closest("[data-select]") || !isAction))
      || (event.key === "Enter" && !isAction);
    if (index === null && !activates) return;
    event.preventDefault();
    if (event.repeat) return;
    if (index !== null) go(index);
    else open();
  }

  function fromHash() {
    const hash = location.hash.slice(1);
    const index = cards.findIndex((card) => card.dataset.slug === hash || card.id === hash);
    const detail = details.findIndex((element) => element.id === hash);
    if (detail >= 0) {
      go(detail, false, false);
      open(false, false);
    } else if (index >= 0 || !hash || current < 0) {
      const returning = overviewOpen;
      go(Math.max(0, index), false, false);
      if (returning) returnToGallery(false, false);
    }
  }

  root.setAttribute("data-ready", "");
  if (controls) controls.hidden = false;
  fromHash();
  track.addEventListener("scroll", () => {
    clearTimeout(scrollEndTimer);
    scrollEndTimer = window.setTimeout(finishScroll, movingTo === null ? 100 : 180);
  }, { passive: true, signal });
  track.addEventListener("scrollend", finishScroll, { signal });
  gallery.addEventListener("wheel", onWheel, { passive: false, signal });
  document.addEventListener("keydown", onKey, { signal });
  prev?.addEventListener("click", () => { if (current > 0) go(current - 1); }, { signal });
  next?.addEventListener("click", () => { if (current < last) go(current + 1); }, { signal });
  track.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const element = event.target as HTMLElement;
    const card = element.closest<HTMLElement>("[data-card]");
    if (!card) return;
    const index = Number(card.dataset.index);
    if (index === current && !element.closest("[data-select], .slide-image")) return;
    event.preventDefault();
    if (index !== current) go(index);
    else open();
  }, { signal });
  const resize = new ResizeObserver(() => { if (current >= 0) center(current, false); });
  resize.observe(track);
  window.addEventListener("hashchange", fromHash, { signal });
  window.addEventListener("scroll", onPageScroll, { passive: true, signal });
  window.addEventListener("wheel", onOutsideWheel, { capture: true, passive: true, signal });
  root.addEventListener("click", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (!(event.target as HTMLElement).closest("[data-return]")) return;
    event.preventDefault();
    returnToGallery();
  }, { signal });

  return () => {
    events.abort();
    clearTimeout(scrollEndTimer);
    resize.disconnect();
  };
}
