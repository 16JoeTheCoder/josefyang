/**
 * Admin API for the "Ready to publish" checklist: one D1 batch over pages, builds, settings, games and posts, then a plain-English
 * list of what still needs attention, each with a hash link to the editor that fixes it. Read-only. Lives under /api/admin/*, so the
 * middleware already enforces the Access JWT check.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { countMissingAlt, parseBlocksJson } from "../../../../core/blocks";
import { buildFields } from "../../../../core/build-fields";
import { PAGE_IDS } from "../../../../core/db";
import { walk, type Fields, type ImageValue, type TextValue, type VideoValue } from "../../../../core/fields";
import { gameFields } from "../../../../core/game-fields";
import type { Section } from "../../../../core/module";
import { getModule } from "../../../../core/registry";
import { settingsFields, type SettingsKey } from "../../../../core/settings";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const parse = <T>(s: string | null | undefined, fb: T): T => { if (!s) return fb; try { return JSON.parse(s) as T; } catch { return fb; } };

export interface CheckItem {
  id: string;
  kind: "fix" | "todo";
  area: string;
  title: string;
  detail: string;
  href: string;
}

const PLACEHOLDER = /\[[^\]\n]{1,60}\]/;
const NAMES: Record<string, string> = { home: "Home", projects: "Projects", failures: "Failures", devlog: "Devlog page", entry: "Devlog entry layout", about: "About" };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

interface Scan { placeholders: { label: string; sample: string }[]; noAlt: { label: string }[]; emptyImages: { label: string }[] }

function scan(fields: Fields, content: unknown): Scan {
  const out: Scan = { placeholders: [], noAlt: [], emptyImages: [] };
  for (const s of walk(fields, content)) {
    if (s.field.kind === "text") {
      const v = (s.value as TextValue | undefined)?.value ?? "";
      const m = v.match(PLACEHOLDER);
      if (m) out.placeholders.push({ label: s.field.label, sample: m[0] });
    } else if (s.field.kind === "image") {
      const v = s.value as ImageValue | undefined;
      if (!v?.mediaId) out.emptyImages.push({ label: s.field.label });
      else if (!v.alt?.trim()) out.noAlt.push({ label: s.field.label });
    } else if (s.field.kind === "video") {
      const v = s.value as VideoValue | undefined;
      if (v?.mediaId && !v.alt?.trim()) out.noAlt.push({ label: s.field.label });
    }
  }
  return out;
}

const samples = (xs: { sample: string }[]) => [...new Set(xs.map((x) => x.sample))].slice(0, 3).join(", ");
const labels = (xs: { label: string }[]) => [...new Set(xs.map((x) => x.label))].slice(0, 3).join(", ");

/** Issues in one piece of content (a page section, a build's meta, a game, one settings group). */
function issues(o: { idBase: string; area: string; what: string; href: string; fields: Fields; draft: unknown; published: unknown | null }): CheckItem[] {
  const items: CheckItem[] = [];
  const d = scan(o.fields, o.draft);
  const p = o.published != null ? scan(o.fields, o.published) : null;
  if (d.placeholders.length || p?.placeholders.length) {
    const hits = d.placeholders.length ? d.placeholders : p!.placeholders;
    items.push({
      id: `${o.idBase}:ph`, kind: "fix", area: o.area,
      title: `${o.what} still has ${plural(hits.length, "[placeholder]", "[placeholders]")} in the text`,
      detail: `Example: ${samples(hits)}.${p?.placeholders.length ? " This is on the live site." : ""}`, href: o.href,
    });
  }
  if (d.noAlt.length || p?.noAlt.length) {
    const hits = d.noAlt.length ? d.noAlt : p!.noAlt;
    items.push({ id: `${o.idBase}:alt`, kind: "fix", area: o.area, title: `${o.what}: ${plural(hits.length, "image")} without alt text`, detail: `Add a short description for ${labels(hits)}. Screen readers need it.`, href: o.href });
  }
  if (p?.emptyImages.length) {
    items.push({ id: `${o.idBase}:img`, kind: "fix", area: o.area, title: `${o.what}: ${plural(p.emptyImages.length, "image slot")} still empty on the live site`, detail: `Empty: ${labels(p.emptyImages)}.`, href: o.href });
  }
  return items;
}

async function check(): Promise<CheckItem[]> {
  const db = env.DB;
  const [pagesR, buildsR, settingsR, gamesR, devlogR] = await db.batch([
    db.prepare("SELECT id, draft_json, published_json FROM pages"),
    db.prepare("SELECT id, slug, title, draft_json, published_json FROM builds WHERE deleted_at IS NULL"),
    db.prepare("SELECT key, draft_json, published_json FROM settings"),
    db.prepare("SELECT id, slug, draft_json, published_json FROM games WHERE deleted_at IS NULL"),
    db.prepare("SELECT id, title, excerpt, status, publish_at, blocks_json FROM devlog"),
  ]);
  const items: CheckItem[] = [];

  // Pages: per section, so each row opens the right section.
  const pageRows = new Map((pagesR!.results as { id: string; draft_json: string; published_json: string | null }[]).map((r) => [r.id, r]));
  for (const id of PAGE_IDS) {
    const row = pageRows.get(id);
    const name = NAMES[id] ?? id;
    if (!row || !row.published_json) { items.push({ id: `page:${id}:new`, kind: "todo", area: "Page", title: `${name} has not been published`, detail: "The site shows the built-in layout until you publish it.", href: `#page/${id}` }); }
    else if (row.draft_json !== row.published_json) items.push({ id: `page:${id}:dirty`, kind: "todo", area: "Page", title: `${name} has changes that are not live`, detail: "Open it and press Publish.", href: `#page/${id}` });
    if (!row) continue;
    const draft = parse<Section[]>(row.draft_json, []);
    const pub = row.published_json ? parse<Section[]>(row.published_json, []) : null;
    for (const s of draft) {
      const m = getModule(s.moduleId);
      if (!m || s.hidden) continue;
      const ps = pub?.find((x) => x.sectionId === s.sectionId && !x.hidden);
      items.push(...issues({ idBase: `page:${id}:${s.sectionId}`, area: "Page", what: `${name}, ${m.name}`, href: `#page/${id}?s=${encodeURIComponent(s.sectionId)}`, fields: m.fields as Fields, draft: s.content, published: ps ? ps.content : null }));
    }
  }

  // Builds: meta, then each section.
  for (const r of buildsR!.results as { id: string; slug: string; title: string | null; draft_json: string; published_json: string | null }[]) {
    const d = parse<{ meta?: Record<string, unknown> & { title?: TextValue }; sections?: Section[] }>(r.draft_json, {});
    const p = r.published_json ? parse<{ meta?: unknown; sections?: Section[] }>(r.published_json, {}) : null;
    const name = d.meta?.title?.value || r.title || r.slug;
    const href = `#build/${r.id}`;
    if (!r.published_json) items.push({ id: `build:${r.id}:new`, kind: "todo", area: "Build", title: `${name} is a draft`, detail: "It is not on the site yet.", href });
    else if (r.draft_json !== r.published_json) items.push({ id: `build:${r.id}:dirty`, kind: "todo", area: "Build", title: `${name} has changes that are not live`, detail: "Open it and press Publish.", href });
    // Floor fields only matter on featured builds; failure fields only on failed ones.
    const skip = new Set<string>([...(d.meta?.featured ? [] : ["floorImage"]), ...(d.meta?.status === "failed" ? [] : ["tileImage", "whatBroke", "whatLearned", "failedOn", "lessonUrl"])]);
    const metaFields = Object.fromEntries(Object.entries(buildFields).filter(([k]) => !skip.has(k))) as Fields;
    items.push(...issues({ idBase: `build:${r.id}:meta`, area: "Build", what: `${name} (details)`, href, fields: metaFields, draft: d.meta ?? {}, published: p?.meta ?? null }));
    for (const s of d.sections ?? []) {
      const m = getModule(s.moduleId);
      if (!m || s.hidden) continue;
      const ps = p?.sections?.find((x) => x.sectionId === s.sectionId && !x.hidden);
      items.push(...issues({ idBase: `build:${r.id}:${s.sectionId}`, area: "Build", what: `${name}, ${m.name}`, href: `${href}?s=${encodeURIComponent(s.sectionId)}`, fields: m.fields as Fields, draft: s.content, published: ps ? ps.content : null }));
    }
  }

  // Settings.
  for (const r of settingsR!.results as { key: string; draft_json: string; published_json: string | null }[]) {
    const fields = settingsFields[r.key as SettingsKey] as Fields | undefined;
    if (!fields) continue;
    if (r.published_json && r.draft_json !== r.published_json) items.push({ id: `settings:${r.key}:dirty`, kind: "todo", area: "Settings", title: `Settings (${r.key}) has changes that are not live`, detail: "Open Settings and press Publish.", href: "#settings" });
    items.push(...issues({ idBase: `settings:${r.key}`, area: "Settings", what: `Settings (${r.key})`, href: "#settings", fields, draft: parse(r.draft_json, {}), published: r.published_json ? parse(r.published_json, {}) : null }));
  }

  // Games.
  for (const r of gamesR!.results as { id: string; slug: string; draft_json: string; published_json: string | null }[]) {
    const d = parse<{ game?: Record<string, unknown> & { name?: TextValue } }>(r.draft_json, {});
    const p = r.published_json ? parse<{ game?: unknown }>(r.published_json, {}) : null;
    const name = d.game?.name?.value || r.slug;
    const href = `#game/${r.id}`;
    if (!r.published_json) items.push({ id: `game:${r.id}:new`, kind: "todo", area: "Game", title: `${name} is a draft`, detail: "It is not on the game hub yet.", href });
    else if (r.draft_json !== r.published_json) items.push({ id: `game:${r.id}:dirty`, kind: "todo", area: "Game", title: `${name} has changes that are not live`, detail: "Open it and press Publish.", href });
    items.push(...issues({ idBase: `game:${r.id}`, area: "Game", what: name, href, fields: gameFields as Fields, draft: d.game ?? {}, published: p?.game ?? null }));
  }

  // Blog posts.
  const nowMs = Date.now();
  for (const r of devlogR!.results as { id: string; title: string; excerpt: string; status: string; publish_at: string | null; blocks_json: string | null }[]) {
    const name = r.title.trim() || "Untitled post";
    const href = `#entry/${r.id}`;
    const scheduled = r.status === "published" && r.publish_at && Date.parse(r.publish_at) > nowMs;
    if (scheduled) items.push({ id: `post:${r.id}:sched`, kind: "todo", area: "Post", title: `${name} is scheduled`, detail: `Goes live ${new Date(r.publish_at!).toUTCString()}.`, href });
    else if (r.status !== "published") items.push({ id: `post:${r.id}:draft`, kind: "todo", area: "Post", title: `${name} is a draft`, detail: "It is not on the site yet.", href });
    const ph = [r.title, r.excerpt].map((x) => x.match(PLACEHOLDER)?.[0]).filter(Boolean);
    if (ph.length) items.push({ id: `post:${r.id}:ph`, kind: "fix", area: "Post", title: `${name} still has a [placeholder] in its title or summary`, detail: `Example: ${ph[0]}.`, href });
    const missing = countMissingAlt(parseBlocksJson(r.blocks_json));
    if (missing) items.push({ id: `post:${r.id}:alt`, kind: "fix", area: "Post", title: `${name}: ${plural(missing, "image")} without alt text`, detail: "Posts cannot be published until every photo has alt text.", href });
  }

  // Fix-it items first, then to-dos.
  return items.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "fix" ? -1 : 1));
}

const handle: APIRoute = async (ctx) => {
  const path = (ctx.params.path ?? "").replace(/\/$/, "");
  if (ctx.request.method !== "GET" || path !== "") return json({ error: "No such route" }, 404);
  try { return json({ items: await check() }); } catch (err) {
    console.error("[api/checklist]", err);
    return json({ error: "Could not build the checklist." }, 500);
  }
};

export const GET = handle;
