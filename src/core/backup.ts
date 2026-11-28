/** Weekly D1 → R2 backup (architecture §17.3): one SQL file of INSERTs per run, keeping the last 8. */
const TABLES = ["pages", "templates", "builds", "devlog_taxonomy", "devlog", "milestones", "media", "media_usage", "settings", "versions"];
const KEEP = 8;

const lit = (v: unknown): string =>
  v === null || v === undefined ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

export async function backupToR2(env: { DB: D1Database; MEDIA: R2Bucket }): Promise<string> {
  const lines: string[] = [`-- josefyang.com D1 backup ${new Date().toISOString()}`, "PRAGMA defer_foreign_keys = true;"];
  for (const t of TABLES) {
    const { results } = await env.DB.prepare(`SELECT * FROM ${t}`).all<Record<string, unknown>>();
    lines.push(`DELETE FROM ${t};`);
    for (const row of results) {
      const cols = Object.keys(row);
      lines.push(`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map((c) => lit(row[c])).join(", ")});`);
    }
  }
  const key = `backups/db-${new Date().toISOString().slice(0, 10)}.sql`;
  await env.MEDIA.put(key, lines.join("\n"), { httpMetadata: { contentType: "application/sql" } });
  const list = await env.MEDIA.list({ prefix: "backups/" });
  const old = list.objects.map((o) => o.key).sort().slice(0, -KEEP);
  if (old.length) await env.MEDIA.delete(old);
  return key;
}
