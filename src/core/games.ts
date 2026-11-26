/** Game hub data (public pages and admin API share these row mappers). */
import { gameDefaults, hubDefaults, type GameDoc, type HubCopy } from "./game-fields";
import { withDefaults } from "./fields";
import { settingsFromRows } from "./db";
import type { SiteSettings } from "./settings";
import { listPosts, type PublicPost } from "./posts";
import type { Mode } from "./types";

export const HUB_KEY = "games_hub";

export interface GameRow { id: string; slug: string; draft_json: string; published_json: string | null; sort: number; updated_at: number; published_at: number | null }
export interface GameRecord extends GameDoc { id: string; sort: number; updatedAt: number; publishedAt: number | null }

function parse<T>(s: string | null | undefined, fb: T): T {
  if (!s) return fb;
  try { return JSON.parse(s) as T; } catch { return fb; }
}

export function gameDocFromJson(json: string | null | undefined, slugFallback: string): GameDoc {
  const d = parse<Partial<GameDoc>>(json, {});
  return { slug: d.slug ?? slugFallback, game: withDefaults(gameDefaults(), d.game) };
}

export function gameFromRow(r: GameRow, mode: Mode): GameRecord | null {
  const json = mode === "draft" ? r.draft_json : r.published_json;
  if (!json) return null;
  return { ...gameDocFromJson(json, r.slug), id: r.id, sort: r.sort, updatedAt: r.updated_at, publishedAt: r.published_at };
}

export function hubFromJson(json: string | null | undefined): HubCopy {
  return withDefaults(hubDefaults, parse(json, {}));
}

export interface HubData { settings: SiteSettings; hub: HubCopy; games: GameRecord[] }

/** One batch for a hub page: site settings (for the layout), hub copy, games in hub order. */
export async function loadHub(db: D1Database, mode: Mode): Promise<HubData> {
  const [settingsRes, gamesRes, hubRes] = await db.batch([
    db.prepare("SELECT key, draft_json, published_json FROM settings"),
    db.prepare("SELECT id, slug, draft_json, published_json, sort, updated_at, published_at FROM games WHERE deleted_at IS NULL ORDER BY sort ASC, updated_at ASC"),
    db.prepare("SELECT draft_json, published_json FROM settings WHERE key = ?").bind(HUB_KEY),
  ]);
  const settings = settingsFromRows((settingsRes?.results ?? []) as { key: string; draft_json: string; published_json: string | null }[], mode);
  const hubRow = hubRes?.results[0] as { draft_json: string; published_json: string | null } | undefined;
  const hub = hubFromJson(mode === "draft" ? hubRow?.draft_json : hubRow?.published_json);
  const games = ((gamesRes?.results ?? []) as unknown as GameRow[]).map((r) => gameFromRow(r, mode)).filter((g): g is GameRecord => g !== null);
  return { settings, hub, games };
}

/** Public URL of the hub or one game. On the game host the paths drop the /games prefix. */
export function hubUrl(gameHost: string | undefined, origin: string, slug?: string): string {
  const base = gameHost ? `https://${gameHost}` : origin;
  const path = gameHost ? (slug ? `/${slug}` : "/") : (slug ? `/games/${slug}` : "/games");
  return base + path;
}

/** Links inside hub pages: relative to the host the visitor is on. */
export function hubPath(gameHost: string | undefined, host: string, slug?: string): string {
  const onGameHost = !!gameHost && host === gameHost;
  return onGameHost ? (slug ? `/${slug}` : "/") : (slug ? `/games/${slug}` : "/games");
}

export function stepLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

export function isPlayUrl(u: string): boolean {
  return /^https:\/\//.test(u);
}

/* ---------- devlog posts (src/core/posts.ts) ---------- */

/** Latest devlogs for the hub (all games) or one game. A failing feed never breaks the page. */
export async function hubPosts(db: D1Database, mode: Mode, o: { game?: string; limit: number }): Promise<PublicPost[]> {
  try {
    return await listPosts(db, { mode, site: "games", game: o.game, limit: o.limit });
  } catch (e) {
    console.error("[games] listPosts failed", e);
    return [];
  }
}
