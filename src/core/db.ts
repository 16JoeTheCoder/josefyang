/** Typed D1 access. Public pages use one batch per request (architecture §8.3). */
import { parseBlocksJson } from "./blocks";
import { buildMetaDefaults } from "./build-fields";
import { withDefaults, type ImageValue } from "./fields";
import type { Section } from "./module";
import { getModule } from "./registry";
import { settingsDefaults, type SiteSettings, type SettingsKey } from "./settings";
import { assignedTerms, postDraft, stringList, TAXONOMY_SQL, type TaxonomyTerm } from "./taxonomy";
import type { BuildDoc, BuildRecord, DevlogEntry, Milestone, Mode, PageData } from "./types";

export const now = () => Date.now();
export const uid = () => crypto.randomUUID();

function parse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

/* ---------- default page layouts ---------- */

export const pageLayouts: Record<string, string[]> = {
  home: ["home-hero", "featured-floor", "on-my-bench", "devlog-strip"],
  games: ["games-journey", "games-evidence", "games-updates"],
  projects: ["build-selector"],
  failures: ["failures-intro", "hopper", "failure-list"],
  devlog: ["devlog-intro", "devlog-feed"],
  entry: ["devlog-entry"],
  about: ["about-hero", "about-story", "text-band", "print-rig", "off-the-bench", "short-version", "find-me"],
};
export const PAGE_IDS = Object.keys(pageLayouts);
/** Fallback build-page layout when a build has no sections yet (mirrors template build-default v1). */
export const BUILD_LAYOUT = ["build-header", "build-hero-image", "build-rows", "build-end"];

export function sectionsFromModules(ids: string[]): Section[] {
  return ids.map((moduleId) => {
    const m = getModule(moduleId);
    return { sectionId: moduleId, moduleId, moduleVersion: m?.version ?? 1, content: structuredClone(m?.defaults ?? {}) };
  });
}

export function defaultSections(pageId: string): Section[] {
  return sectionsFromModules(pageLayouts[pageId] ?? []);
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

export interface DevlogRow { id: string; slug: string | null; title: string; excerpt: string; body: string; build_id: string | null; hero_media_id: string | null; media_ids: string; read_minutes: number | null; entry_date: string | null; created_at: number; status: string; updated_at: number; blocks_json?: string | null; type?: string; tags_json?: string; sites_json?: string; game_slug?: string | null; publish_at?: string | null; seo_description?: string | null; seo_title?: string | null; categories_json?: string; tag_ids_json?: string | null; draft_json?: string | null; published_at?: number | null; save_token?: string | null }

export function devlogFromRow(r: DevlogRow, builds: BuildRecord[], taxonomy: ReadonlyMap<string, TaxonomyTerm>): DevlogEntry {
  const b = r.build_id ? builds.find((x) => x.id === r.build_id) : undefined;
  const categories = assignedTerms(r.categories_json, taxonomy, "category");
  const tags = assignedTerms(r.tag_ids_json, taxonomy, "tag");
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

    readMinutes: r.read_minutes,
    date: r.entry_date ?? new Date(r.created_at).toISOString().slice(0, 10),
    status: r.status === "published" ? "published" : "draft",
    updatedAt: r.updated_at,
    blocks: parseBlocksJson(r.blocks_json),
    type: r.type === "article" ? "article" : "note",
    tags: r.tag_ids_json == null ? stringList(r.tags_json) : tags.map((tag) => tag.name),
    tagTerms: tags,
    categories: categories.map((term) => term.id),
    categoryTerms: categories,
    sites: parse<("main" | "games")[]>(r.sites_json, ["main"]),
    gameSlug: r.game_slug ?? null,
    publishAt: r.publish_at ?? null,
    seoTitle: r.seo_title ?? "",
    seoDescription: r.seo_description ?? "",
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

/* ---------- bounded reads ----------
 * Each module declares what it reads (MODULE_NEEDS). A page reads only what its saved sections need.
 * builds "cards" = meta-only JSON projection (no sections); devlog "lean" = list columns (no body/blocks).
 * A module missing from the map (custom or moved legacy section) gets the safe legacy read: everything.
 * Draft (preview) reads stay on the full path so previews always match the editor.
 */
export interface Needs { builds?: boolean; devlog?: { limit: number | null; full?: boolean; games?: boolean }; milestones?: boolean }
const GAMES_WIDEN = 60;
const LEGACY: Needs = { builds: true, devlog: { limit: 200, full: true }, milestones: true };
export const MODULE_NEEDS: Record<string, Needs> = {
  "home-hero": { builds: true }, "featured-floor": { builds: true }, "about-me-grid": {}, "own-tools": {}, "on-my-bench": {},
  "devlog-strip": { builds: true, devlog: { limit: 10 } },
  "build-selector": { builds: true },
  "failures-intro": {}, "hopper": { builds: true, devlog: { limit: null, full: true } }, "failure-list": { builds: true },
  "devlog-intro": { devlog: { limit: null } }, "devlog-feed": { builds: true, devlog: { limit: null } },
  "devlog-entry": { builds: true, devlog: { limit: null } },
  "about-hero": { builds: true }, "about-story": {}, "text-band": {}, "print-rig": { builds: true, milestones: true },
  "off-the-bench": {}, "short-version": {}, "find-me": {},
  "build-header": {}, "build-hero-image": {}, "build-rows": {}, "build-end": { builds: true },
  "showcase-intro": {}, "showcase-media": {}, "showcase-switch": {}, "showcase-figures": {}, "showcase-tabs": {}, "showcase-end": { builds: true },
  "chronos-runway": {}, "chronos-theme-studio": {},
  "games-journey": {}, "games-evidence": {}, "games-updates": { builds: true, devlog: { limit: 6, games: true } },
};

/** Union of the needs of the visible sections. */
export function needsFor(sections: Section[]): Needs {
  const out: Needs = {};
  for (const s of sections) {
    if (s.hidden) continue;
    const n = MODULE_NEEDS[s.moduleId] ?? LEGACY;
    if (n.builds) out.builds = true;
    if (n.milestones) out.milestones = true;
    if (n.devlog) {
      const cur = out.devlog;
      const games = cur ? !!(cur.games && n.devlog.games) : !!n.devlog.games;
      // Widening a games-only need with a general one: read enough general rows that the games filter still finds its
      // six (GAMES_WIDEN), instead of letting e.g. a 10-row strip starve the games list.
      const mixed = !!cur && !games && (!!cur.games !== !!n.devlog.games);
      const a = cur ? cur.limit : null, b = n.devlog.limit;
      const limit = !cur ? b : a === null || b === null ? null : Math.max(a, b, mixed ? GAMES_WIDEN : 0);
      out.devlog = { limit, full: !!(cur?.full || n.devlog.full), games };
    }
  }
  return out;
}

const BUILD_COLS = "id, slug, template_id, template_ver, updated_at, published_at";
/** Meta-only projection of the published document (no sections) for list cards. */
const BUILD_CARD_SQL = `SELECT ${BUILD_COLS}, NULL AS draft_json, CASE WHEN published_json IS NULL THEN NULL ELSE
  json_object('slug', json_extract(published_json, '$.slug'), 'meta', json(json_extract(published_json, '$.meta'))) END AS published_json
  FROM builds WHERE deleted_at IS NULL AND published_json IS NOT NULL`;
const DEVLOG_LEAN = "id, slug, title, excerpt, '' AS body, build_id, hero_media_id, '[]' AS media_ids, read_minutes, entry_date, created_at, status, updated_at, " +
  "NULL AS blocks_json, type, tags_json, sites_json, game_slug, publish_at, seo_description, seo_title, categories_json, tag_ids_json";
export const DEVLOG_PUBLIC_WHERE = "status = 'published' AND (publish_at IS NULL OR publish_at <= ?) AND sites_json LIKE '%\"main\"%'";
/** Game-related updates on the main journey: main-visible and tied to a game (game-only rows are already excluded). */
const GAMES_WHERE = " AND (game_slug IS NOT NULL OR sites_json LIKE '%\"games\"%')";

export interface LoadOpts { pageId?: string; sections?: Section[]; buildSlug?: string; entrySlug?: string; /** Extra reads for non-section routes (RSS). */ needs?: Needs }

/** One D1 batch per page. Returns the data the page's saved layout needs, plus the sections. */
export async function loadPageData(db: D1Database, mode: Mode, pageIdOrOpts?: string | LoadOpts): Promise<{ data: PageData; sections: Section[] }> {
  const o: LoadOpts = typeof pageIdOrOpts === "string" ? { pageId: pageIdOrOpts } : pageIdOrOpts ?? {};
  if (mode === "draft") return loadFull(db, mode, o);
  const pageRow = o.sections ? undefined : o.pageId
    ? await db.prepare("SELECT published_json FROM pages WHERE id = ?").bind(o.pageId).first<{ published_json: string | null }>()
    : null;
  const sections = o.sections ?? (pageRow?.published_json ? parse<Section[]>(pageRow.published_json, []) : defaultSections(o.pageId ?? ""));
  return loadPublished(db, sections, o);
}

async function loadPublished(db: D1Database, sections: Section[], o: LoadOpts): Promise<{ data: PageData; sections: Section[] }> {
  const iso = new Date().toISOString();
  // A build page's own sections are only known after its row is read, so build pages read cards for neighbours.
  const base = needsFor(sections);
  const needs: Needs = { ...base, ...(o.needs ?? {}), builds: !!(base.builds || o.needs?.builds || o.buildSlug) };
  const empty = "SELECT 1 WHERE 0";
  const d = needs.devlog;
  const devlogSql = d
    ? `SELECT ${d.full ? "*" : DEVLOG_LEAN} FROM devlog WHERE ${DEVLOG_PUBLIC_WHERE}${d.games ? GAMES_WHERE : ""} ORDER BY entry_date DESC, created_at DESC${d.limit ? ` LIMIT ${d.limit}` : ""}`
    : empty;
  const stmts = [
    db.prepare("SELECT key, draft_json, published_json FROM settings"),
    db.prepare(needs.builds ? BUILD_CARD_SQL : empty),
    d ? db.prepare(devlogSql).bind(iso) : db.prepare(empty),
    db.prepare(needs.milestones ? "SELECT * FROM milestones WHERE status = 'published' ORDER BY date ASC" : empty),
    db.prepare(d ? TAXONOMY_SQL : empty),
    o.buildSlug
      ? db.prepare(`SELECT ${BUILD_COLS}, NULL AS draft_json, published_json FROM builds WHERE slug = ? AND deleted_at IS NULL AND published_json IS NOT NULL LIMIT 1`).bind(o.buildSlug)
      : db.prepare(empty),
    o.entrySlug ? db.prepare(`SELECT * FROM devlog WHERE (slug = ? OR (slug IS NULL AND id = ?)) AND ${DEVLOG_PUBLIC_WHERE} LIMIT 1`).bind(o.entrySlug, o.entrySlug, iso) : db.prepare(empty),
  ];
  const [settingsRes, buildsRes, devlogRes, msRes, termsRes, oneBuildRes, oneEntryRes] = await db.batch(stmts);
  const builds = sortBuilds(((buildsRes?.results ?? []) as unknown as BuildRow[]).map((r) => buildFromRow(r, "published")).filter((b): b is BuildRecord => b !== null));
  const taxonomy = new Map(((termsRes?.results ?? []) as unknown as TaxonomyTerm[]).map((term) => [term.id, term]));
  const devlog = ((devlogRes?.results ?? []) as unknown as DevlogRow[]).map((row) => devlogFromRow(row, builds, taxonomy));
  const milestones = ((msRes?.results ?? []) as unknown as Milestone[]).map((m) => ({ ...m, body: m.body ?? "" }));
  const settings = settingsFromRows((settingsRes?.results ?? []) as { key: string; draft_json: string; published_json: string | null }[], "published");
  const data: PageData = { mode: "published", settings, builds, devlog, milestones };
  const oneBuild = oneBuildRes?.results[0] as unknown as BuildRow | undefined;
  if (oneBuild) data.build = buildFromRow(oneBuild, "published") ?? undefined;
  const oneEntry = oneEntryRes?.results[0] as unknown as DevlogRow | undefined;
  if (oneEntry) data.entry = devlogFromRow(oneEntry, builds, taxonomy);
  return { data, sections };
}

/** Draft/preview path: unchanged full read (all builds with sections, all devlog drafts). */
async function loadFull(db: D1Database, mode: Mode, o: LoadOpts): Promise<{ data: PageData; sections: Section[] }> {
  const pageId = o.pageId;
  const [pageRes, settingsRes, buildsRes, devlogRes, msRes, termsRes] = await db.batch([
    db.prepare("SELECT draft_json, published_json FROM pages WHERE id = ?").bind(pageId ?? ""),
    db.prepare("SELECT key, draft_json, published_json FROM settings"),
    db.prepare("SELECT id, slug, template_id, template_ver, draft_json, published_json, updated_at, published_at FROM builds WHERE deleted_at IS NULL"),
    db.prepare("SELECT * FROM devlog ORDER BY entry_date DESC, created_at DESC"),
    db.prepare("SELECT * FROM milestones ORDER BY date ASC"),
    db.prepare(TAXONOMY_SQL),
  ]);
  const pageRow = pageRes?.results[0] as { draft_json: string; published_json: string | null } | undefined;
  const sections = o.sections ?? (pageRow?.draft_json ? parse<Section[]>(pageRow.draft_json, []) : defaultSections(pageId ?? ""));
  const builds = sortBuilds(((buildsRes?.results ?? []) as unknown as BuildRow[]).map((r) => buildFromRow(r, mode)).filter((b): b is BuildRecord => b !== null));
  const taxonomy = new Map(((termsRes?.results ?? []) as unknown as TaxonomyTerm[]).map((term) => [term.id, term]));
  const devlog = ((devlogRes?.results ?? []) as unknown as DevlogRow[]).map((row) => devlogFromRow(postDraft(row), builds, taxonomy));
  const milestones = ((msRes?.results ?? []) as unknown as Milestone[]).map((m) => ({ ...m, body: m.body ?? "" }));
  const settings = settingsFromRows((settingsRes?.results ?? []) as { key: string; draft_json: string; published_json: string | null }[], mode);
  const data: PageData = { mode, settings, builds, devlog, milestones };
  if (o.buildSlug) data.build = builds.find((b) => b.slug === o.buildSlug);
  if (o.entrySlug) data.entry = devlog.find((e) => e.id === o.entrySlug) ?? devlog.find((e) => e.slug === o.entrySlug);
  return { data, sections };
}

/* ---------- health ---------- */

export async function logHealth(db: D1Database, page: string, section: string | null, module: string | null, message: string) {
  try {
    await db.prepare("INSERT INTO health (at, page, section, module, message) VALUES (?, ?, ?, ?, ?)")
      .bind(now(), page, section, module, message.slice(0, 1000)).run();
  } catch { /* health logging must never throw */ }
}
