/** Edge cache read/write/purge/warm (architecture §8.1–8.3). */
const edge = (): Cache => (caches as unknown as { default: Cache }).default;
const TTL = 60 * 60 * 24 * 7;
// Each build gets its own cache entries: cached HTML links to hashed CSS/JS files that the next deploy removes.
declare const __BUILD_ID__: string;

function key(url: string): Request {
  const u = new URL(url);
  u.search = `?build=${typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev"}`;
  u.hash = "";
  return new Request(u.toString(), { method: "GET" });
}

export async function cacheGet(url: string): Promise<Response | undefined> {
  return edge().match(key(url));
}

export async function cachePut(url: string, res: Response): Promise<void> {
  const copy = new Response(res.body, res);
  copy.headers.set("Cache-Control", `public, max-age=0, s-maxage=${TTL}`);
  await edge().put(key(url), copy);
}

/** Deletes each URL from the edge cache, then requests it once so the next visitor gets a hit. */
export async function purgeAndWarm(origin: string, paths: string[]): Promise<void> {
  const unique = [...new Set(paths)];
  await Promise.all(unique.map((p) => edge().delete(key(origin + p)).catch(() => false)));
  await Promise.all(unique.map((p) => fetch(origin + p, { headers: { "x-warm": "1" } }).catch(() => undefined)));
}
