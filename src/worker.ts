/** Worker entry: Astro handles requests; crons back up D1 weekly and release scheduled posts hourly. */
import { handle } from "@astrojs/cloudflare/handler";
import { backupToR2 } from "./core/backup";
import { purgeEverything } from "./core/purge";

const BACKUP_CRON = "0 19 * * 6";

/** Posts whose publish_at passed in the last ~70 minutes are invisible behind the edge cache until purged. */
async function releaseScheduled(env: Env): Promise<string[]> {
  if (env.CACHE_PAGES !== "1") return [];
  const now = Date.now();
  const rows = await env.DB.prepare("SELECT slug, publish_at FROM devlog WHERE status = 'published' AND publish_at IS NOT NULL").all<{ slug: string | null; publish_at: string }>();
  const due = (rows.results ?? []).filter((r) => { const t = Date.parse(r.publish_at); return t <= now && t > now - 70 * 60_000; });
  if (!due.length) return [];
  const origin = (env.SITE_URL || "https://josefyang.com").replace(/\/$/, "");
  await purgeEverything(env.DB, origin, env.GAME_HOST);
  return due.map((r) => r.slug ?? "?");
}

export default {
  fetch: handle,
  async scheduled(event, env, ctx) {
    if (event.cron === BACKUP_CRON) ctx.waitUntil(backupToR2(env).then((k) => console.log(`[backup] wrote ${k}`)));
    else ctx.waitUntil(releaseScheduled(env).then((p) => p.length && console.log(`[schedule] purged ${p.join(", ")}`)));
  },
} satisfies ExportedHandler<Env>;
