/** Serves R2 objects when media.josefyang.com isn't configured (and in local dev). Keys are content-hashed: cache forever. */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key ?? "";
  if (!/^(m|cv)\/[a-z0-9]+\/[\w.-]+$/.test(key)) return new Response("Not found", { status: 404 });
  // Range requests (Safari/iOS will not play video without them).
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") ?? "");
  // An invalid spec (last < first) is ignored and the full body is sent (RFC 9110 §14.2).
  if (range && (range[1] || range[2]) && !(range[1] && range[2] && Number(range[1]) > Number(range[2]))) {
    const head = await env.MEDIA.head(key);
    if (!head) return new Response("Not found", { status: 404 });
    const size = head.size;
    let start: number, end: number;
    if (range[1] === "") { const n = Math.min(Number(range[2]), size); start = size - n; end = size - 1; }
    else { start = Number(range[1]); end = range[2] === "" ? size - 1 : Math.min(Number(range[2]), size - 1); }
    const h = new Headers();
    head.writeHttpMetadata(h);
    h.set("etag", head.httpEtag);
    h.set("Cache-Control", "public, max-age=31536000, immutable");
    h.set("Accept-Ranges", "bytes");
    if (start >= size || size === 0) { h.set("Content-Range", `bytes */${size}`); return new Response(null, { status: 416, headers: h }); }
    const part = await env.MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!part || !("body" in part) || !part.body) return new Response("Not found", { status: 404 });
    h.set("Content-Range", `bytes ${start}-${end}/${size}`);
    h.set("Content-Length", String(end - start + 1));
    return new Response(part.body, { status: 206, headers: h });
  }
  const obj = await env.MEDIA.get(key, { onlyIf: request.headers });
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  if (!("body" in obj) || !obj.body) return new Response(null, { status: 304, headers });
  return new Response(obj.body, { headers });
};
