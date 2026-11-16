/** Definition of done: no raw hex colours or hard-coded URLs in module views (06-process §7). */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../src/modules");
const views = readdirSync(root).map((d) => join(root, d, "View.astro"));

describe("module views", () => {
  for (const v of views) {
    const src = readFileSync(v, "utf8");
    it(`${v.split("/").at(-2)}: no raw hex colours`, () => {
      expect(src.match(/#[0-9a-fA-F]{3,8}\b(?![\w-])/g) ?? []).toEqual([]);
    });
    it(`${v.split("/").at(-2)}: no hard-coded external URLs`, () => {
      expect(src.match(/https?:\/\/[^\s"'`]+/g) ?? []).toEqual([]);
    });
    it(`${v.split("/").at(-2)}: no literal sentences in the markup`, () => {
      const markup = src.split("---").slice(2).join("---").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/\{[^{}]*\}/g, "");
      const words = markup.replace(/<[^>]+>/g, " ").match(/[A-Za-z]{3,}(?:\s+[A-Za-z]{2,}){2,}/g) ?? [];
      expect(words).toEqual([]);
    });
  }
});
