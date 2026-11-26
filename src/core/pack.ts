/**
 * Project pack v1 (`<slug>.zip` = project.json + media/<file>). Pure helpers, no I/O: the admin unzips with fflate,
 * hands the entries here, and uploads the media itself. See docs/PROJECT-PACK.md.
 */
import { z } from "zod";
import { buildFields, buildMetaDefaults } from "./build-fields";
import { slugSchema } from "./content";
import { fieldsToZod, walk, withDefaults, type Fields, type ImageMode, type ImageValue, type VideoValue } from "./fields";
import type { ModuleDef, Section } from "./module";
import { getModule as registryGetModule } from "./registry";

export const PACK_FORMAT = "josefyang-project/1";
export const PACK_LIMITS = { files: 60, totalBytes: 80 * 1024 * 1024, fileBytes: 25 * 1024 * 1024 } as const;
export const PACK_EXTENSIONS = ["webp", "png", "jpg", "jpeg", "avif", "mp4"] as const;

export const fileRefSchema = z.object({
  file: z.string().max(120),
  alt: z.string().max(200).optional(),
  mode: z.enum(["fill", "fit", "object"]).optional(),
  focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});
export type FileRef = z.infer<typeof fileRefSchema>;

export const packSchema = z.object({
  format: z.literal(PACK_FORMAT),
  slug: slugSchema,
  meta: z.record(z.string(), z.unknown()).default({}),
  sections: z.array(z.object({ moduleId: z.string().min(1).max(64), content: z.unknown() })).max(40),
});
export type PackJson = z.infer<typeof packSchema>;

type GetModule = (id: string) => ModuleDef<Fields> | undefined;

/* ---------- paths and limits ---------- */

const MEDIA_RE = /^media\/[\w.-]+$/;
const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;
export const extOf = (name: string) => (name.split(".").pop() ?? "").toLowerCase();
export const isVideoFile = (name: string) => extOf(name) === "mp4";

/** Is this one file path allowed in a pack? Returns a plain-English problem or null. */
export function pathProblem(name: string): string | null {
  if (name === "project.json") return null;
  if (name.startsWith("/") || /^[a-zA-Z]:/.test(name)) return `"${name}" is an absolute path. Files must be project.json or media/<name>.`;
  if (name.includes("\\")) return `"${name}" uses a backslash. Use forward slashes.`;
  if (name.split("/").includes("..")) return `"${name}" tries to leave the pack folder (..).`;
  if (!name.startsWith("media/")) return `"${name}" is not allowed. Only project.json and files inside media/ go in a pack.`;
  if (name.slice(6).includes("/")) return `"${name}" is in a sub-folder. Put every file directly in media/.`;
  if (!MEDIA_RE.test(name)) return `"${name}" has odd characters. File names may use letters, numbers, dot, dash and underscore only.`;
  if (!(PACK_EXTENSIONS as readonly string[]).includes(extOf(name))) return `"${name}" is not an allowed type (use ${PACK_EXTENSIONS.join(", ")}).`;
  return null;
}

export interface PackEntry { name: string; size: number }

/** Junk that zip tools add; ignored rather than rejected. */
export const isJunkEntry = (name: string) => name.endsWith("/") || name.startsWith("__MACOSX/") || name.split("/").at(-1) === ".DS_Store";

export function checkEntries(entries: PackEntry[]): string[] {
  const out: string[] = [];
  const real = entries.filter((e) => !isJunkEntry(e.name));
  if (!real.some((e) => e.name === "project.json")) out.push("project.json is missing from the top level of the zip. (Zip the contents of the folder, not the folder itself.)");
  if (real.length > PACK_LIMITS.files) out.push(`Too many files: ${real.length} (the limit is ${PACK_LIMITS.files}).`);
  const total = real.reduce((n, e) => n + e.size, 0);
  if (total > PACK_LIMITS.totalBytes) out.push(`The pack is ${mb(total)} unpacked (the limit is ${mb(PACK_LIMITS.totalBytes)}).`);
  const seen = new Set<string>();
  for (const e of real) {
    const p = pathProblem(e.name);
    if (p) out.push(p);
    if (e.size > PACK_LIMITS.fileBytes) out.push(`"${e.name}" is ${mb(e.size)} (the limit is ${mb(PACK_LIMITS.fileBytes)} per file).`);
    if (seen.has(e.name)) out.push(`"${e.name}" appears twice.`);
    seen.add(e.name);
  }
  return out;
}

/* ---------- walking a pack ---------- */

export const isFileRef = (v: unknown): v is FileRef =>
  !!v && typeof v === "object" && typeof (v as { file?: unknown }).file === "string" && !("mediaId" in (v as object));

export interface PackRef { where: string; file: string; kind: "image" | "video"; mode?: ImageMode; modes?: ImageMode[] }

function fieldsFor(pack: PackJson, i: number, gm: GetModule): Fields | null {
  return gm(pack.sections[i]!.moduleId)?.fields ?? null;
}

/** Every media reference in the pack, with where it sits and what kind of field holds it. */
export function listFileRefs(pack: PackJson, gm: GetModule = registryGetModule): PackRef[] {
  const out: PackRef[] = [];
  const add = (fs: Fields, content: unknown, base: string) => {
    for (const s of walk(fs, content, base)) {
      if ((s.field.kind === "image" || s.field.kind === "video") && isFileRef(s.value)) out.push({ where: s.path, file: s.value.file, kind: s.field.kind, mode: s.value.mode, modes: s.field.kind === "image" ? s.field.modes : undefined });
    }
  };
  add(buildFields as Fields, pack.meta, "meta");
  pack.sections.forEach((s, i) => { const fs = fieldsFor(pack, i, gm); if (fs) add(fs, s.content, `sections[${i}] (${s.moduleId})`); });
  return out;
}

export interface PackSummary { slug: string; sections: number; images: number; videos: number; files: number }
export interface PackCheck { ok: boolean; problems: string[]; warnings: string[]; pack: PackJson | null; summary: PackSummary | null }

/** Full dry run: file paths and limits, project.json shape, modules, content, and every media reference. */
export function checkPack(entries: PackEntry[], projectJson: unknown, gm: GetModule = registryGetModule): PackCheck {
  const problems = checkEntries(entries);
  const parsed = packSchema.safeParse(projectJson);
  if (!parsed.success) {
    const i = parsed.error.issues[0]!;
    problems.push(`project.json: ${i.path.join(".") || "(top)"} ${i.message}`);
    return { ok: false, problems, warnings: [], pack: null, summary: null };
  }
  const pack = parsed.data;
  const names = new Set(entries.filter((e) => !isJunkEntry(e.name)).map((e) => e.name));
  pack.sections.forEach((s, i) => { if (!gm(s.moduleId)) problems.push(`Section ${i + 1}: there is no module called "${s.moduleId}".`); });
  const refs = listFileRefs(pack, gm);
  for (const r of refs) {
    const bad = pathProblem(r.file);
    if (bad || r.file === "project.json") problems.push(`${r.where}: ${bad ?? `"${r.file}" is not a media file.`}`);
    else if (!names.has(r.file)) problems.push(`${r.where}: the file "${r.file}" is not in the zip.`);
    else if (r.kind === "image" && isVideoFile(r.file)) problems.push(`${r.where}: this spot needs an image, but "${r.file}" is a video.`);
    else if (r.kind === "video" && !isVideoFile(r.file)) problems.push(`${r.where}: this spot needs an MP4 video, but "${r.file}" is not one.`);
    else if (r.mode && r.modes && !r.modes.includes(r.mode)) problems.push(`${r.where}: mode "${r.mode}" is not allowed here (use ${r.modes.join(" or ")}).`);
  }
  // Content must validate against the module after refs are swapped for placeholders.
  const stub = (r: FileRef, kind: "image" | "video") => (kind === "image"
    ? { mediaId: "x", focal: { x: 0.5, y: 0.5 }, zoom: 1, mode: r.mode ?? "fill", alt: r.alt ?? "" }
    : { mediaId: "x", alt: r.alt ?? "" });
  pack.sections.forEach((s, i) => {
    const m = gm(s.moduleId);
    if (!m) return;
    const swapped = mapMedia(m.fields, s.content, (v, field) => (isFileRef(v) ? stub(v, field.kind) : v));
    const res = fieldsToZodLoose(m, swapped);
    if (res) problems.push(`Section ${i + 1} (${m.name}): ${res}`);
  });
  const used = new Set(refs.map((r) => r.file));
  const warnings = [...names].filter((n) => n !== "project.json" && !used.has(n) && !pathProblem(n)).map((n) => `"${n}" is in the zip but nothing uses it.`);
  const summary = { slug: pack.slug, sections: pack.sections.length, images: refs.filter((r) => r.kind === "image").length, videos: refs.filter((r) => r.kind === "video").length, files: names.size - 1 };
  return { ok: problems.length === 0, problems, warnings, pack, summary };
}

/** Validate content merged over the module defaults; returns the first problem or null. */
function fieldsToZodLoose(m: ModuleDef<Fields>, content: unknown): string | null {
  const res = fieldsToZod({ g: { kind: "group", label: m.name, fields: m.fields } }).safeParse({ g: withDefaults(m.defaults, content) });
  if (res.success) return null;
  const i = res.error.issues[0]!;
  return `${i.path.slice(1).join(".")} ${i.message}`;
}

/* ---------- swapping references ---------- */

type MediaField = Fields[string] & { kind: "image" | "video" };

/** Returns a copy of `content` with `fn` applied to every image/video slot (and nothing else). */
export function mapMedia(fs: Fields, content: unknown, fn: (value: unknown, field: MediaField, path: string) => unknown, base = ""): Record<string, unknown> {
  const src = (content && typeof content === "object" ? content : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  for (const [k, fd] of Object.entries(fs)) {
    const path = base ? `${base}.${k}` : k;
    if (!(k in src)) continue;
    const v = src[k];
    if (fd.kind === "image" || fd.kind === "video") out[k] = fn(v, fd as MediaField, path);
    else if (fd.kind === "group") out[k] = mapMedia(fd.fields, v, fn, path);
    else if (fd.kind === "list" && Array.isArray(v)) out[k] = v.map((item, i) => mapMedia(fd.of, item, fn, `${path}[${i}]`));
  }
  return out;
}

export interface UploadedMedia { mediaId: string; key: string; original: string; widths?: number[]; w?: number | null; h?: number | null; transparent?: boolean }

/** Swap every `{file, alt, mode?, focal?}` for a real ImageValue/VideoValue. `map` is keyed by the pack file name (media/x.webp). */
export function resolveRefs(fs: Fields, content: unknown, map: Record<string, UploadedMedia>, base = ""): { content: Record<string, unknown>; problems: string[] } {
  const problems: string[] = [];
  const out = mapMedia(fs, content, (v, field, path) => {
    if (!isFileRef(v)) return v;
    const up = map[v.file];
    if (!up) { problems.push(`${path}: the file "${v.file}" was not uploaded.`); return v; }
    if (field.kind === "video") {
      if (!isVideoFile(v.file)) { problems.push(`${path}: "${v.file}" is not a video.`); return v; }
      const val: VideoValue = { mediaId: up.mediaId, key: up.key, original: up.original, w: up.w ?? undefined, h: up.h ?? undefined, alt: v.alt ?? "" };
      return val;
    }
    if (isVideoFile(v.file)) { problems.push(`${path}: "${v.file}" is a video, this spot needs an image.`); return v; }
    const mode: ImageMode = v.mode ?? field.modes[0] ?? "fill";
    if (!field.modes.includes(mode)) { problems.push(`${path}: mode "${mode}" is not allowed here (use ${field.modes.join(" or ")}).`); return v; }
    const val: ImageValue = {
      mediaId: up.mediaId, key: up.key, widths: up.widths, original: up.original, w: up.w ?? undefined, h: up.h ?? undefined,
      transparent: up.transparent, focal: v.focal ?? { x: 0.5, y: 0.5 }, zoom: 1, mode, alt: v.alt ?? "",
    };
    return val;
  }, base);
  return { content: out, problems };
}

/** Turns a validated pack plus uploaded media into the build document (draft). Missing fields fall back to module defaults. */
export function docFromPack(pack: PackJson, map: Record<string, UploadedMedia>, gm: GetModule = registryGetModule): { slug: string; meta: Record<string, unknown>; sections: Section[]; problems: string[] } {
  const problems: string[] = [];
  const meta = resolveRefs(buildFields as Fields, pack.meta, map, "meta");
  problems.push(...meta.problems);
  const used = new Map<string, number>();
  const sections: Section[] = [];
  pack.sections.forEach((s, i) => {
    const m = gm(s.moduleId);
    if (!m) { problems.push(`Section ${i + 1}: there is no module called "${s.moduleId}".`); return; }
    const r = resolveRefs(m.fields, s.content, map, `sections[${i}]`);
    problems.push(...r.problems);
    const n = (used.get(m.id) ?? 0) + 1;
    used.set(m.id, n);
    sections.push({ sectionId: n === 1 ? m.id : `${m.id}-${n}`, moduleId: m.id, moduleVersion: m.version, content: withDefaults(m.defaults, r.content) });
  });
  const title = (pack.meta.title as { value?: string } | undefined)?.value;
  return { slug: pack.slug, meta: withDefaults(buildMetaDefaults(title ?? "[Build name]"), meta.content) as Record<string, unknown>, sections, problems };
}

/* ---------- export ---------- */

export interface ExportFile { name: string; url: string }

const safeName = (s: string) => s.replace(/\[(\d+)\]/g, "-$1").replace(/[^\w.-]+/g, "-").replace(/\.+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();

/** Inverse of docFromPack: swaps every image/video for a file reference and lists the files to fetch. */
export function packFromDoc(doc: { slug: string; meta: unknown; sections: Section[] }, gm: GetModule = registryGetModule): { project: PackJson; files: ExportFile[] } {
  const files: ExportFile[] = [];
  const byUrl = new Map<string, string>();
  const names = new Set<string>();
  const swap = (prefix: string) => (v: unknown, field: MediaField, path: string) => {
    const val = v as Partial<ImageValue> | undefined;
    if (!val || !val.mediaId || !val.key) return v;
    const orig = val.original ?? "";
    const ok = (PACK_EXTENSIONS as readonly string[]).includes(extOf(orig));
    const big = (val.widths ?? []).at(-1);
    const rel = ok ? orig : big ? `${big}.webp` : orig;
    const url = `/media/${val.key}/${rel}`;
    let name = byUrl.get(url);
    if (!name) {
      const base = safeName(`${prefix}-${path}`) || "file";
      name = `media/${base}.${extOf(rel)}`;
      for (let n = 2; names.has(name); n++) name = `media/${base}-${n}.${extOf(rel)}`;
      names.add(name);
      byUrl.set(url, name);
      files.push({ name, url });
    }
    const ref: FileRef = { file: name, alt: val.alt ?? "" };
    if (field.kind === "image") {
      if (val.mode) ref.mode = val.mode;
      if (val.focal && (val.focal.x !== 0.5 || val.focal.y !== 0.5)) ref.focal = val.focal;
    }
    return ref;
  };
  const meta = mapMedia(buildFields as Fields, doc.meta, swap("meta"));
  const sections = doc.sections.map((s, i) => {
    const m = gm(s.moduleId);
    return { moduleId: s.moduleId, content: m ? mapMedia(m.fields, s.content, swap(`${s.moduleId}-${i + 1}`)) : s.content };
  });
  return { project: { format: PACK_FORMAT, slug: doc.slug, meta, sections }, files };
}
