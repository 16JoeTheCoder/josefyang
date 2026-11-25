/** Host routing for the game hub (pure functions, tested in tests/game-host.test.ts). */

/** Paths that are never rewritten on the game host: assets, media, APIs, the admin and previews. */
const UNTOUCHED = /^\/(_astro|fonts|media|api|admin|preview|favicon[^/]*|robots\.txt|sitemap[^/]*)(\/|$)/;
/** Any root-level file with an extension (granite.webp, manifest files, …) is a static asset. */
const HAS_EXT = /\/[^/]+\.[A-Za-z0-9]+$/;

/** On the game host: "/" → "/games", "/slug" → "/games/slug". Null = leave the request as it is. */
export function gameHostRewrite(pathname: string): string | null {
  if (UNTOUCHED.test(pathname) || HAS_EXT.test(pathname)) return null;
  if (pathname === "/games" || pathname.startsWith("/games/")) return null;
  const clean = pathname.replace(/\/+$/, "");
  if (clean === "") return "/games";
  if (/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) return `/games${clean}`;
  return null;
}

/** On the main host: "/games" and "/games/slug" move to the game host (301). Null = no redirect. */
export function mainHostRedirect(pathname: string, search: string, gameHost: string | undefined): string | null {
  if (!gameHost) return null;
  if (pathname !== "/games" && !pathname.startsWith("/games/")) return null;
  const rest = pathname.slice("/games".length).replace(/\/+$/, "");
  return `https://${gameHost}${rest || "/"}${search}`;
}

/** The public path of a hub page on the game host ("/games/modulus" → "/modulus"). */
export function gameHostPath(pathname: string): string {
  const rest = pathname.replace(/^\/games/, "").replace(/\/+$/, "");
  return rest || "/";
}
