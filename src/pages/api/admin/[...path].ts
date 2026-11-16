/**
 * Admin API (architecture §13). One router; every route sits under /api/admin/*, which the middleware
 * protects with the Access JWT check, Origin and Content-Type rules. All input goes through Zod.
 */
import type { APIContext, APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { buildMetaDefaults } from "../../../core/build-fields";
import { purgeAndWarm } from "../../../core/cache";
import {
  buildDocShape, buildMedia, buildMetaSchema, buildProblems, sectionMedia, sectionProblems, sectionsShape, slugSchema,
  validateSections, validateSettings,
} from "../../../core/content";
import { BUILD_LAYOUT, PAGE_IDS, defaultSections, now, sectionsFromModules, uid } from "../../../core/db";
import { mediaRefs, publishProblems, withDefaults } from "../../../core/fields";
import type { Section } from "../../../core/module";
import { getModule, modules } from "../../../core/registry";
import { settingsDefaults, settingsFields, type SettingsKey } from "../../../core/settings";
import { slugify } from "../../../lib/dates";

type Ctx = APIContext;
const db = () => env.DB;

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status);

async function body<T extends z.ZodType>(ctx: Ctx, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown;
  try { raw = await ctx.request.json(); } catch { return fail(400, "Body must be JSON"); }
  const res = schema.safeParse(raw);
  if (!res.success) return fail(400, `${res.error.issues[0]?.path.join(".")} ${res.error.issues[0]?.message}`);
  return res.data;
}
const isResp = (x: unknown): x is Response => x instanceof Response;
const parse = <T>(s: string | null | undefined, fb: T): T => { if (!s) return fb; try { return JSON.parse(s) as T; } catch { return fb; } };

/* ---------- shared helpers ---------- */

async function snapshot(ownerType: string, ownerId: string, data: unknown, reason: string) {
  await db().prepare("INSERT INTO versions (owner_type, owner_id, snapshot_json, reason, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(ownerType, ownerId, JSON.stringify(data), reason, now()).run();
}

/** At most one 'interval' snapshot per 10 minutes of editing (architecture §12.5). */
async function intervalSnapshot(ownerType: string, ownerId: string, data: unknown) {
  const last = await db().prepare("SELECT created_at FROM versions WHERE owner_type = ? AND owner_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(ownerType, ownerId).first<{ created_at: number }>();
  if (!last || now() - last.created_at > 10 * 60_000) await snapshot(ownerType, ownerId, data, "interval");
}

async function setUsage(ownerType: string, ownerId: string, refs: { mediaId: string; path: string }[]) {
  const stmts = [db().prepare("DELETE FROM media_usage WHERE owner_type = ? AND owner_id = ?").bind(ownerType, ownerId)];
  for (const r of refs) {
    stmts.push(db().prepare("INSERT OR IGNORE INTO media_usage (media_id, owner_type, owner_id, field_path) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM media WHERE id = ?)")
      .bind(r.mediaId, ownerType, ownerId, r.path, r.mediaId));
  }
  await db().batch(stmts);
}

async function publicPaths(): Promise<string[]> {
  const [b, d] = await db().batch([
    db().prepare("SELECT slug FROM builds WHERE published_json IS NOT NULL AND deleted_at IS NULL"),
    db().prepare("SELECT slug FROM devlog WHERE status = 'published'"),
  ]);
  return ["/", "/projects", "/failures", "/devlog", "/about",
    ...((b?.results ?? []) as { slug: string }[]).map((r) => `/builds/${r.slug}`),
    ...((d?.results ?? []) as { slug: string }[]).map((r) => `/devlog/${r.slug}`)];
}

/** Publishing anything purges every public page and warms it again (few pages, so this stays cheap). */
function purge(ctx: Ctx, extra: string[] = []) {
  if (env.CACHE_PAGES !== "1") return;
  ctx.locals.cfContext.waitUntil(publicPaths().then((p) => purgeAndWarm(ctx.url.origin, [...p, ...extra])));
}

/* ---------- pages ---------- */

async function getPage(id: string) {
  const row = await db().prepare("SELECT draft_json, published_json, updated_at, published_at FROM pages WHERE id = ?").bind(id)
    .first<{ draft_json: string; published_json: string | null; updated_at: number; published_at: number | null }>();
  const sections = row ? parse<Section[]>(row.draft_json, []) : defaultSections(id);
  return { id, sections, updatedAt: row?.updated_at ?? 0, publishedAt: row?.published_at ?? null, dirty: !row || row.draft_json !== row.published_json };
}

async function savePage(ctx: Ctx, id: string) {
  const b = await body(ctx, z.object({ sections: sectionsShape, updatedAt: z.number() }));
  if (isResp(b)) return b;
  const v = validateSections(b.sections as Section[]);
  if (!v.ok) return fail(422, v.error);
  const row = await db().prepare("SELECT updated_at FROM pages WHERE id = ?").bind(id).first<{ updated_at: number }>();
  if (row && row.updated_at > b.updatedAt) return fail(409, "Changed in another tab. Reload?");
  const t = Math.max(now(), (row?.updated_at ?? 0) + 1);
  const js = JSON.stringify(v.sections);
  await db().prepare("INSERT INTO pages (id, draft_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at").bind(id, js, t).run();
  await intervalSnapshot("page", id, v.sections);
  await setUsage("page", id, sectionMedia(v.sections));
  return json({ updatedAt: t, problems: sectionProblems(v.sections) });
}

async function publishPage(ctx: Ctx, id: string) {
  const p = await getPage(id);
  const problems = sectionProblems(p.sections);
  if (problems.length) return fail(422, "Fix these before publishing", { problems });
  const js = JSON.stringify(p.sections);
  const t = now();
  await db().prepare("INSERT INTO pages (id, draft_json, published_json, updated_at, published_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET published_json = excluded.published_json, published_at = excluded.published_at")
    .bind(id, js, js, p.updatedAt || t, t).run();
  await snapshot("page", id, p.sections, "publish");
  purge(ctx);
  return json({ publishedAt: t });
}

/* ---------- builds ---------- */

interface BuildRow { id: string; slug: string; draft_json: string; published_json: string | null; updated_at: number; published_at: number | null; template_id: string; template_ver: number }

function buildOut(r: BuildRow) {
  const doc = parse<{ slug?: string; meta?: unknown; sections?: Section[] }>(r.draft_json, {});
  return {
    id: r.id, slug: doc.slug ?? r.slug, meta: withDefaults(buildMetaDefaults(), doc.meta), sections: doc.sections ?? [],
    templateId: r.template_id, templateVer: r.template_ver, updatedAt: r.updated_at, publishedAt: r.published_at,
    dirty: r.draft_json !== r.published_json,
  };
}

async function listBuilds() {
  const res = await db().prepare("SELECT * FROM builds WHERE deleted_at IS NULL ORDER BY updated_at DESC").all<BuildRow>();
  return res.results.map(buildOut);
}

async function createBuild(ctx: Ctx) {
  const b = await body(ctx, z.object({ title: z.string().min(1).max(40), templateId: z.string().default("build-default") }));
  if (isResp(b)) return b;
  const tpl = await db().prepare("SELECT id, version, sections_json FROM templates WHERE id = ? ORDER BY version DESC LIMIT 1").bind(b.templateId)
    .first<{ id: string; version: number; sections_json: string }>();
  if (!tpl) return fail(404, "Template not found");
  const tplSections = parse<{ moduleId: string; moduleVersion: number; defaults: unknown }[]>(tpl.sections_json, []);
  const sections: Section[] = tplSections.map((s) => {
    const m = getModule(s.moduleId);
    return { sectionId: s.moduleId, moduleId: s.moduleId, moduleVersion: m?.version ?? 1, content: withDefaults(m?.defaults ?? {}, s.defaults) };
  });
  let slug = slugify(b.title) || "build";
  const taken = await db().prepare("SELECT slug FROM builds WHERE slug LIKE ?").bind(`${slug}%`).all<{ slug: string }>();
  if (taken.results.some((r) => r.slug === slug)) slug = `${slug}-${taken.results.length + 1}`;
  const meta = { ...buildMetaDefaults(b.title), title: { value: b.title } };
  const id = uid();
  const t = now();
  await db().prepare("INSERT INTO builds (id, slug, kind, status, featured, template_id, template_ver, draft_json, updated_at, title) VALUES (?, ?, 'hardware', 'in_progress', 0, ?, ?, ?, ?, ?)")
    .bind(id, slug, tpl.id, tpl.version, JSON.stringify({ slug, meta, sections }), t, b.title).run();
  return json({ id, slug }, 201);
}

async function getBuildRow(id: string) {
  return db().prepare("SELECT * FROM builds WHERE id = ? AND deleted_at IS NULL").bind(id).first<BuildRow>();
}

async function saveBuild(ctx: Ctx, id: string) {
  const b = await body(ctx, z.object({ doc: buildDocShape, updatedAt: z.number() }));
  if (isResp(b)) return b;
  const row = await getBuildRow(id);
  if (!row) return fail(404, "Build not found");
  if (row.updated_at > b.updatedAt) return fail(409, "Changed in another tab. Reload?");
  const meta = buildMetaSchema.safeParse(withDefaults(buildMetaDefaults(), b.doc.meta));
  if (!meta.success) return fail(422, `Build: ${meta.error.issues[0]?.path.join(".")} ${meta.error.issues[0]?.message}`);
  const v = validateSections(b.doc.sections as Section[]);
  if (!v.ok) return fail(422, v.error);
  const clash = await db().prepare("SELECT id FROM builds WHERE slug = ? AND id != ?").bind(b.doc.slug, id).first();
  if (clash) return fail(422, "Another build already uses this slug");
  const doc = { slug: b.doc.slug, meta: meta.data, sections: v.sections };
  const t = Math.max(now(), row.updated_at + 1);
  await db().prepare("UPDATE builds SET draft_json = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(doc), t, id).run();
  await intervalSnapshot("build", id, doc);
  await setUsage("build", id, [...buildMedia(meta.data), ...sectionMedia(v.sections)]);
  return json({ updatedAt: t, problems: [...buildProblems(meta.data), ...sectionProblems(v.sections)] });
}

async function publishBuild(ctx: Ctx, id: string) {
  const row = await getBuildRow(id);
  if (!row) return fail(404, "Build not found");
  const doc = buildOut(row);
  const problems = [...buildProblems(doc.meta), ...sectionProblems(doc.sections.length ? doc.sections : sectionsFromModules(BUILD_LAYOUT))];
  if (problems.length) return fail(422, "Fix these before publishing", { problems });
  const m = doc.meta;
  if (m.status === "bench") {
    // Only one build can be on the bench (architecture §6.4). Others move back to in progress, in draft and published copies.
    const others = await db().prepare("SELECT id, draft_json, published_json FROM builds WHERE id != ? AND status = 'bench'").bind(id).all<{ id: string; draft_json: string; published_json: string | null }>();
    for (const o of others.results) {
      const fix = (s: string | null) => { if (!s) return s; const d = parse<{ meta?: { status?: string } }>(s, {}); if (d.meta) d.meta.status = "in_progress"; return JSON.stringify(d); };
      await db().prepare("UPDATE builds SET status = 'in_progress', draft_json = ?, published_json = ? WHERE id = ?").bind(fix(o.draft_json), fix(o.published_json), o.id).run();
    }
  }
  const t = now();
  await db().prepare(`UPDATE builds SET published_json = draft_json, published_at = ?, slug = ?, kind = ?, status = ?, featured = ?, home_order = ?,
      summary = ?, skills_json = ?, title = ?, started_on = ? WHERE id = ?`)
    .bind(t, doc.slug, m.kind, m.status, m.featured ? 1 : 0, m.homeOrder, m.summary.value, JSON.stringify(m.skills.map((s) => s.name.value)), m.title.value, m.startedOn || null, id).run();
  await snapshot("build", id, { slug: doc.slug, meta: doc.meta, sections: doc.sections }, "publish");
  purge(ctx);
  return json({ publishedAt: t });
}

async function unpublishBuild(ctx: Ctx, id: string) {
  await db().prepare("UPDATE builds SET published_json = NULL, published_at = NULL WHERE id = ?").bind(id).run();
  purge(ctx);
  return json({ ok: true });
}

async function deleteBuild(ctx: Ctx, id: string) {
  await db().batch([
    db().prepare("UPDATE builds SET deleted_at = ?, published_json = NULL, slug = slug || '-deleted-' || ? WHERE id = ?").bind(now(), now(), id),
    db().prepare("UPDATE devlog SET build_id = NULL WHERE build_id = ?").bind(id),
    db().prepare("DELETE FROM media_usage WHERE owner_type = 'build' AND owner_id = ?").bind(id),
  ]);
  purge(ctx);
  return json({ ok: true });
}

/** Template upgrade (architecture §12.6): one build at a time; dry run returns the diff, apply writes it. */
async function upgradeBuild(ctx: Ctx, id: string) {
  const b = await body(ctx, z.object({ apply: z.boolean() }));
  if (isResp(b)) return b;
  const row = await getBuildRow(id);
  if (!row) return fail(404, "Build not found");
  const tpl = await db().prepare("SELECT version, sections_json FROM templates WHERE id = ? ORDER BY version DESC LIMIT 1").bind(row.template_id)
    .first<{ version: number; sections_json: string }>();
  if (!tpl) return fail(404, "Template not found");
  const doc = buildOut(row);
  const target = parse<{ moduleId: string; defaults: unknown }[]>(tpl.sections_json, []);
  const have = new Map(doc.sections.map((s) => [s.moduleId, s]));
  const added = target.filter((s) => !have.has(s.moduleId)).map((s) => s.moduleId);
  const removed = doc.sections.filter((s) => !target.some((t) => t.moduleId === s.moduleId)).map((s) => s.moduleId);
  const migrated = doc.sections.filter((s) => (getModule(s.moduleId)?.version ?? s.moduleVersion) > s.moduleVersion).map((s) => s.moduleId);
  const diff = { from: row.template_ver, to: tpl.version, added, removed, migrated };
  if (!b.apply) return json(diff);
  const sections: Section[] = target.map((t) => {
    const ex = have.get(t.moduleId);
    const m = getModule(t.moduleId);
    if (ex) return ex;
    return { sectionId: t.moduleId, moduleId: t.moduleId, moduleVersion: m?.version ?? 1, content: withDefaults(m?.defaults ?? {}, t.defaults) };
  });
  const v = validateSections(sections);
  if (!v.ok) return fail(422, v.error);
  await snapshot("build", id, { slug: doc.slug, meta: doc.meta, sections: doc.sections }, "restore");
  await db().prepare("UPDATE builds SET draft_json = ?, template_ver = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify({ slug: doc.slug, meta: doc.meta, sections: v.sections }), tpl.version, now(), id).run();
  return json({ ...diff, applied: true });
}

/* ---------- templates ---------- */

const templateShape = z.object({
  id: slugSchema,
  name: z.string().min(1).max(60),
  sections: z.array(z.object({ moduleId: z.string(), moduleVersion: z.number().int().positive().optional(), defaults: z.unknown().optional() })).min(1).max(20),
});

async function importTemplate(ctx: Ctx) {
  const b = await body(ctx, templateShape);
  if (isResp(b)) return b;
  const errors: string[] = [];
  b.sections.forEach((s, i) => {
    const m = getModule(s.moduleId);
    if (!m) { errors.push(`Section ${i + 1}: unknown module "${s.moduleId}"`); return; }
    if (!m.pages.includes("build")) errors.push(`Section ${i + 1}: "${s.moduleId}" can't be used on build pages`);
    const v = validateSections([{ sectionId: s.moduleId, moduleId: s.moduleId, moduleVersion: s.moduleVersion ?? m.version, content: s.defaults ?? {} }]);
    if (!v.ok) errors.push(`Section ${i + 1}: ${v.error}`);
  });
  if (errors.length) return fail(422, "Template rejected", { errors });
  const cur = await db().prepare("SELECT MAX(version) AS v FROM templates WHERE id = ?").bind(b.id).first<{ v: number | null }>();
  const version = (cur?.v ?? 0) + 1;
  const sections = b.sections.map((s) => ({ moduleId: s.moduleId, moduleVersion: getModule(s.moduleId)!.version, defaults: s.defaults ?? {} }));
  await db().prepare("INSERT INTO templates (id, version, name, sections_json, created_at) VALUES (?, ?, ?, ?, ?)").bind(b.id, version, b.name, JSON.stringify(sections), now()).run();
  return json({ id: b.id, version }, 201);
}

/* ---------- settings ---------- */

async function getSettings() {
  const rows = await db().prepare("SELECT key, draft_json, published_json, updated_at FROM settings").all<{ key: string; draft_json: string; published_json: string | null; updated_at: number }>();
  const out: Record<string, { value: unknown; updatedAt: number; dirty: boolean }> = {};
  for (const k of Object.keys(settingsFields)) {
    const r = rows.results.find((x) => x.key === k);
    out[k] = { value: withDefaults(settingsDefaults[k as SettingsKey], parse(r?.draft_json, {})), updatedAt: r?.updated_at ?? 0, dirty: !r || r.draft_json !== r.published_json };
  }
  return out;
}

async function saveSetting(ctx: Ctx, key: string) {
  const b = await body(ctx, z.object({ value: z.unknown(), updatedAt: z.number() }));
  if (isResp(b)) return b;
  const v = validateSettings(key, b.value);
  if (!v.ok) return fail(422, v.error);
  const row = await db().prepare("SELECT updated_at FROM settings WHERE key = ?").bind(key).first<{ updated_at: number }>();
  if (row && row.updated_at > b.updatedAt) return fail(409, "Changed in another tab. Reload?");
  const t = Math.max(now(), (row?.updated_at ?? 0) + 1);
  await db().prepare("INSERT INTO settings (key, draft_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at")
    .bind(key, JSON.stringify(v.value), t).run();
  await setUsage("settings", key, mediaRefs(v.fields, v.value, key));
  return json({ updatedAt: t, problems: publishProblems(v.fields, v.value, key) });
}

async function publishSettings(ctx: Ctx) {
  const all = await getSettings();
  const problems = Object.entries(all).flatMap(([k, s]) => publishProblems(settingsFields[k as SettingsKey], s.value, k));
  if (problems.length) return fail(422, "Fix these before publishing", { problems });
  const t = now();
  await db().batch(Object.entries(all).map(([k, s]) =>
    db().prepare("INSERT INTO settings (key, draft_json, published_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET published_json = excluded.draft_json")
      .bind(k, JSON.stringify(s.value), JSON.stringify(s.value), s.updatedAt || t)));
  await snapshot("settings", "all", Object.fromEntries(Object.entries(all).map(([k, s]) => [k, s.value])), "publish");
  purge(ctx);
  return json({ publishedAt: t });
}

/* ---------- devlog ---------- */

const imageShape = z.object({
  mediaId: z.string().nullable(), key: z.string().optional(), widths: z.array(z.number()).optional(), original: z.string().optional(),
  w: z.number().optional(), h: z.number().optional(), transparent: z.boolean().optional(),
  focal: z.object({ x: z.number(), y: z.number() }), zoom: z.number(), mode: z.enum(["fill", "fit", "object"]), alt: z.string().max(200),
});
const devlogShape = z.object({
  slug: slugSchema,
  title: z.string().min(1).max(90),
  excerpt: z.string().max(220),
  body: z.string().max(20000),
  buildId: z.string().nullable(),
  hero: imageShape.nullable(),
  images: z.array(imageShape).max(12),
  fuseUrl: z.string().max(300).refine((v) => v === "" || v.startsWith("https://"), "Fuse link must start with https://"),
  readMinutes: z.number().int().min(1).max(60).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["draft", "published"]),
  updatedAt: z.number(),
});

function devlogRefs(d: z.infer<typeof devlogShape>) {
  return [...(d.hero?.mediaId ? [{ mediaId: d.hero.mediaId, path: "hero" }] : []), ...d.images.flatMap((im, i) => (im.mediaId ? [{ mediaId: im.mediaId, path: `images[${i}]` }] : []))];
}

async function listDevlog() {
  const r = await db().prepare("SELECT * FROM devlog ORDER BY entry_date DESC, created_at DESC").all<Record<string, unknown>>();
  return r.results.map((x) => ({
    id: x.id, slug: x.slug, title: x.title, excerpt: x.excerpt, body: x.body, buildId: x.build_id,
    hero: parse(x.hero_media_id as string, null), images: parse(x.media_ids as string, []), fuseUrl: x.fuse_url ?? "",
    readMinutes: x.read_minutes, date: x.entry_date, status: x.status, updatedAt: x.updated_at,
  }));
}

async function createDevlog(ctx: Ctx) {
  const b = await body(ctx, z.object({ title: z.string().min(1).max(90), buildId: z.string().nullable().optional() }));
  if (isResp(b)) return b;
  const id = uid();
  let slug = slugify(b.title) || "entry";
  if (await db().prepare("SELECT 1 FROM devlog WHERE slug = ?").bind(slug).first()) slug = `${slug}-${id.slice(0, 4)}`;
  const t = now();
  await db().prepare("INSERT INTO devlog (id, slug, title, excerpt, body, build_id, status, created_at, entry_date, updated_at) VALUES (?, ?, ?, '', '', ?, 'draft', ?, ?, ?)")
    .bind(id, slug, b.title, b.buildId ?? null, t, new Date(t).toISOString().slice(0, 10), t).run();
  return json({ id, slug }, 201);
}

async function saveDevlog(ctx: Ctx, id: string) {
  const b = await body(ctx, devlogShape);
  if (isResp(b)) return b;
  const row = await db().prepare("SELECT updated_at, status FROM devlog WHERE id = ?").bind(id).first<{ updated_at: number; status: string }>();
  if (!row) return fail(404, "Entry not found");
  if (row.updated_at > b.updatedAt) return fail(409, "Changed in another tab. Reload?");
  if (b.status === "published") {
    const missingAlt = [b.hero, ...b.images].some((im) => im?.mediaId && !im.alt.trim());
    if (missingAlt) return fail(422, "Add alt text to every photo before publishing");
  }
  const clash = await db().prepare("SELECT 1 FROM devlog WHERE slug = ? AND id != ?").bind(b.slug, id).first();
  if (clash) return fail(422, "Another entry already uses this slug");
  const t = Math.max(now(), row.updated_at + 1);
  await db().prepare(`UPDATE devlog SET slug = ?, title = ?, excerpt = ?, body = ?, build_id = ?, hero_media_id = ?, media_ids = ?, fuse_url = ?,
      read_minutes = ?, entry_date = ?, status = ?, updated_at = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE NULL END WHERE id = ?`)
    .bind(b.slug, b.title, b.excerpt, b.body, b.buildId, b.hero ? JSON.stringify(b.hero) : null, JSON.stringify(b.images), b.fuseUrl || null,
      b.readMinutes, b.date, b.status, t, b.status, t, id).run();
  await setUsage("devlog", id, devlogRefs(b));
  if (b.status === "published" || row.status === "published") purge(ctx);
  return json({ updatedAt: t });
}

/* ---------- milestones ---------- */

const milestoneShape = z.object({
  date: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "Date: YYYY-MM or YYYY-MM-DD"),
  label: z.string().max(20),
  title: z.string().min(1).max(60),
  body: z.string().max(160),
  status: z.enum(["draft", "published"]),
});

/* ---------- media ---------- */

const MAX_UPLOAD = 20 * 1024 * 1024;
const OK_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif", "image/heic": "heic", "image/heif": "heic", "application/pdf": "pdf" };

async function sniff(file: File): Promise<string | null> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const s = (i: number, str: string) => [...str].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x89 && s(1, "PNG")) return "image/png";
  if (s(0, "RIFF") && s(8, "WEBP")) return "image/webp";
  if (s(4, "ftyp")) return s(8, "avif") || s(8, "avis") ? "image/avif" : "image/heic";
  if (s(0, "%PDF")) return "application/pdf";
  return null;
}

async function sha(buf: ArrayBuffer) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
  return [...h.slice(0, 8)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Upload: the browser already made the WebP variants (architecture §10); we check and store them. */
async function uploadMedia(ctx: Ctx) {
  const form = await ctx.request.formData().catch(() => null);
  if (!form) return fail(400, "Expected multipart form data");
  const original = form.get("original");
  if (!(original instanceof File)) return fail(400, "Missing original file");
  if (original.size > MAX_UPLOAD) return fail(413, "Files can be up to 20 MB");
  const type = await sniff(original);
  if (!type || type === "application/pdf") return fail(415, "Upload a JPEG, PNG, WebP, AVIF or HEIC image");
  const buf = await original.arrayBuffer();
  const key = `m/${await sha(buf)}`;
  const ext = OK_TYPES[type]!;
  const widths: number[] = [];
  const puts: Promise<unknown>[] = [env.MEDIA.put(`${key}/orig.${ext}`, buf, { httpMetadata: { contentType: type } })];
  for (const [name, v] of form.entries()) {
    const m = /^w(\d{3,4})$/.exec(name);
    if (!m || !(v instanceof File)) continue;
    if (v.size > MAX_UPLOAD || (await sniff(v)) !== "image/webp") return fail(415, "Variants must be WebP");
    widths.push(Number(m[1]));
    puts.push(env.MEDIA.put(`${key}/${m[1]}.webp`, await v.arrayBuffer(), { httpMetadata: { contentType: "image/webp" } }));
  }
  await Promise.all(puts);
  widths.sort((a, b) => a - b);
  const w = Number(form.get("width")) || null;
  const h = Number(form.get("height")) || null;
  const alt = String(form.get("alt") ?? "").slice(0, 200);
  const transparent = form.get("transparent") === "1";
  const existing = await db().prepare("SELECT id FROM media WHERE original_key = ?").bind(`${key}/orig.${ext}`).first<{ id: string }>();
  const id = existing?.id ?? uid();
  if (!existing) {
    await db().prepare("INSERT INTO media (id, original_key, variants_json, width, height, alt_default, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, `${key}/orig.${ext}`, JSON.stringify({ widths, transparent, name: original.name.slice(0, 120) }), w, h, alt, original.size, now()).run();
  }
  return json(mediaOut({ id, original_key: `${key}/orig.${ext}`, variants_json: JSON.stringify({ widths, transparent }), width: w, height: h, alt_default: alt, bytes: original.size, created_at: now(), uses: 0 }), 201);
}

interface MediaRow { id: string; original_key: string; variants_json: string; width: number | null; height: number | null; alt_default: string | null; bytes: number | null; created_at: number; uses?: number }
function mediaOut(r: MediaRow) {
  const v = parse<{ widths?: number[]; transparent?: boolean; name?: string }>(r.variants_json, {});
  const parts = r.original_key.split("/");
  return { id: r.id, key: parts.slice(0, 2).join("/"), original: parts[2], widths: v.widths ?? [], transparent: !!v.transparent, name: v.name ?? "", w: r.width, h: r.height, alt: r.alt_default ?? "", bytes: r.bytes, createdAt: r.created_at, uses: r.uses ?? 0 };
}

async function listMedia() {
  const r = await db().prepare("SELECT m.*, (SELECT COUNT(*) FROM media_usage u WHERE u.media_id = m.id) AS uses FROM media m ORDER BY created_at DESC").all<MediaRow>();
  return r.results.map(mediaOut);
}

async function usage(id: string) {
  const r = await db().prepare("SELECT owner_type, owner_id, field_path FROM media_usage WHERE media_id = ? ORDER BY owner_type, owner_id").bind(id).all();
  return r.results;
}

/** Replace everywhere (architecture §12.3): swap the chosen usages in one batch; a version row per owner makes it undoable. */
async function replaceEverywhere(ctx: Ctx, id: string) {
  const b = await body(ctx, z.object({ withId: z.string(), usages: z.array(z.object({ owner_type: z.string(), owner_id: z.string(), field_path: z.string() })).min(1) }));
  if (isResp(b)) return b;
  const nm = await db().prepare("SELECT * FROM media WHERE id = ?").bind(b.withId).first<MediaRow>();
  if (!nm) return fail(404, "Replacement image not found");
  const repl = mediaOut(nm);
  const swap = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(swap);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if ("mediaId" in o && o.mediaId === id) return { ...o, mediaId: repl.id, key: repl.key, widths: repl.widths, original: repl.original, w: repl.w ?? undefined, h: repl.h ?? undefined, transparent: repl.transparent };
      return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, swap(x)]));
    }
    return v;
  };
  const owners = [...new Set(b.usages.map((u) => `${u.owner_type}|${u.owner_id}`))];
  const stmts: D1PreparedStatement[] = [];
  const t = now();
  for (const o of owners) {
    const [type, oid] = o.split("|") as [string, string];
    const paths = b.usages.filter((u) => u.owner_type === type && u.owner_id === oid).map((u) => u.field_path);
    // Swap only within the chosen field paths' top-level owner. Field paths are informational; we swap per owner.
    if (type === "page") {
      const r = await db().prepare("SELECT draft_json FROM pages WHERE id = ?").bind(oid).first<{ draft_json: string }>();
      if (!r) continue;
      stmts.push(db().prepare("INSERT INTO versions (owner_type, owner_id, snapshot_json, reason, created_at) VALUES ('page', ?, ?, 'replace-everywhere', ?)").bind(oid, r.draft_json, t));
      stmts.push(db().prepare("UPDATE pages SET draft_json = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(swapPaths(parse(r.draft_json, []), paths, swap, "sections")), t, oid));
    } else if (type === "build") {
      const r = await db().prepare("SELECT draft_json FROM builds WHERE id = ?").bind(oid).first<{ draft_json: string }>();
      if (!r) continue;
      stmts.push(db().prepare("INSERT INTO versions (owner_type, owner_id, snapshot_json, reason, created_at) VALUES ('build', ?, ?, 'replace-everywhere', ?)").bind(oid, r.draft_json, t));
      stmts.push(db().prepare("UPDATE builds SET draft_json = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(swapPaths(parse(r.draft_json, {}), paths, swap)), t, oid));
    } else if (type === "settings") {
      const r = await db().prepare("SELECT draft_json FROM settings WHERE key = ?").bind(oid).first<{ draft_json: string }>();
      if (!r) continue;
      stmts.push(db().prepare("UPDATE settings SET draft_json = ?, updated_at = ? WHERE key = ?").bind(JSON.stringify(swap(parse(r.draft_json, {}))), t, oid));
    } else if (type === "devlog") {
      const r = await db().prepare("SELECT hero_media_id, media_ids FROM devlog WHERE id = ?").bind(oid).first<{ hero_media_id: string | null; media_ids: string }>();
      if (!r) continue;
      stmts.push(db().prepare("UPDATE devlog SET hero_media_id = ?, media_ids = ?, updated_at = ? WHERE id = ?")
        .bind(r.hero_media_id ? JSON.stringify(swap(parse(r.hero_media_id, null))) : null, JSON.stringify(swap(parse(r.media_ids, []))), t, oid));
    }
    for (const p of paths) {
      stmts.push(db().prepare("DELETE FROM media_usage WHERE media_id = ? AND owner_type = ? AND owner_id = ? AND field_path = ?").bind(id, type, oid, p));
      stmts.push(db().prepare("INSERT OR IGNORE INTO media_usage (media_id, owner_type, owner_id, field_path) VALUES (?, ?, ?, ?)").bind(repl.id, type, oid, p));
    }
  }
  if (stmts.length) await db().batch(stmts); // one D1 batch = one transaction
  return json({ replaced: b.usages.length, note: "Drafts updated. Publish the affected pages to make it live." });
}

/** Applies `swap` only at the given field paths (e.g. "sections[2].content.image", "meta.floorImage"). */
function swapPaths(doc: unknown, paths: string[], swap: (v: unknown) => unknown, _root?: string): unknown {
  const clone = structuredClone(doc) as Record<string, unknown> | unknown[];
  for (const p of paths) {
    const keys = p.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
    if (Array.isArray(clone) && keys[0] === "sections") keys.shift();
    let cur: unknown = clone;
    for (let i = 0; i < keys.length - 1; i++) cur = (cur as Record<string, unknown>)?.[keys[i]!];
    const last = keys.at(-1)!;
    if (cur && typeof cur === "object") (cur as Record<string, unknown>)[last] = swap((cur as Record<string, unknown>)[last]);
  }
  return clone;
}

async function deleteMedia(id: string) {
  const used = await db().prepare("SELECT COUNT(*) AS n FROM media_usage WHERE media_id = ?").bind(id).first<{ n: number }>();
  if (used && used.n > 0) return fail(409, `Still used in ${used.n} place${used.n === 1 ? "" : "s"}. Replace it first.`);
  const m = await db().prepare("SELECT * FROM media WHERE id = ?").bind(id).first<MediaRow>();
  if (!m) return fail(404, "Not found");
  const out = mediaOut(m);
  await env.MEDIA.delete([m.original_key, ...out.widths.map((w) => `${out.key}/${w}.webp`)]);
  await db().prepare("DELETE FROM media WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function uploadCv(ctx: Ctx) {
  const form = await ctx.request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail(400, "Missing file");
  if (file.size > MAX_UPLOAD) return fail(413, "Files can be up to 20 MB");
  if ((await sniff(file)) !== "application/pdf") return fail(415, "The CV must be a PDF");
  const buf = await file.arrayBuffer();
  const key = `cv/${await sha(buf)}/josef-yang-cv.pdf`;
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: "application/pdf", contentDisposition: 'attachment; filename="josef-yang-cv.pdf"' } });
  return json({ fileKey: key }, 201);
}

/* ---------- versions + health ---------- */

async function restoreVersion(_ctx: Ctx, vid: number) {
  const v = await db().prepare("SELECT * FROM versions WHERE id = ?").bind(vid).first<{ owner_type: string; owner_id: string; snapshot_json: string }>();
  if (!v) return fail(404, "Version not found");
  const t = now();
  if (v.owner_type === "page") {
    const cur = await getPage(v.owner_id);
    await snapshot("page", v.owner_id, cur.sections, "restore");
    await db().prepare("INSERT INTO pages (id, draft_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at").bind(v.owner_id, v.snapshot_json, t).run();
  } else if (v.owner_type === "build") {
    const cur = await getBuildRow(v.owner_id);
    if (!cur) return fail(404, "Build not found");
    await snapshot("build", v.owner_id, parse(cur.draft_json, {}), "restore");
    await db().prepare("UPDATE builds SET draft_json = ?, updated_at = ? WHERE id = ?").bind(v.snapshot_json, t, v.owner_id).run();
  } else if (v.owner_type === "settings") {
    const all = parse<Record<string, unknown>>(v.snapshot_json, {});
    await db().batch(Object.entries(all).map(([k, val]) => db().prepare("UPDATE settings SET draft_json = ?, updated_at = ? WHERE key = ?").bind(JSON.stringify(val), t, k)));
  } else return fail(400, "Can't restore this kind of version");
  return json({ restored: true, updatedAt: t, note: "Restored into the draft. Publish to make it live." });
}

/* ---------- router ---------- */

type Handler = (ctx: Ctx, m: RegExpMatchArray) => Promise<Response> | Response;
const routes: [string, RegExp, Handler][] = [
  ["GET", /^bootstrap$/, async () => json({
    pages: await Promise.all(PAGE_IDS.map(getPage)),
    builds: await listBuilds(),
    settings: await getSettings(),
    devlog: await listDevlog(),
    milestones: (await db().prepare("SELECT * FROM milestones ORDER BY date ASC").all()).results,
    templates: (await db().prepare("SELECT id, version, name, sections_json, created_at, (SELECT COUNT(*) FROM builds b WHERE b.template_id = t.id AND b.template_ver = t.version AND b.deleted_at IS NULL) AS used FROM templates t ORDER BY id, version").all()).results,
    media: await listMedia(),
    modules: Object.keys(modules),
  })],
  ["GET", /^pages\/([a-z-]+)$/, (_c, m) => PAGE_IDS.includes(m[1]!) ? getPage(m[1]!).then(json) : fail(404, "Unknown page")],
  ["PATCH", /^pages\/([a-z-]+)$/, (c, m) => PAGE_IDS.includes(m[1]!) ? savePage(c, m[1]!) : fail(404, "Unknown page")],
  ["POST", /^pages\/([a-z-]+)\/publish$/, (c, m) => PAGE_IDS.includes(m[1]!) ? publishPage(c, m[1]!) : fail(404, "Unknown page")],
  ["GET", /^builds$/, async () => json(await listBuilds())],
  ["POST", /^builds$/, (c) => createBuild(c)],
  ["GET", /^builds\/([\w-]+)$/, async (_c, m) => { const r = await getBuildRow(m[1]!); return r ? json(buildOut(r)) : fail(404, "Build not found"); }],
  ["PATCH", /^builds\/([\w-]+)$/, (c, m) => saveBuild(c, m[1]!)],
  ["DELETE", /^builds\/([\w-]+)$/, (c, m) => deleteBuild(c, m[1]!)],
  ["POST", /^builds\/([\w-]+)\/publish$/, (c, m) => publishBuild(c, m[1]!)],
  ["POST", /^builds\/([\w-]+)\/unpublish$/, (c, m) => unpublishBuild(c, m[1]!)],
  ["POST", /^builds\/([\w-]+)\/upgrade$/, (c, m) => upgradeBuild(c, m[1]!)],
  ["GET", /^templates$/, async () => json((await db().prepare("SELECT * FROM templates ORDER BY id, version").all()).results)],
  ["POST", /^templates$/, (c) => importTemplate(c)],
  ["GET", /^settings$/, async () => json(await getSettings())],
  ["PATCH", /^settings\/(\w+)$/, (c, m) => saveSetting(c, m[1]!)],
  ["POST", /^settings\/publish$/, (c) => publishSettings(c)],
  ["POST", /^cv$/, (c) => uploadCv(c)],
  ["GET", /^devlog$/, async () => json(await listDevlog())],
  ["POST", /^devlog$/, (c) => createDevlog(c)],
  ["PATCH", /^devlog\/([\w-]+)$/, (c, m) => saveDevlog(c, m[1]!)],
  ["DELETE", /^devlog\/([\w-]+)$/, async (c, m) => {
    await db().batch([db().prepare("DELETE FROM devlog WHERE id = ?").bind(m[1]!), db().prepare("DELETE FROM media_usage WHERE owner_type = 'devlog' AND owner_id = ?").bind(m[1]!)]);
    purge(c);
    return json({ ok: true });
  }],
  ["GET", /^milestones$/, async () => json((await db().prepare("SELECT * FROM milestones ORDER BY date ASC").all()).results)],
  ["POST", /^milestones$/, async (c) => {
    const b = await body(c, milestoneShape);
    if (isResp(b)) return b;
    const id = uid();
    await db().prepare("INSERT INTO milestones (id, date, label, title, body, status) VALUES (?, ?, ?, ?, ?, ?)").bind(id, b.date, b.label, b.title, b.body, b.status).run();
    purge(c);
    return json({ id }, 201);
  }],
  ["PATCH", /^milestones\/([\w-]+)$/, async (c, m) => {
    const b = await body(c, milestoneShape);
    if (isResp(b)) return b;
    await db().prepare("UPDATE milestones SET date = ?, label = ?, title = ?, body = ?, status = ? WHERE id = ?").bind(b.date, b.label, b.title, b.body, b.status, m[1]!).run();
    purge(c);
    return json({ ok: true });
  }],
  ["DELETE", /^milestones\/([\w-]+)$/, async (c, m) => { await db().prepare("DELETE FROM milestones WHERE id = ?").bind(m[1]!).run(); purge(c); return json({ ok: true }); }],
  ["GET", /^media$/, async () => json(await listMedia())],
  ["POST", /^media$/, (c) => uploadMedia(c)],
  ["GET", /^media\/([\w-]+)\/usage$/, async (_c, m) => json(await usage(m[1]!))],
  ["POST", /^media\/([\w-]+)\/replace$/, (c, m) => replaceEverywhere(c, m[1]!)],
  ["DELETE", /^media\/([\w-]+)$/, (_c, m) => deleteMedia(m[1]!)],
  ["GET", /^versions$/, async (c) => {
    const type = c.url.searchParams.get("owner_type") ?? "";
    const id = c.url.searchParams.get("owner_id") ?? "";
    const r = await db().prepare("SELECT id, reason, created_at FROM versions WHERE owner_type = ? AND owner_id = ? ORDER BY created_at DESC LIMIT 50").bind(type, id).all();
    return json(r.results);
  }],
  ["POST", /^versions\/(\d+)\/restore$/, (c, m) => restoreVersion(c, Number(m[1]))],
  ["GET", /^health$/, async () => {
    const r = await db().prepare("SELECT * FROM health ORDER BY at DESC LIMIT 100").all();
    const tables = await db().prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").first<{ n: number }>();
    return json({ errors: r.results, checks: { d1Tables: tables?.n ?? 0, r2: !!env.MEDIA, accessConfigured: !!(env.CF_ACCESS_AUD && env.CF_ACCESS_TEAM_DOMAIN), analytics: !!env.CF_ANALYTICS_TOKEN, cache: env.CACHE_PAGES === "1" } });
  }],
  ["DELETE", /^health$/, async () => { await db().prepare("DELETE FROM health").run(); return json({ ok: true }); }],
  ["GET", /^analytics$/, () => json({
    available: false,
    message: "Page views live in Cloudflare Web Analytics. Open the dashboard: Analytics & Logs > Web Analytics > josefyang.com.",
    dashboard: "https://dash.cloudflare.com/?to=/:account/web-analytics",
  })],
];

const handle: APIRoute = async (ctx) => {
  const path = (ctx.params.path ?? "").replace(/\/$/, "");
  for (const [method, re, h] of routes) {
    if (method !== ctx.request.method) continue;
    const m = path.match(re);
    if (m) {
      try { return await h(ctx, m); } catch (err) {
        console.error("[api]", ctx.request.method, path, err);
        return fail(500, "Something went wrong on the server. Nothing was saved.");
      }
    }
  }
  return fail(404, "No such route");
};

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
