/**
 * Pure maths for the Studio North day runway (fictional schedule, minutes since midnight).
 * Ported from the Chronos portfolio handoff; no DOM, no Astro.
 */
export type Interval = readonly [start: number, end: number];

export const start = 10 * 60 + 21;
export const end = 18 * 60 + 30;
export const bufferStart = end - 30;
export const draftDuration = 40;
/** Where the draft starts in the original plan, and in the "after launch sync" preset. */
export const original = 13 * 60 + 45;
export const afterSync = 16 * 60 + 10;
export const step = 5;

export const fixed = [
  { label: "Creative review", at: [690, 720] },
  { label: "Lunch", at: [750, 810] },
  { label: "Launch sync", at: [930, 960] },
] as const;

export const planned = [
  { label: "Launch page", at: [640, 685] },
  { label: "Review footage", at: [720, 750] },
  { label: "Mobile QA", at: [865, 890] },
  { label: "Press kit", at: [890, 910] },
] as const;

const occupied: Interval[] = [...fixed, ...planned].map(({ at }) => at);

export const position = (minute: number) => ((minute - start) / (end - start)) * 100;
export const width = (minutes: number) => (minutes / (end - start)) * 100;
const two = (n: number) => String(n).padStart(2, "0");
export const clock = (minute: number) => `${two(Math.floor(minute / 60))}:${two(minute % 60)}`;
export const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${two(minutes % 60)}m`;
export const span = (from: number, to: number) => `${clock(from)}–${clock(to)}`;
export const slotStyle = ([from, to]: Interval) => `--left:${position(from)}%;--width:${width(to - from)}%`;

/** Replace {name} tokens in an editable sentence. Unknown tokens are left as written. */
export const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

export function freeSlot(minute: number) {
  const finish = minute + draftDuration;
  return minute >= start && finish <= bufferStart && occupied.every(([from, to]) => finish <= from || to <= minute);
}

export function budget(draft: number) {
  const blocks: Interval[] = [...occupied, [draft, draft + draftDuration]];
  blocks.sort(([a], [b]) => a - b);
  const open: Interval[] = [];
  let cursor = start;
  for (const [from, to] of blocks) {
    if (cursor < from) open.push([cursor, from]);
    cursor = Math.max(cursor, to);
  }
  if (cursor < bufferStart) open.push([cursor, bufferStart]);
  const minutes = ([from, to]: Interval) => to - from;
  return {
    open,
    longest: Math.max(0, ...open.map(minutes)),
    unassigned: open.reduce((sum, gap) => sum + minutes(gap), 0),
    workable: bufferStart - start - fixed.reduce((sum, item) => sum + minutes(item.at), 0),
  };
}

/** Next free start in a direction (-1 / +1) in 5-minute steps, or null. */
export function nextFree(from: number, direction: -1 | 1): number | null {
  for (let next = from + step * direction; next >= start && next <= end - draftDuration; next += step * direction) {
    if (freeSlot(next)) return next;
  }
  return null;
}

/** Snap a dragged start time to the 5-minute grid inside the day. */
export const snap = (minute: number) => Math.min(end - draftDuration, Math.max(start, Math.round(minute / step) * step));
