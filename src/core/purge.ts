/**
 * Bounded purge after a publish (Phase 1 freshness policy, see src/core/cache.ts).
 * Purges the listing pages that can show any published item plus the specific touched paths. Detail pages that
 * are not named (e.g. every build page after a Settings publish) refresh within the 60 s TTL instead of being
 * enumerated, so a publish never costs more than PURGE_LIMIT cache deletes and never warms anything.
 */
import { purgePaths } from "./cache";

/** Main-host pages that list or summarise published content. /games is the journey and lives on main even with GAME_HOST. */
export const MAIN_LISTINGS = ["/", "/projects", "/failures", "/devlog", "/devlog/rss.xml", "/about", "/games"] as const;

export function affectedMainPaths(extra: string[] = []): string[] {
  return [...MAIN_LISTINGS, ...extra];
}

/** Catalog pages: on the game host ("/", "/<slug>") or the local /hub routes when there is no game host. */
export function affectedCatalogPaths(gameHost: string | undefined, slugs: string[] = []): { origin?: string; paths: string[] } {
  if (gameHost) return { origin: `https://${gameHost}`, paths: ["/", ...slugs.map((s) => `/${s}`)] };
  return { paths: ["/hub", ...slugs.map((s) => `/hub/${s}`)] };
}

export async function purgeAffected(origin: string, gameHost: string | undefined, extra: string[] = [], gameSlugs: string[] = []): Promise<void> {
  await purgePaths(origin, affectedMainPaths(extra));
  const cat = affectedCatalogPaths(gameHost, gameSlugs);
  await purgePaths(cat.origin ?? origin, cat.paths);
}
