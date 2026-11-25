/** Public post feed for the game hub and other josefyang.com sites (board contract: josefyang-posts/1). */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { mediaBase } from "../../../../core/media";
import { SITE_URL, listPosts } from "../../../../core/posts";

const ORIGIN_OK = /^(https:\/\/([a-z0-9-]+\.)*josefyang\.com|http:\/\/localhost:\d+)$/;

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";
  const h: Record<string, string> = { Vary: "Origin" };
  if (ORIGIN_OK.test(origin)) { h["Access-Control-Allow-Origin"] = origin; h["Access-Control-Allow-Methods"] = "GET, OPTIONS"; h["Access-Control-Allow-Headers"] = "Content-Type"; h["Access-Control-Max-Age"] = "86400"; }
  return h;
}

const notAllowed: APIRoute = ({ request }) => new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: { ...cors(request), Allow: "GET, OPTIONS", "Content-Type": "application/json" } });
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const OPTIONS: APIRoute = ({ request }) => new Response(null, { status: 204, headers: cors(request) });

export const GET: APIRoute = async ({ request, url }) => {
  const q = url.searchParams;
  const site = q.get("site");
  const type = q.get("type");
  const limit = Number(q.get("limit") ?? 20);
  const game = q.get("game");
  if ((site && site !== "main" && site !== "games") || (type && type !== "note" && type !== "article") || (game && !/^[a-z0-9-]{1,60}$/.test(game)) || !Number.isFinite(limit)) {
    return new Response(JSON.stringify({ error: "Bad query" }), { status: 400, headers: { "Content-Type": "application/json", ...cors(request) } });
  }
  const posts = await listPosts(env.DB, {
    mode: "published",
    site: (site as "main" | "games" | null) ?? undefined,
    game: game ?? undefined,
    type: (type as "note" | "article" | null) ?? undefined,
    limit,
    mediaBase: env.MEDIA_BASE_URL ? mediaBase(env.MEDIA_BASE_URL) : `${url.origin}/media`,
    siteUrl: env.SITE_URL || SITE_URL,
  });
  return new Response(JSON.stringify({ format: "josefyang-posts/1", posts }), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300", ...cors(request) },
  });
};
