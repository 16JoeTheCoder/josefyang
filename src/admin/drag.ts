/** Pointer drag-to-reorder for a vertical list (same approach as the section editor). Only transforms move during the drag; the order commits on release. */
import { useRef, useState } from "preact/hooks";

interface DragState { from: number; to: number; dy: number; h: number }

export function useDragList(onMove: (from: number, to: number) => void) {
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const down = (i: number) => (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rects = ([...(listRef.current?.children ?? [])] as HTMLElement[]).map((el) => el.getBoundingClientRect());
    const h = rects[i]!.height + 8;
    const startY = e.clientY;
    let state: DragState = { from: i, to: i, dy: 0, h };
    setDrag(state);
    const mv = (ev: PointerEvent) => {
      const dy = ev.clientY - startY;
      const mid = rects[i]!.top + rects[i]!.height / 2 + dy;
      let to = i;
      rects.forEach((r, k) => { if (k < i && mid < r.top + r.height / 2) to = Math.min(to, k); if (k > i && mid > r.top + r.height / 2) to = Math.max(to, k); });
      state = { from: i, to, dy, h };
      setDrag(state);
    };
    const up = () => {
      window.removeEventListener("pointermove", mv);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      if (state.from !== state.to) onMove(state.from, state.to);
    };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const shift = (k: number): string | undefined => {
    if (!drag) return undefined;
    if (k === drag.from) return `transform: translateY(${drag.dy}px); z-index: 2; box-shadow: 0 18px 30px -18px rgb(0 0 0 / .35)`;
    if (drag.from < drag.to && k > drag.from && k <= drag.to) return `transform: translateY(${-drag.h}px)`;
    if (drag.from > drag.to && k < drag.from && k >= drag.to) return `transform: translateY(${drag.h}px)`;
    return "transform: none";
  };
  return { listRef, drag, down, shift };
}
