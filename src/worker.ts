/** Worker entry: Astro handles requests; the weekly cron backs up D1 to R2. */
import { handle } from "@astrojs/cloudflare/handler";
import { backupToR2 } from "./core/backup";

export default {
  fetch: handle,
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(backupToR2(env).then((k) => console.log(`[backup] wrote ${k}`)));
  },
} satisfies ExportedHandler<Env>;
