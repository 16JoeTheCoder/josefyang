import { describe, expect, it } from "vitest";
import { buildFields, buildMetaDefaults } from "../src/core/build-fields";
import { fieldsToZod, publishProblems } from "../src/core/fields";
import { modules, schemas } from "../src/core/registry";
import { settingsDefaults, settingsFields } from "../src/core/settings";

describe("module registry (architecture §5.6)", () => {
  it("finds every module and every default validates and is publishable", () => {
    expect(Object.keys(modules).length).toBeGreaterThanOrEqual(20);
    for (const m of Object.values(modules)) {
      expect(schemas[m.id]!.safeParse(m.defaults).success, m.id).toBe(true);
      expect(publishProblems(m.fields, m.defaults), m.id).toEqual([]);
    }
  });
  it("islands are declared only where island.ts exists", async () => {
    const islands = Object.keys(import.meta.glob("../src/modules/*/island.ts"));
    for (const m of Object.values(modules)) {
      const has = islands.some((p) => p.includes(`/${m.id}/`));
      if (has) expect(m.island, m.id).toBe(true);
    }
  });
  it("settings and build defaults validate", () => {
    for (const [k, fs] of Object.entries(settingsFields)) expect(fieldsToZod(fs).safeParse(settingsDefaults[k as keyof typeof settingsDefaults]).success, k).toBe(true);
    expect(fieldsToZod(buildFields).safeParse(buildMetaDefaults()).success).toBe(true);
  });
});
