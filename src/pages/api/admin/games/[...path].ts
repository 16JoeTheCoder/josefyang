/**
 * Admin API for the game hub (docs/GAME-CONTRACT.md). Lives under /api/admin/*, so the middleware already enforces the
 * Access JWT check plus Origin and Content-Type rules. The small json/fail/body helpers are copied from the main router on purpose.
 */
import type { APIContext, APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { purgeAffected } from "../../../../core/purge";
import { fieldsToZod, mediaRefs, publishProblems, type Problem } from "../../../../core/fields";
import { gameDefaults, gameFields, hubFields, type GameDoc } from "../../../../core/game-fields";
import { HUB_KEY, gameDocFromJson, hubFromJson, type GameRow } from "../../../../core/games";
import { slugify } from "../../../../lib/dates";

type Ctx = APIContext;
const db = () => env.DB;
const now = () => Date.now();
const uid = () => crypto.randomUUID();

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

/** Slugs the game host cannot serve at its root (they are real routes or asset folders). */
const RESERVED = new Set(["games", "game", "hub", "api", "admin", "media", "fonts", "preview", "favicon", "robots", "_astro"]);
const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes").max(60)
  .refine((s) => !RESERVED.has(s), "That address is reserved");
const docSchema = z.object({ slug: slugSchema, game: fieldsToZod(gameFields) });
const hubSchema = fieldsToZod(hubFields);

/* ---------- helpers ---------- */

async function setUsage(ownerType: string, ownerId: string, refs: { mediaId: string; path: string }[]) {
  const stmts = [db().prepare("DELETE FROM media_usage WHERE owner_type = ? AND owner_id = ?").bind(ownerType, ownerId)];
  for (const r of refs) {
    stmts.push(db().prepare("INSERT OR IGNORE INTO media_usage (media_id, owner_type, owner_id, field_path) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM media WHERE id = ?)")
      .bind(r.mediaId, ownerType, ownerId, r.path, r.mediaId));
  }
  await db().batch(stmts);
}

/** Problems that block publishing: over-long text, images without alt text, and an unusable game address. */
function gameProblems(doc: GameDoc): Problem[] {
  const g = doc.game;
  const out = publishProblems(gameFields, g, "game");
  if (!g.name.value.trim()) out.push({ path: "game.name", label: "Game name", message: "Give the game a name." });
  if (g.url && !/^https:\/\/[^\s/]+\.[^\s/]+/.test(g.url)) out.push({ path: "game.url", label: "Game address", message: "Must be the game's own https:// address." });
  if (!g.url && g.status !== "development") out.push({ path: "game.url", label: "Game address", message: "Add the game's address before marking it Playable or Released." });
  if (g.trailer.mediaId && !g.trailerPoster.mediaId) out.push({ path: "game.trailerPoster", label: "Trailer poster", message: "Add a poster image for the trailer." });
  return out;
}

/** After a publish: drop the cached catalog pages (bounded) and the main journey; no warming. */
function purge(ctx: Ctx) {
  if (env.CACHE_PAGES !== "1") return;
  ctx.locals.cfContext.waitUntil((async () => {
    const rows = await db().prepare("SELECT slug FROM games WHERE published_json IS NOT NULL AND deleted_at IS NULL").all<{ slug: string }>();
    const slugs = rows.results.map((r) => r.slug);
    await purgeAffected(ctx.url.origin, env.GAME_HOST, [], slugs);
  })());
}

/* ---------- games ---------- */

function out(r: GameRow) {
  const d = gameDocFromJson(r.draft_json, r.slug);
  return { id: r.id, slug: d.slug, game: d.game, sort: r.sort, updatedAt: r.updated_at, publishedAt: r.published_at, dirty: r.draft_json !== r.published_json };
}

const getRow = (id: string) => db().prepare("SELECT * FROM games WHERE id = ? AND deleted_at IS NULL").bind(id).first<GameRow>();

async function list() {
  const res = await db().prepare("SELECT * FROM games WHERE deleted_at IS NULL ORDER BY sort ASC, updated_at ASC").all<GameRow>();
  return json(res.results.map(out));
}

async function create(ctx: Ctx) {
  const b = await body(ctx, z.object({ name: z.string().trim().min(1).max(32) }));
  if (isResp(b)) return b;
  let slug = slugify(b.name) || "game";
  if (RESERVED.has(slug)) slug = `${slug}-game`;
  const taken = await db().prepare("SELECT slug FROM games WHERE slug LIKE ?").bind(`${slug}%`).all<{ slug: string }>();
  if (taken.results.some((r) => r.slug === slug)) slug = `${slug}-${taken.results.length + 1}`;
  const max = await db().prepare("SELECT COALESCE(MAX(sort), 0) AS m FROM games WHERE deleted_at IS NULL").first<{ m: number }>();
  const doc: GameDoc = { slug, game: { ...gameDefaults(b.name), name: { value: b.name } } };
  const id = uid();
  await db().prepare("INSERT INTO games (id, slug, draft_json, sort, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, slug, JSON.stringify(doc), (max?.m ?? 0) + 1, now()).run();
  return json({ id, slug }, 201);
}

async function save(ctx: Ctx, id: string) {
  const b = await body(ctx, z.object({ doc: docSchema, updatedAt: z.number() }));
  if (isResp(b)) return b;
  const row = await getRow(id);
  if (!row) return fail(404, "Game not found");
  if (row.updated_at > b.updatedAt) return fail(409, "Changed in another tab. Reload?");
  const clash = await db().prepare("SELECT id FROM games WHERE slug = ? AND id != ?").bind(b.doc.slug, id).first();
  if (clash) return fail(422, "Another game already uses this address");
  const doc = b.doc as unknown as GameDoc;
  const t = Math.max(now(), row.updated_at + 1);
  await db().prepare("UPDATE games SET draft_json = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(doc), t, id).run();
  await setUsage("game", id, mediaRefs(gameFields, doc.game, "game"));
  return json({ updatedAt: t, problems: gameProblems(doc) });
}

async function publish(ctx: Ctx, id: string) {
  const row = await getRow(id);
  if (!row) return fail(404, "Game not found");
  const doc = gameDocFromJson(row.draft_json, row.slug);
  const problems = gameProblems(doc);
  if (problems.length) return fail(422, "Fix these before publishing", { problems });
  const clash = await db().prepare("SELECT id FROM games WHERE slug = ? AND id != ?").bind(doc.slug, id).first();
  if (clash) return fail(422, "Another game already uses this address");
  const t = now();
  await db().prepare("UPDATE games SET published_json = draft_json, published_at = ?, slug = ? WHERE id = ?").bind(t, doc.slug, id).run();
  purge(ctx);
  return json({ publishedAt: t });
}

async function unpublish(ctx: Ctx, id: string) {
  await db().prepare("UPDATE games SET published_json = NULL, published_at = NULL WHERE id = ?").bind(id).run();
  purge(ctx);
  return json({ ok: true });
}

async function remove(ctx: Ctx, id: string) {
  await db().batch([
    db().prepare("UPDATE games SET deleted_at = ?, published_json = NULL, slug = slug || '-deleted-' || ? WHERE id = ?").bind(now(), now(), id),
    db().prepare("DELETE FROM media_usage WHERE owner_type = 'game' AND owner_id = ?").bind(id),
  ]);
  purge(ctx);
  return json({ ok: true });
}

async function order(ctx: Ctx) {
  const b = await body(ctx, z.object({ ids: z.array(z.string().max(64)).max(200) }));
  if (isResp(b)) return b;
  await db().batch(b.ids.map((id, i) => db().prepare("UPDATE games SET sort = ? WHERE id = ? AND deleted_at IS NULL").bind(i + 1, id)));
  purge(ctx);
  return json({ ok: true });
}

/* ---------- hub copy (settings row "games_hub") ---------- */

async function getHub() {
  const r = await db().prepare("SELECT draft_json, published_json, updated_at FROM settings WHERE key = ?").bind(HUB_KEY)
    .first<{ draft_json: string; published_json: string | null; updated_at: number }>();
  return json({ value: hubFromJson(r?.draft_json), updatedAt: r?.updated_at ?? 0, dirty: !r || r.draft_json !== r.published_json });
}

async function saveHub(ctx: Ctx) {
  const b = await body(ctx, z.object({ value: z.unknown(), updatedAt: z.number() }));
  if (isResp(b)) return b;
  const v = hubSchema.safeParse(hubFromJson(JSON.stringify(b.value)));
  if (!v.success) return fail(422, `${v.error.issues[0]?.path.join(".")} ${v.error.issues[0]?.message}`);
  const row = await db().prepare("SELECT updated_at FROM settings WHERE key = ?").bind(HUB_KEY).first<{ updated_at: number }>();
  if (row && row.updated_at > b.updatedAt) return fail(409, "Changed in another tab. Reload?");
  const t = Math.max(now(), (row?.updated_at ?? 0) + 1);
  await db().prepare("INSERT INTO settings (key, draft_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at")
    .bind(HUB_KEY, JSON.stringify(v.data), t).run();
  return json({ updatedAt: t, problems: publishProblems(hubFields, v.data, "hub") });
}

async function publishHub(ctx: Ctx) {
  const r = await db().prepare("SELECT draft_json, updated_at FROM settings WHERE key = ?").bind(HUB_KEY).first<{ draft_json: string; updated_at: number }>();
  const value = hubFromJson(r?.draft_json);
  const problems = publishProblems(hubFields, value, "hub");
  if (problems.length) return fail(422, "Fix these before publishing", { problems });
  const t = now();
  await db().prepare("INSERT INTO settings (key, draft_json, published_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET published_json = excluded.draft_json")
    .bind(HUB_KEY, JSON.stringify(value), JSON.stringify(value), r?.updated_at ?? t).run();
  purge(ctx);
  return json({ publishedAt: t });
}

/* ---------- router ---------- */

type Handler = (ctx: Ctx, m: RegExpMatchArray) => Promise<Response> | Response;
const routes: [string, RegExp, Handler][] = [
  ["GET", /^hub$/, () => getHub()],
  ["PATCH", /^hub$/, (c) => saveHub(c)],
  ["POST", /^hub\/publish$/, (c) => publishHub(c)],
  ["POST", /^order$/, (c) => order(c)],
  ["GET", /^$/, () => list()],
  ["POST", /^$/, (c) => create(c)],
  ["GET", /^([\w-]+)$/, async (_c, m) => { const r = await getRow(m[1]!); return r ? json(out(r)) : fail(404, "Game not found"); }],
  ["PATCH", /^([\w-]+)$/, (c, m) => save(c, m[1]!)],
  ["DELETE", /^([\w-]+)$/, (c, m) => remove(c, m[1]!)],
  ["POST", /^([\w-]+)\/publish$/, (c, m) => publish(c, m[1]!)],
  ["POST", /^([\w-]+)\/unpublish$/, (c, m) => unpublish(c, m[1]!)],
];

const handle: APIRoute = async (ctx) => {
  const path = (ctx.params.path ?? "").replace(/\/$/, "");
  for (const [method, re, h] of routes) {
    if (method !== ctx.request.method) continue;
    const m = path.match(re);
    if (m) {
      try { return await h(ctx, m); } catch (err) {
        console.error("[api/games]", ctx.request.method, path, err);
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
