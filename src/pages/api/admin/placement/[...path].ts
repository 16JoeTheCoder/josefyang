/**
 * Admin API for "Publish order": makes the Home floor order (featured + homeOrder) live for every affected build in one go,
 * without publishing the rest of each build's draft. Lives under /api/admin/*, so the middleware already enforces the Access
 * JWT check plus Origin and Content-Type rules. The small json/fail/purge helpers are copied from the main router on purpose.
 */
import type { APIContext, APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { purgeAndWarm } from "../../../../core/cache";

type Ctx = APIContext;
const db = () => env.DB;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
const fail = (status: number, error: string) => json({ error }, status);
const parse = <T>(s: string | null | undefined, fb: T): T => { if (!s) return fb; try { return JSON.parse(s) as T; } catch { return fb; } };

interface Row { id: string; draft_json: string; published_json: string | null }
interface Doc { meta?: { featured?: boolean; homeOrder?: number; title?: { value?: string } } }

async function publicPaths(): Promise<string[]> {
  const [b, d] = await db().batch([
    db().prepare("SELECT slug FROM builds WHERE published_json IS NOT NULL AND deleted_at IS NULL"),
    db().prepare("SELECT slug FROM devlog WHERE status = 'published'"),
  ]);
  return ["/", "/projects", "/failures", "/devlog", "/about",
    ...((b?.results ?? []) as { slug: string }[]).map((r) => `/builds/${r.slug}`),
    ...((d?.results ?? []) as { slug: string }[]).map((r) => `/devlog/${r.slug}`)];
}
function purge(ctx: Ctx) {
  if (env.CACHE_PAGES !== "1") return;
  ctx.locals.cfContext.waitUntil(publicPaths().then((p) => purgeAndWarm(ctx.url.origin, p)));
}

/** Key-order-independent JSON, so "same content, different key order" does not count as a change. */
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/** Published builds whose draft Home placement differs from what is live. */
async function pending() {
  const rows = (await db().prepare("SELECT id, draft_json, published_json FROM builds WHERE deleted_at IS NULL AND published_json IS NOT NULL").all<Row>()).results;
  const out: { id: string; title: string; wasFeatured: boolean; featured: boolean; wasOrder: number; order: number }[] = [];
  for (const r of rows) {
    const d = parse<Doc>(r.draft_json, {}).meta ?? {};
    const p = parse<Doc>(r.published_json, {}).meta ?? {};
    const df = !!d.featured, pf = !!p.featured;
    const dord = d.homeOrder ?? 1, pord = p.homeOrder ?? 1;
    if (df !== pf || (df && dord !== pord)) out.push({ id: r.id, title: d.title?.value ?? "", wasFeatured: pf, featured: df, wasOrder: pord, order: dord });
  }
  return out;
}

async function publishOrder(ctx: Ctx) {
  let raw: unknown = {};
  try { raw = await ctx.request.json(); } catch { /* empty body means "all pending" */ }
  const res = z.object({ ids: z.array(z.string().max(80)).max(200).optional() }).safeParse(raw);
  if (!res.success) return fail(400, "ids must be a list of build ids");
  const list = await pending();
  const want = res.data.ids ? list.filter((x) => res.data.ids!.includes(x.id)) : list;
  if (!want.length) return json({ published: 0 });
  const rows = (await db().prepare(`SELECT id, draft_json, published_json FROM builds WHERE id IN (${want.map(() => "?").join(",")})`).bind(...want.map((x) => x.id)).all<Row>()).results;
  const stmts = rows.flatMap((r) => {
    const d = parse<Doc>(r.draft_json, {}).meta ?? {};
    const pub = parse<{ meta?: Record<string, unknown> }>(r.published_json, {});
    if (!pub.meta) return [];
    pub.meta.featured = !!d.featured;
    pub.meta.homeOrder = d.homeOrder ?? 1;
    // If nothing else differs, store the draft text itself so the build does not show "unpublished changes" afterwards.
    const same = canon(parse(r.draft_json, {})) === canon(pub);
    return [db().prepare("UPDATE builds SET published_json = ?, featured = ?, home_order = ? WHERE id = ?").bind(same ? r.draft_json : JSON.stringify(pub), d.featured ? 1 : 0, d.homeOrder ?? 1, r.id)];
  });
  if (stmts.length) await db().batch(stmts);
  purge(ctx);
  return json({ published: stmts.length });
}

const handle: APIRoute = async (ctx) => {
  const path = (ctx.params.path ?? "").replace(/\/$/, "");
  try {
    if (ctx.request.method === "GET" && path === "status") return json({ pending: await pending() });
    if (ctx.request.method === "POST" && path === "publish") return await publishOrder(ctx);
  } catch (err) {
    console.error("[api/placement]", ctx.request.method, path, err);
    return fail(500, "Something went wrong on the server. Nothing was published.");
  }
  return fail(404, "No such route");
};

export const GET = handle;
export const POST = handle;
