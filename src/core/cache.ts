/**
 * Edge cache for public HTML (architecture §8.1–8.3, Phase 1 freshness policy).
 *
 * - Every cached page has a finite lifetime (`ttlFor`): 60 s for editorial HTML. That TTL is the real freshness
 *   bound: `cache.delete` only clears the data centre that runs it, so purges are a local speed-up, never a global
 *   invalidation.
 * - Keys carry the build id (cached HTML links to hashed assets that the next deploy removes) and only the query
 *   parameters that change the HTML (QUERY_KEYS, sorted), so meaningful variants never share an entry and
 *   meaningless ones (tracking, scans) never multiply renders.
 * - Nothing warms pages any more: the next visitor refills a purged or expired entry lazily.
 */
const edge = (): Cache => (caches as unknown as { default: Cache }).default;
declare const __BUILD_ID__: string;

/** Seconds a public HTML page may be served from the edge before it is rendered again. */
export const EDITORIAL_TTL = 60;
/** Hard cap on the paths one purge may touch, so publishes stay cheap no matter how much content exists. */
export const PURGE_LIMIT = 40;

/**
 * Query parameters that change the server-rendered HTML, per path. Today no public page reads its query on the
 * server (Devlog filters run in the browser), so every variant shares one entry and a query scan cannot fan out
 * renders. Add a path here when a page starts rendering from a parameter.
 */
export const QUERY_KEYS: Record<string, readonly string[]> = {};

export function ttlFor(_pathname: string): number {
  return EDITORIAL_TTL;
}

export function cacheKeyUrl(url: string): string {
  const u = new URL(url);
  const allowed = QUERY_KEYS[u.pathname] ?? [];
  const params = [...u.searchParams].filter(([k]) => allowed.includes(k))
    .sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y));
  const q = new URLSearchParams(params);
  q.append("__build", typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev");
  u.search = "?" + q.toString();
  u.hash = "";
  return u.toString();
}

const key = (url: string) => new Request(cacheKeyUrl(url), { method: "GET" });

export async function cacheGet(url: string): Promise<Response | undefined> {
  return edge().match(key(url));
}

export async function cachePut(url: string, res: Response): Promise<void> {
  const copy = new Response(res.body, res);
  const ttl = ttlFor(new URL(url).pathname);
  copy.headers.set("Cache-Control", `public, max-age=0, s-maxage=${ttl}`);
  await edge().put(key(url), copy);
}

/** Bounded, de-duplicated path list (first PURGE_LIMIT kept; the TTL covers anything beyond). */
export function boundedPaths(paths: string[]): string[] {
  return [...new Set(paths)].slice(0, PURGE_LIMIT);
}

/** Deletes each URL's entry in this data centre. No warm fetches: the next request refills it. */
export async function purgePaths(origin: string, paths: string[]): Promise<number> {
  const list = boundedPaths(paths);
  await Promise.all(list.map((p) => edge().delete(key(origin + p)).catch(() => false)));
  return list.length;
}
