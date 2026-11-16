/** Typed D1 access. Public pages use one batch per request (architecture §8.3). */
import { buildMetaDefaults } from "./build-fields";
import { withDefaults, type ImageValue } from "./fields";
import type { Section } from "./module";
import { getModule } from "./registry";
import { settingsDefaults, type SiteSettings, type SettingsKey } from "./settings";
import type { BuildDoc, BuildRecord, DevlogEntry, Milestone, Mode, PageData } from "./types";

export const now = () => Date.now();
export const uid = () => crypto.randomUUID();

function parse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

/* ---------- default page layouts ---------- */

export const pageLayouts: Record<string, string[]> = {
  home: ["home-hero", "featured-floor", "about-me-grid", "own-tools", "devlog-strip"],
  projects: ["build-selector"],
  failures: ["failures-intro", "hopper", "failure-list"],
  devlog: ["devlog-intro", "devlog-feed"],
  about: ["about-hero", "text-band", "print-rig", "off-the-bench", "short-version", "find-me"],
};
export const PAGE_IDS = Object.keys(pageLayouts);

export function defaultSections(pageId: string): Section[] {
  return (pageLayouts[pageId] ?? []).map((moduleId) => {
    const m = getModule(moduleId);
    return { sectionId: moduleId, moduleId, moduleVersion: m?.version ?? 1, content: structuredClone(m?.defaults ?? {}) };
  });
}

/* ---------- row mappers ---------- */

interface BuildRow { id: string; slug: string; template_id: string; template_ver: number; draft_json: string; published_json: string | null; updated_at: number; published_at: number | null }

export function buildFromRow(r: BuildRow, mode: Mode): BuildRecord | null {
  const json = mode === "draft" ? r.draft_json : r.published_json;
  if (!json) return null;
  const doc = parse<Partial<BuildDoc>>(json, {});
  return {
    id: r.id,
    slug: doc.slug ?? r.slug,
    meta: withDefaults(buildMetaDefaults(), doc.meta),
    sections: doc.sections ?? [],
    templateId: r.template_id,
    templateVer: r.template_ver,
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
  };
}

interface DevlogRow { id: string; slug: string | null; title: string; excerpt: string; body: string; build_id: string | null; hero_media_id: string | null; media_ids: string; fuse_url: string | null; read_minutes: number | null; entry_date: string | null; created_at: number; status: string; updated_at: number }

export function devlogFromRow(r: DevlogRow, builds: BuildRecord[]): DevlogEntry {
  const b = r.build_id ? builds.find((x) => x.id === r.build_id) : undefined;
  return {
    id: r.id,
    slug: r.slug ?? r.id,
    title: r.title,
    excerpt: r.excerpt,
    body: r.body,
    buildId: r.build_id,
    build: b ? { slug: b.slug, title: b.meta.title.value, failed: b.meta.status === "failed" } : null,
    hero: parse<ImageValue | null>(r.hero_media_id, null),
    images: parse<ImageValue[]>(r.media_ids, []),
    fuseUrl: r.fuse_url ?? "",
    readMinutes: r.read_minutes,
    date: r.entry_date ?? new Date(r.created_at).toISOString().slice(0, 10),
    status: r.status === "published" ? "published" : "draft",
    updatedAt: r.updated_at,
  };
}

/* ---------- settings ---------- */

export function settingsFromRows(rows: { key: string; draft_json: string; published_json: string | null }[], mode: Mode): SiteSettings {
  const out = structuredClone(settingsDefaults) as Record<string, unknown>;
  for (const r of rows) {
    if (!(r.key in out)) continue;
    const json = mode === "draft" ? r.draft_json : r.published_json;
    if (json) out[r.key] = withDefaults(settingsDefaults[r.key as SettingsKey], parse(json, {}));
  }
  return out as SiteSettings;
}

/* ---------- the one batch per page ---------- */

export function sortBuilds(builds: BuildRecord[]): BuildRecord[] {
  return [...builds].sort((a, b) => (b.meta.startedOn || "").localeCompare(a.meta.startedOn || "") || a.meta.title.value.localeCompare(b.meta.title.value));
}

export async function loadPageData(db: D1Database, mode: Mode, pageId?: string): Promise<{ data: PageData; sections: Section[] }> {
  const devlogWhere = mode === "draft" ? "" : "WHERE status = 'published'";
  const msWhere = mode === "draft" ? "" : "WHERE status = 'published'";
  const [pageRes, settingsRes, buildsRes, devlogRes, msRes] = await db.batch([
    db.prepare("SELECT draft_json, published_json FROM pages WHERE id = ?").bind(pageId ?? ""),
    db.prepare("SELECT key, draft_json, published_json FROM settings"),
    db.prepare("SELECT id, slug, template_id, template_ver, draft_json, published_json, updated_at, published_at FROM builds WHERE deleted_at IS NULL"),
    db.prepare(`SELECT * FROM devlog ${devlogWhere} ORDER BY entry_date DESC, created_at DESC LIMIT 200`),
    db.prepare(`SELECT * FROM milestones ${msWhere} ORDER BY date ASC`),
  ]);
  const pageRow = pageRes?.results[0] as { draft_json: string; published_json: string | null } | undefined;
  const pageJson = mode === "draft" ? pageRow?.draft_json : pageRow?.published_json;
  const sections = pageJson ? parse<Section[]>(pageJson, []) : defaultSections(pageId ?? "");
  const builds = sortBuilds(((buildsRes?.results ?? []) as unknown as BuildRow[]).map((r) => buildFromRow(r, mode)).filter((b): b is BuildRecord => b !== null));
  const devlog = ((devlogRes?.results ?? []) as unknown as DevlogRow[]).map((r) => devlogFromRow(r, builds));
  const milestones = ((msRes?.results ?? []) as unknown as Milestone[]).map((m) => ({ ...m, body: m.body ?? "" }));
  const settings = settingsFromRows((settingsRes?.results ?? []) as { key: string; draft_json: string; published_json: string | null }[], mode);
  return { data: { mode, settings, builds, devlog, milestones }, sections };
}

/* ---------- health ---------- */

export async function logHealth(db: D1Database, page: string, section: string | null, module: string | null, message: string) {
  try {
    await db.prepare("INSERT INTO health (at, page, section, module, message) VALUES (?, ?, ?, ?, ?)")
      .bind(now(), page, section, module, message.slice(0, 1000)).run();
  } catch { /* health logging must never throw */ }
}
