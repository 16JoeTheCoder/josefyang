import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { upgradeHomeLayout } from "../src/core/layout-upgrade";
import { validateSections } from "../src/core/content";
import { sectionProblems } from "../src/core/content";
import { MODULE_NEEDS, needsFor } from "../src/core/db";
import { modules } from "../src/core/registry";
import type { Section } from "../src/core/module";

const legacy = JSON.parse(readFileSync(join(__dirname, "fixtures/home-legacy.json"), "utf8")) as Section[];

describe("Home layout upgrade (opt-in draft)", () => {
  it("adds On my bench after the floor, hides (keeps) the older sections, keeps custom sections and IDs", () => {
    const { sections, changed } = upgradeHomeLayout(legacy);
    expect(changed).toBe(true);
    expect(sections.map((s) => s.moduleId)).toEqual(["home-hero", "featured-floor", "on-my-bench", "about-me-grid", "own-tools", "text-band", "devlog-strip"]);
    expect(sections.find((s) => s.moduleId === "own-tools")!.hidden).toBe(true);
    expect(sections.find((s) => s.moduleId === "about-me-grid")!.hidden).toBe(true);
    expect(sections.find((s) => s.sectionId === "custom-text")).toEqual(legacy[4]);
    expect(sections[0]).toEqual(legacy[0]);
  });
  it("is idempotent", () => {
    const once = upgradeHomeLayout(legacy).sections;
    const twice = upgradeHomeLayout(once);
    expect(twice.changed).toBe(false);
    expect(twice.sections).toEqual(once);
  });
  it("does not mutate its input", () => {
    const copy = structuredClone(legacy);
    upgradeHomeLayout(legacy);
    expect(legacy).toEqual(copy);
  });
  it("keeps Josef's saved headline and the result validates; the long name now fits one step down instead of blocking publish", () => {
    const v = validateSections(upgradeHomeLayout(legacy).sections);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect((v.sections[0]!.content as { headline: { value: string } }).headline.value).toBe("BuiltByJosef Portfolio");
    expect(sectionProblems(v.sections)).toEqual([]);
  });
});

describe("bounded reads", () => {
  it("every registered module declares its data needs", () => {
    expect(Object.keys(modules).filter((id) => !(id in MODULE_NEEDS))).toEqual([]);
  });
  it("Home reads at most ten lean devlog rows and no milestones", () => {
    const n = needsFor(upgradeHomeLayout(legacy).sections);
    expect(n.devlog).toEqual({ limit: 10, full: false, games: false });
    expect(n.milestones).toBeUndefined();
  });
  it("unknown (legacy/custom) modules fall back to the full read", () => {
    const n = needsFor([{ sectionId: "x", moduleId: "retired-module", moduleVersion: 1, content: {} }]);
    expect(n.devlog?.full).toBe(true);
    expect(n.milestones).toBe(true);
  });
  it("the Games journey reads at most six game-related rows", () => {
    const n = needsFor(["games-journey", "games-evidence", "games-updates"].map((m) => ({ sectionId: m, moduleId: m, moduleVersion: 1, content: {} })));
    expect(n.devlog).toEqual({ limit: 6, full: false, games: true });
  });
});

describe("devlog need merging", () => {
  const s = (m: string) => ({ sectionId: m, moduleId: m, moduleVersion: 1, content: {} });
  it("a general strip next to the games list widens enough for the games filter", () => {
    const n = needsFor([s("devlog-strip"), s("games-updates")]);
    expect(n.devlog).toEqual({ limit: 60, full: false, games: false });
  });
});
