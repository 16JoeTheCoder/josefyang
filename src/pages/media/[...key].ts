/** Serves R2 objects when media.josefyang.com isn't configured (and in local dev). Keys are content-hashed: cache forever. */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key ?? "";
  if (!/^(m|cv)\/[a-z0-9]+\/[\w.-]+$/.test(key)) return new Response("Not found", { status: 404 });
  const obj = await env.MEDIA.get(key, { onlyIf: request.headers });
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (!("body" in obj) || !obj.body) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
};
