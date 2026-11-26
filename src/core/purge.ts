/** Every public URL that can show published content, on both hosts. Used by publish purges and the scheduled-post cron. */
import { purgeAndWarm } from "./cache";

export async function purgeEverything(db: D1Database, origin: string, gameHost: string | undefined, extra: string[] = []): Promise<void> {
  const [b, d, g] = await db.batch([
    db.prepare("SELECT slug FROM builds WHERE published_json IS NOT NULL AND deleted_at IS NULL"),
    db.prepare("SELECT slug FROM devlog WHERE status = 'published'"),
    db.prepare("SELECT slug FROM games WHERE published_json IS NOT NULL AND deleted_at IS NULL"),
  ]);
  const slugs = (r: typeof b) => ((r?.results ?? []) as { slug: string | null }[]).map((x) => x.slug).filter((x): x is string => !!x);
  const games = slugs(g);
  const main = ["/", "/projects", "/failures", "/devlog", "/devlog/rss.xml", "/about",
    ...slugs(b).map((s) => `/builds/${s}`), ...slugs(d).map((s) => `/devlog/${s}`), ...extra];
  // Without a game host the hub lives on the main host under /games.
  if (!gameHost) main.push("/games", ...games.map((s) => `/games/${s}`));
  await purgeAndWarm(origin, main);
  if (gameHost) await purgeAndWarm(`https://${gameHost}`, ["/", ...games.map((s) => `/${s}`)]);
}
