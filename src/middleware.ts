import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";
import { verifyAdmin } from "./core/auth";
import { cacheGet, cachePut } from "./core/cache";
import { gameHostRewrite, gameHostServes, mainHostRedirect } from "./lib/game-host";

const PROTECTED = [/^\/admin(\/|$)/, /^\/preview(\/|$)/, /^\/api\/admin(\/|$)/];

function securityHeaders(res: Response, path: string): Response {
  const h = res.headers;
  const media = env.MEDIA_BASE_URL ? ` ${new URL(env.MEDIA_BASE_URL).origin}` : "";
  h.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      `img-src 'self' data: blob:${media}`,
      `media-src 'self' blob:${media}`,
      "font-src 'self'",
      "connect-src 'self' https://cloudflareinsights.com",
      `frame-ancestors ${path.startsWith("/preview") ? "'self'" : "'none'"}`,
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; "),
  );
  h.set("X-Content-Type-Options", "nosniff");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");
  if (!path.startsWith("/preview")) h.set("X-Frame-Options", "DENY");
  return res;
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const url = ctx.url;
  const path = url.pathname;
  // A /preview rewrite may re-enter this middleware with the public path: keep draft mode and skip caching.
  if (ctx.locals.mode === "draft") return next();
  ctx.locals.mode = "published";

  if (PROTECTED.some((r) => r.test(path))) {
    const email = await verifyAdmin(ctx.request, env);
    if (!email) {
      return securityHeaders(new Response(path.startsWith("/api/") ? JSON.stringify({ error: "forbidden" }) : "Forbidden", {
        status: 403,
        headers: { "Content-Type": path.startsWith("/api/") ? "application/json" : "text/plain" },
      }), path);
    }
    ctx.locals.adminEmail = email;
    // CSRF (architecture §14.3): writes must be JSON (or multipart uploads) from this origin.
    if (path.startsWith("/api/admin") && !["GET", "HEAD"].includes(ctx.request.method)) {
      const origin = ctx.request.headers.get("Origin");
      const type = ctx.request.headers.get("Content-Type") ?? "";
      const deny = (status: number, error: string) => securityHeaders(new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }), path);
      if (origin !== url.origin) return deny(403, "bad origin");
      if (ctx.request.method !== "DELETE" && !type.startsWith("application/json") && !type.startsWith("multipart/form-data")) return deny(415, "unsupported content type");
    }
    if (path.startsWith("/preview")) {
      ctx.locals.mode = "draft";
      const res = await next(path.replace(/^\/preview/, "") || "/");
      const out = new Response(res.body, res);
      out.headers.set("Cache-Control", "no-store");
      return securityHeaders(out, path);
    }
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "no-store");
    return securityHeaders(out, path);
  }

  // Game hub (game.josefyang.com): same app, host-based routing. Locally (no GAME_HOST) /games just works.
  let rewriteTo: string | undefined;
  if (env.GAME_HOST && ctx.request.method !== "POST") {
    if (url.hostname === env.GAME_HOST) {
      // The hub host serves only hub pages and shared assets, never the portfolio (duplicate content).
      if (!gameHostServes(path)) return securityHeaders(new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } }), path);
      rewriteTo = gameHostRewrite(path) ?? undefined;
    }
    else if (["GET", "HEAD"].includes(ctx.request.method)) {
      const to = mainHostRedirect(path, url.search, env.GAME_HOST);
      if (to) return Response.redirect(to, 301);
    }
  }

  const cacheable = env.CACHE_PAGES === "1" && ctx.request.method === "GET" && !path.startsWith("/api/") && !path.startsWith("/media/");
  if (cacheable && !ctx.request.headers.get("x-warm")) {
    const hit = await cacheGet(url.href);
    if (hit) return hit;
  }
  const res = rewriteTo ? await next(rewriteTo) : await next();
  const out = securityHeaders(new Response(res.body, res), path);
  if (cacheable && out.status === 200 && (out.headers.get("Content-Type") ?? "").includes("text/html")) {
    const [a, b] = out.body ? out.body.tee() : [null, null];
    const toCache = new Response(a, out);
    ctx.locals.cfContext?.waitUntil(cachePut(url.href, toCache));
    return new Response(b, out);
  }
  return out;
});
