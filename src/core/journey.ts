/**
 * Content contract for the main-site Games journey (Phase 2 extends associations without rebuilding the page).
 * Eligibility (deterministic): published, due, main-visible, tied to a game. Order = Devlog display order.
 */
import type { DevlogEntry } from "./types";

export const GAME_UPDATES_LIMIT = 6;

export interface GameUpdate { id: string; title: string; excerpt: string; date: string; href: string; game: string | null }

export function isGameUpdate(e: DevlogEntry): boolean {
  return e.status === "published" && e.sites.includes("main") && (!!e.gameSlug || e.sites.includes("games"));
}

export function gameUpdates(entries: DevlogEntry[], limit = GAME_UPDATES_LIMIT): GameUpdate[] {
  return entries.filter(isGameUpdate).slice(0, limit).map((e) => ({
    id: e.id, title: e.title, excerpt: e.excerpt, date: e.date, href: `/devlog/${e.slug}`, game: e.gameSlug,
  }));
}
