/** Every committed project pack must import cleanly: schema, modules, paths, limits and media files present. */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkPack } from "../src/core/pack";

const root = join(__dirname, "../packs");
const packs = existsSync(root) ? readdirSync(root).filter((d) => existsSync(join(root, d, "project.json"))) : [];

describe("committed project packs", () => {
  for (const slug of packs) {
    it(`${slug}: passes the importer's checks`, () => {
      const dir = join(root, slug);
      const media = existsSync(join(dir, "media")) ? readdirSync(join(dir, "media")).map((f) => ({ name: `media/${f}`, size: statSync(join(dir, "media", f)).size })) : [];
      const entries = [{ name: "project.json", size: statSync(join(dir, "project.json")).size }, ...media];
      const res = checkPack(entries, JSON.parse(readFileSync(join(dir, "project.json"), "utf8")));
      expect(res.problems).toEqual([]);
      expect(res.ok).toBe(true);
      expect(res.pack?.slug).toBe(slug);
    });
  }
});
