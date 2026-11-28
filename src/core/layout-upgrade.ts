/**
 * Phase 1 Home layout upgrade (pure, tested in tests/layout-upgrade.test.ts).
 * Opt-in and idempotent: it only touches the draft, never the published page.
 * - Adds "On my bench" right after the floor (or the hero, or at the top).
 * - Hides (does not delete) "A bit about me" and "I run my life on tools I built": the floor keeps reading the
 *   own-tools screenshots as device art, and both can be shown again from the editor.
 * - Keeps every other section, including custom ones, in its order with its sectionId and content.
 * - Adds "From the devlog" at the end only if it is missing.
 */
import type { Section } from "./module";
import { getModule } from "./registry";

const HIDE = new Set(["about-me-grid", "own-tools"]);

function fresh(moduleId: string, taken: Set<string>): Section {
  const m = getModule(moduleId);
  let id = moduleId;
  for (let i = 2; taken.has(id); i++) id = `${moduleId}-${i}`;
  return { sectionId: id, moduleId, moduleVersion: m?.version ?? 1, content: structuredClone(m?.defaults ?? {}) };
}

export function upgradeHomeLayout(sections: Section[]): { sections: Section[]; changed: boolean; notes: string[] } {
  const out = sections.map((s) => ({ ...s }));
  const notes: string[] = [];
  const taken = new Set(out.map((s) => s.sectionId));
  if (!out.some((s) => s.moduleId === "on-my-bench")) {
    const anchor = ["featured-floor", "home-hero"].map((id) => out.findIndex((s) => s.moduleId === id)).find((i) => i >= 0) ?? -1;
    const bench = fresh("on-my-bench", taken);
    out.splice(anchor + 1, 0, bench);
    taken.add(bench.sectionId);
    notes.push("Added On my bench");
  }
  for (const s of out) {
    if (HIDE.has(s.moduleId) && !s.hidden) { s.hidden = true; notes.push(`Hid ${getModule(s.moduleId)?.name ?? s.moduleId} (kept, can be shown again)`); }
  }
  if (!out.some((s) => s.moduleId === "devlog-strip")) { out.push(fresh("devlog-strip", taken)); notes.push("Added From the devlog"); }
  return { sections: out, changed: notes.length > 0, notes };
}
