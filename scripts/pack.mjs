// Zips packs/<slug>/ (project.json + media/) into dist-packs/<slug>.zip. Usage: npm run pack -- <slug>  (no slug = every pack)
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";

const ALLOWED = new Set(["webp", "png", "jpg", "jpeg", "avif", "mp4"]);
const LIMITS = { files: 60, total: 80 * 1024 * 1024, each: 25 * 1024 * 1024 };
const root = join(import.meta.dirname, "..");
const slugs = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(join(root, "packs")).filter((n) => statSync(join(root, "packs", n)).isDirectory());
if (!slugs.length) { console.error("No packs found in packs/."); process.exit(1); }

let failed = false;
for (const slug of slugs) {
  const dir = join(root, "packs", slug);
  const fail = (m) => { console.error(`${slug}: ${m}`); failed = true; };
  if (!existsSync(join(dir, "project.json"))) { fail("packs/" + slug + "/project.json is missing"); continue; }
  const project = readFileSync(join(dir, "project.json"));
  try {
    const j = JSON.parse(project.toString());
    if (j.format !== "josefyang-project/1") fail('format must be "josefyang-project/1"');
    if (j.slug !== slug) fail(`slug in project.json ("${j.slug}") must match the folder name`);
  } catch { fail("project.json is not valid JSON"); continue; }
  const files = { "project.json": project };
  let total = project.length;
  const mediaDir = join(dir, "media");
  for (const name of existsSync(mediaDir) ? readdirSync(mediaDir) : []) {
    if (name.startsWith(".")) continue;
    const ext = name.split(".").pop().toLowerCase();
    if (!/^[\w.-]+$/.test(name) || !ALLOWED.has(ext)) { fail(`media/${name}: use letters, numbers, . - _ and one of ${[...ALLOWED].join(", ")}`); continue; }
    const buf = readFileSync(join(mediaDir, name));
    if (buf.length > LIMITS.each) fail(`media/${name} is over 25 MB`);
    total += buf.length;
    files[`media/${name}`] = [buf, { level: 0 }];
  }
  if (Object.keys(files).length > LIMITS.files) fail(`more than ${LIMITS.files} files`);
  if (total > LIMITS.total) fail("over 80 MB in total");
  if (failed) continue;
  mkdirSync(join(root, "dist-packs"), { recursive: true });
  const out = join(root, "dist-packs", `${slug}.zip`);
  files["project.json"] = [strToU8(project.toString()), { level: 6 }];
  writeFileSync(out, zipSync(files));
  console.log(`${slug}: wrote dist-packs/${slug}.zip (${Object.keys(files).length - 1} media files, ${(total / 1024 / 1024).toFixed(1)} MB)`);
}
process.exit(failed ? 1 : 0);
