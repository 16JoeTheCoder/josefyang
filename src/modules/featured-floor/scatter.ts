/**
 * Seeded scatter for the Home floor (architecture §0.5): deterministic positions per build,
 * so the same builds always land in the same place, plus Josef's optional nudge.
 * Coordinates are px on the floor plane; stop i's centre is (x, y).
 */
export interface Stop { x: number; y: number }

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Direction of travel from one stop to the next: right, down-left, far right, down-left, up-right… */
const DIRS: [number, number][] = [[1, 0.42], [-0.82, 0.9], [1.12, 0.28], [-0.5, 1], [0.95, -0.55], [-1, 0.6]];
const STEP_X = 1240;
const STEP_Y = 820;

export function scatter(items: { slug: string; nudgeX: number; nudgeY: number }[]): Stop[] {
  const out: Stop[] = [];
  let x = 0;
  let y = 0;
  items.forEach((it, i) => {
    if (i > 0) {
      const r = rng(hash(it.slug));
      const [dx, dy] = DIRS[(i - 1) % DIRS.length]!;
      x += dx * STEP_X * (0.92 + r() * 0.16);
      y += dy * STEP_Y * (0.92 + r() * 0.16);
    }
    out.push({ x: Math.round(x + it.nudgeX), y: Math.round(y + it.nudgeY) });
  });
  return out;
}
