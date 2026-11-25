import { describe, expect, it } from "vitest";
import { f, noImage, noVideo, t, type Fields } from "../src/core/fields";
import { checkEntries, checkPack, docFromPack, listFileRefs, packFromDoc, packSchema, pathProblem, resolveRefs, PACK_LIMITS } from "../src/core/pack";
import { modules } from "../src/core/registry";

const fields: Fields = {
  title: f.heading("Title", { max: 40, maxLines: 2 }),
  hero: f.image("Hero", "16 / 9", ["fill", "fit"], "x"),
  clip: f.video("Clip", "x"),
  items: f.list("Items", "Item", { pic: f.image("Pic", "1 / 1", ["fill"], "x") }, 0, 5),
};
const fake = { id: "fake", name: "Fake", version: 1, description: "", fields, defaults: { title: t("T"), hero: noImage(), clip: noVideo(), items: [] }, island: false, pages: [] as never[] };
const gm = (id: string) => (id === "fake" ? (fake as never) : modules[id]);
const up = (k: string) => ({ mediaId: `id-${k}`, key: `m/${k}`, original: "orig.webp", widths: [480, 960], w: 1200, h: 800, transparent: false });
const pack = (content: unknown, meta: unknown = {}) => ({ format: "josefyang-project/1", slug: "demo", meta, sections: [{ moduleId: "fake", content }] });
const entries = (...n: string[]) => [{ name: "project.json", size: 100 }, ...n.map((name) => ({ name, size: 1000 }))];

describe("paths and limits", () => {
  it("accepts project.json and media/<name>", () => {
    expect(pathProblem("project.json")).toBeNull();
    expect(pathProblem("media/a-b_c.1.webp")).toBeNull();
    expect(pathProblem("media/clip.mp4")).toBeNull();
  });
  it("rejects traversal, absolute, nested, odd names and types", () => {
    for (const bad of ["../x.webp", "media/../x.webp", "/etc/passwd", "C:/x.png", "media/a/b.webp", "other/x.webp", "media/a b.webp", "media\\x.webp", "media/x.gif", "media/x.exe", "media/.."]) {
      expect(pathProblem(bad), bad).not.toBeNull();
    }
  });
  it("enforces file count, total and per-file size", () => {
    expect(checkEntries(Array.from({ length: 61 }, (_, i) => ({ name: i ? `media/a${i}.webp` : "project.json", size: 1 }))).join()).toMatch(/Too many files/);
    expect(checkEntries([{ name: "project.json", size: 1 }, { name: "media/big.mp4", size: PACK_LIMITS.fileBytes + 1 }]).join()).toMatch(/per file/);
    expect(checkEntries(Array.from({ length: 5 }, (_, i) => ({ name: i ? `media/a${i}.mp4` : "project.json", size: 24 * 1024 * 1024 }))).join()).toMatch(/unpacked/);
  });
  it("requires project.json and ignores zip junk", () => {
    expect(checkEntries([{ name: "media/a.webp", size: 1 }]).join()).toMatch(/project.json is missing/);
    expect(checkEntries([{ name: "project.json", size: 1 }, { name: "__MACOSX/x", size: 1 }, { name: "media/", size: 0 }, { name: "media/.DS_Store", size: 1 }])).toEqual([]);
  });
});

describe("schema and refs", () => {
  it("checks the format literal and slug", () => {
    expect(packSchema.safeParse({ format: "other", slug: "a", sections: [] }).success).toBe(false);
    expect(packSchema.safeParse({ format: "josefyang-project/1", slug: "Bad Slug", sections: [] }).success).toBe(false);
    expect(packSchema.safeParse({ format: "josefyang-project/1", slug: "ok", sections: [] }).success).toBe(true);
  });
  const content = { title: t("Hi"), hero: { file: "media/h.webp", alt: "A", mode: "fit", focal: { x: 0.2, y: 0.8 } }, clip: { file: "media/c.mp4", alt: "C" }, items: [{ pic: { file: "media/p.png", alt: "P" } }] };
  it("lists refs only in image/video fields", () => {
    const refs = listFileRefs(pack({ ...content, title: { value: "media/not.webp", file: "media/trap.webp" } }) as never, gm);
    expect(refs.map((r) => r.file)).toEqual(["media/h.webp", "media/c.mp4", "media/p.png"]);
    expect(refs.map((r) => r.kind)).toEqual(["image", "video", "image"]);
  });
  it("passes a good pack", () => {
    const r = checkPack(entries("media/h.webp", "media/c.mp4", "media/p.png"), pack(content), gm);
    expect(r.problems).toEqual([]);
    expect(r.summary).toMatchObject({ images: 2, videos: 1, sections: 1, files: 3 });
  });
  it("reports a missing file, a type mix-up, an unknown module and an unused file", () => {
    expect(checkPack(entries("media/h.webp", "media/c.mp4"), pack(content), gm).problems.join()).toMatch(/media\/p.png" is not in the zip/);
    const swapped = { ...content, hero: { file: "media/c.mp4", alt: "" }, clip: { file: "media/h.webp", alt: "" } };
    const r = checkPack(entries("media/h.webp", "media/c.mp4", "media/p.png"), pack(swapped), gm);
    expect(r.problems.join()).toMatch(/needs an image/);
    expect(r.problems.join()).toMatch(/needs an MP4/);
    const unknown = { ...pack(content), sections: [{ moduleId: "nope", content: {} }] };
    expect(checkPack(entries(), unknown, gm).problems.join()).toMatch(/no module called "nope"/);
    expect(checkPack(entries("media/h.webp", "media/c.mp4", "media/p.png", "media/spare.webp"), pack(content), gm).warnings.join()).toMatch(/spare/);
  });
  it("rejects a ref that points outside media/ and a mode the field does not allow", () => {
    const evil = { ...content, hero: { file: "../../etc/passwd", alt: "" } };
    expect(checkPack(entries("media/c.mp4", "media/p.png"), pack(evil), gm).problems.join()).toMatch(/leave the pack folder/);
    const mode = { ...content, items: [{ pic: { file: "media/p.png", alt: "", mode: "object" } }] };
    expect(checkPack(entries("media/h.webp", "media/c.mp4", "media/p.png"), pack(mode), gm).problems.join()).toMatch(/mode "object"/);
  });
  it("reports content that fails the module schema", () => {
    const r = checkPack(entries("media/h.webp", "media/c.mp4", "media/p.png"), pack({ ...content, items: Array.from({ length: 6 }, () => ({ pic: content.items[0]!.pic })) }), gm);
    expect(r.ok).toBe(false);
  });
});

describe("resolveRefs", () => {
  const map = { "media/h.webp": up("h"), "media/c.mp4": { ...up("c"), original: "orig.mp4", widths: undefined }, "media/p.png": up("p") };
  const content = { title: t("Hi"), hero: { file: "media/h.webp", alt: "A", focal: { x: 0.1, y: 0.9 } }, clip: { file: "media/c.mp4", alt: "C" }, items: [{ pic: { file: "media/p.png", alt: "P" } }] };
  it("swaps refs for real values using the field kind", () => {
    const { content: out, problems } = resolveRefs(fields, content, map);
    expect(problems).toEqual([]);
    const o = out as never as { hero: Record<string, unknown>; clip: Record<string, unknown>; items: { pic: Record<string, unknown> }[] };
    expect(o.hero).toMatchObject({ mediaId: "id-h", key: "m/h", mode: "fill", focal: { x: 0.1, y: 0.9 }, alt: "A", widths: [480, 960] });
    expect(o.clip).toEqual({ mediaId: "id-c", key: "m/c", original: "orig.mp4", w: 1200, h: 800, alt: "C" });
    expect(o.items[0]!.pic.mediaId).toBe("id-p");
  });
  it("reports a file that was never uploaded and leaves non-media fields alone", () => {
    const r = resolveRefs(fields, { ...content, title: { file: "x" } }, { "media/h.webp": map["media/h.webp"] });
    expect(r.problems.length).toBe(2);
    expect(r.content.title).toEqual({ file: "x" });
  });
  it("builds a draft doc with defaults filled and unique section ids", () => {
    const p = packSchema.parse({ ...pack(content), sections: [{ moduleId: "fake", content }, { moduleId: "fake", content: { title: t("Two") } }] });
    const d = docFromPack(p, map, gm);
    expect(d.problems).toEqual([]);
    expect(d.sections.map((s) => s.sectionId)).toEqual(["fake", "fake-2"]);
    expect((d.sections[1]!.content as { hero: { mediaId: null } }).hero.mediaId).toBeNull();
    expect((d.meta.title as { value: string }).value).toBe("[Build name]");
  });
});

describe("export round trip", () => {
  it("packFromDoc then resolveRefs gives back the same media", () => {
    const map = { "media/h.webp": up("h") };
    const doc = { slug: "demo", meta: {}, sections: [{ sectionId: "fake", moduleId: "fake", moduleVersion: 1, content: { title: t("Hi"), hero: { ...resolveRefs(fields, { hero: { file: "media/h.webp", alt: "A", mode: "fit" } }, map).content.hero as object }, clip: noVideo(), items: [] } }] };
    const { project, files } = packFromDoc(doc, gm);
    expect(files).toEqual([{ name: "media/fake-1-hero.webp", url: "/media/m/h/orig.webp" }]);
    expect(project.sections[0]!.content).toMatchObject({ hero: { file: "media/fake-1-hero.webp", alt: "A", mode: "fit" }, clip: { mediaId: null } });
    expect(packSchema.safeParse(project).success).toBe(true);
    expect(checkPack(entries(files[0]!.name), project, gm).problems).toEqual([]);
  });
  it("falls back to the largest WebP when the original is not a pack type", () => {
    const heic = { mediaId: "i", key: "m/z", widths: [480, 1600], original: "orig.heic", focal: { x: 0.5, y: 0.5 }, zoom: 1, mode: "fill", alt: "" };
    const { files } = packFromDoc({ slug: "d", meta: {}, sections: [{ sectionId: "fake", moduleId: "fake", moduleVersion: 1, content: { hero: heic } }] }, gm);
    expect(files[0]!.url).toBe("/media/m/z/1600.webp");
  });
});
