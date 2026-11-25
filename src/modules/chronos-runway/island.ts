/**
 * Chronos day runway island: drag the draft block, arrow keys, or the two presets.
 * Without JS (or if this fails) the static initial plan stays in place. Movement is user-driven, so it
 * stays available under reduced motion; CSS transitions are shortened globally in that case.
 */
import type { Unmount } from "../../core/island";
import { afterSync, budget, draftDuration, duration, end, fill, freeSlot, nextFree, original, slotStyle, snap, span, start } from "./day";

interface Messages { original: string; after: string; moved: string; busy: string; end: string; draftAria: string }

export function mountRunway(panel: HTMLElement): Unmount | void {
  const q = <T extends HTMLElement>(s: string) => panel.querySelector<T>(s)!;
  const track = q("[data-track]");
  const draft = q<HTMLButtonElement>("[data-draft]");
  const gaps = q("[data-gaps]");
  const longest = q<HTMLOutputElement>("[data-longest]");
  const unassigned = q<HTMLOutputElement>("[data-unassigned]");
  const note = q("[data-note]");
  const draftTime = q("[data-draft-time]");
  const presets = [...panel.querySelectorAll<HTMLButtonElement>("[data-slot]")];
  const msg = JSON.parse(panel.dataset.messages ?? "{}") as Messages;

  panel.querySelectorAll<HTMLElement>("[data-enhanced]").forEach((el) => { el.hidden = false; });
  draft.disabled = false;
  let minute = original;
  let drag: { id: number; from: number; preview: number } | null = null;

  const place = (next: number) => {
    draft.style.cssText = slotStyle([minute, minute + draftDuration]);
    if (!freeSlot(next)) { note.textContent = msg.busy; return; }
    minute = next;
    const model = budget(minute);
    const s = span(minute, minute + draftDuration);
    draftTime.textContent = s;
    draft.style.cssText = slotStyle([minute, minute + draftDuration]);
    draft.setAttribute("aria-label", fill(msg.draftAria, { time: s }));
    longest.value = duration(model.longest);
    unassigned.value = duration(model.unassigned);
    gaps.replaceChildren(...model.open.map((iv) => {
      const g = document.createElement("span");
      g.className = "rw-gap";
      g.dataset.updated = "true";
      g.style.cssText = slotStyle(iv);
      return g;
    }));
    presets.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.slot) === minute)));
    note.textContent = fill(minute === afterSync ? msg.after : minute === original ? msg.original : msg.moved, { time: s });
  };

  const onPreset = (e: Event) => place(Number((e.currentTarget as HTMLElement).dataset.slot));
  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = nextFree(minute, dir);
    if (next === null) note.textContent = msg.end; else place(next);
  };
  const onDown = (e: PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return;
    drag = { id: e.pointerId, from: e.clientX, preview: minute };
    draft.setPointerCapture(e.pointerId);
    draft.dataset.dragging = "true";
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const change = ((e.clientX - drag.from) / track.clientWidth) * (end - start);
    drag.preview = change === 0 ? minute : snap(minute + change);
    draft.style.cssText = slotStyle([drag.preview, drag.preview + draftDuration]);
    draft.dataset.invalid = String(!freeSlot(drag.preview));
  };
  const onEnd = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const next = e.type === "pointerup" ? drag.preview : minute;
    drag = null;
    delete draft.dataset.dragging;
    delete draft.dataset.invalid;
    place(next);
  };

  presets.forEach((b) => b.addEventListener("click", onPreset));
  draft.addEventListener("keydown", onKey);
  draft.addEventListener("pointerdown", onDown);
  draft.addEventListener("pointermove", onMove);
  draft.addEventListener("pointerup", onEnd);
  draft.addEventListener("pointercancel", onEnd);
  draft.addEventListener("lostpointercapture", onEnd);
  return () => {
    presets.forEach((b) => b.removeEventListener("click", onPreset));
    draft.removeEventListener("keydown", onKey);
    draft.removeEventListener("pointerdown", onDown);
    draft.removeEventListener("pointermove", onMove);
    draft.removeEventListener("pointerup", onEnd);
    draft.removeEventListener("pointercancel", onEnd);
    draft.removeEventListener("lostpointercapture", onEnd);
  };
}
