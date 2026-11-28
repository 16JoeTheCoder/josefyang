import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { modules } from "../src/core/registry";

const dir = join(__dirname, "../src/core/views");
describe("per-route view groups", () => {
  for (const file of readdirSync(dir).filter((f) => f !== "types.ts")) {
    const page = file.replace(/\.ts$/, "");
    it(`${page}: lists exactly the modules allowed on that page`, () => {
      const src = readFileSync(join(dir, file), "utf8");
      const listed = (src.match(/modules\/\{([^}]*)\}/)?.[1] ?? "").split(",").filter(Boolean).sort();
      const expected = Object.values(modules).filter((m) => (m.pages as string[]).includes(page)).map((m) => m.id).sort();
      expect(listed).toEqual(expected);
    });
  }
  it("every module belongs to a group", () => {
    const groups = readdirSync(dir).filter((f) => f !== "types.ts").map((f) => f.replace(/\.ts$/, ""));
    expect(Object.values(modules).filter((m) => !(m.pages as string[]).some((p) => groups.includes(p))).map((m) => m.id)).toEqual([]);
  });
});
