/**
 * Host-aware routing for the main site and the game catalog (pure, tested in tests/game-host.test.ts).
 *
 * Main host (josefyang.com):
 *   /games            the portfolio Games journey (always on main, never rewritten)
 *   /games/           301 → /games (slash policy), query kept
 *   /game, /game/     301 → /games, query kept
 *   /games/<slug>     301 → the catalog detail (game host /<slug>, or /hub/<slug> without GAME_HOST), query kept
 *   /hub*             internal catalog routes: 301 to the game host when GAME_HOST is set, served directly when not
 * Game host (game.josefyang.com, when this Worker serves it):
 *   /, /<slug>        rewritten to the internal catalog routes /hub and /hub/<slug>
 *   /games*, /hub*    legacy/internal spellings: 301 to / or /<slug> on the same host
 *   admin, preview    not served (they live on the main host only)
 *   anything else that is not an asset, media or public API: 404
 * Local contract (no GAME_HOST): the catalog lives at /hub on the same host; the journey stays at /games.
 */

export type Route =
  | { kind: "pass" }
  | { kind: "rewrite"; to: string }
  | { kind: "redirect"; location: string }
  | { kind: "notfound" };

/** Paths that are never rewritten on the game host: assets, media and public APIs. */
const SHARED = /^\/(_astro|fonts|media|api\/public|favicon[^/]*|robots\.txt|sitemap[^/]*)(\/|$)/;
const PRIVATE = /^\/(admin|preview|api\/admin)(\/|$)/;
/** Any root-level file (only) with an extension (granite.webp, manifest files, …) is a static asset. */
const HAS_EXT = /^\/[^/]+\.[A-Za-z0-9]+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Error pages that Astro.rewrite() targets: never re-routed (prevents a rewrite loop on the catalog host). */
const ERROR_PAGE = /^\/(404|500)\/?$/;
const PASS: Route = { kind: "pass" };

/** "/games/x/" → "x"; "/games" → "". Null when the rest is not a single slug. */
function tail(pathname: string, prefix: string): string | null {
  const rest = pathname.slice(prefix.length).replace(/\/+$/, "").replace(/^\//, "");
  if (rest === "") return "";
  return SLUG.test(rest) ? rest : null;
}

export function routeRequest(o: { pathname: string; search: string; method: string; gameHost?: string; host: string }): Route {
  const { pathname: p, search, gameHost } = o;
  const onGameHost = !!gameHost && o.host === gameHost;
  const read = o.method === "GET" || o.method === "HEAD";

  if (ERROR_PAGE.test(p)) return PASS;
  if (onGameHost) {
    if (PRIVATE.test(p)) return { kind: "notfound" };
    if (SHARED.test(p) || HAS_EXT.test(p)) return PASS;
    for (const prefix of ["/games", "/hub"]) {
      if (p === prefix || p.startsWith(prefix + "/")) {
        const slug = tail(p, prefix);
        if (slug === null) return { kind: "notfound" };
        return read ? { kind: "redirect", location: `/${slug}${search}` } : { kind: "notfound" };
      }
    }
    const slug = tail(p, "");
    if (slug === "") return { kind: "rewrite", to: "/hub" };
    if (slug) return { kind: "rewrite", to: `/hub/${slug}` };
    return { kind: "notfound" };
  }

  if (!read) return PASS;
  if (p === "/game" || p === "/game/" || p === "/games/") return { kind: "redirect", location: `/games${search}` };
  if (p.startsWith("/games/")) {
    const slug = tail(p, "/games");
    if (!slug) return PASS; // nested paths fall through to a real 404
    return { kind: "redirect", location: catalogUrl(gameHost, slug) + search };
  }
  if (gameHost && (p === "/hub" || p.startsWith("/hub/"))) {
    const slug = tail(p, "/hub");
    if (slug === null) return PASS;
    return { kind: "redirect", location: `https://${gameHost}/${slug}${search}` };
  }
  return PASS;
}

/** Catalog URL: absolute on the game host, or the local /hub routes when no game host is configured. */
export function catalogUrl(gameHost: string | undefined, slug?: string): string {
  if (gameHost) return `https://${gameHost}/${slug ?? ""}`;
  return slug ? `/hub/${slug}` : "/hub";
}

/** Admin, previews and the admin API are served only on the main host, plus localhost for development. */
export function privateHostAllowed(host: string, mainHost: string): boolean {
  return host === mainHost || host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** Main hostname from SITE_URL (default josefyang.com). */
export function mainHostOf(siteUrl: string | undefined): string {
  try { return new URL(siteUrl || "https://josefyang.com").hostname; } catch { return "josefyang.com"; }
}
