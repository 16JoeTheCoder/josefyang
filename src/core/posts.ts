/** Blog helpers shared by the site, the public feed and the game hub: block rendering and `listPosts`. */
import { urlSchema } from "./fields";
import {
  parseBlocksJson, plainText, readMinutesFor,
  type Block, type BlockDoc, type ImageAttrs, type Inline, type VideoAttrs,
} from "./blocks";
import { assignedTerms, postDraft, stringList, TAXONOMY_SQL, type TaxonomyTerm } from "./taxonomy";

export const SITE_URL = "https://josefyang.com";

/* ---------- rendering ---------- */

export function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const base = (b: string) => b.replace(/\/$/, "");
const safeHref = (h: string) => h !== "" && urlSchema.safeParse(h).success;

function renderInline(nodes: Inline[] | undefined): string {
  return (nodes ?? []).map((n) => {
    if (n.type === "hardBreak") return "<br>";
    let out = esc(n.text);
    for (const m of n.marks ?? []) {
      if (m.type === "bold") out = `<strong>${out}</strong>`;
      else if (m.type === "italic") out = `<em>${out}</em>`;
      else if (m.type === "code") out = `<code>${out}</code>`;
      else if (m.type === "link" && safeHref(m.attrs.href)) {
        const ext = /^https?:/.test(m.attrs.href);
        out = `<a href="${esc(m.attrs.href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${out}</a>`;
      }
    }
    return out;
  }).join("");
}

const srcFor = (mb: string, im: { key: string }, w: number | string) => `${base(mb)}/${im.key}/${w}.webp`;

function renderImg(im: ImageAttrs, mb: string, sizes: string): string {
  const ws = [...im.widths].sort((a, b) => a - b);
  const fallback = ws.filter((w) => w <= 1600).at(-1) ?? ws[0];
  const src = fallback ? srcFor(mb, im, fallback) : `${base(mb)}/${im.key}/${im.original}`;
  const srcset = ws.map((w) => `${srcFor(mb, im, w)} ${w}w`).join(", ");
  return `<img src="${esc(src)}"${srcset ? ` srcset="${esc(srcset)}" sizes="${esc(sizes)}"` : ""} alt="${esc(im.alt)}"${im.w ? ` width="${im.w}"` : ""}${im.h ? ` height="${im.h}"` : ""} loading="lazy" decoding="async">`;
}

function renderBlock(n: Block, mb: string): string {
  switch (n.type) {
    case "paragraph": return n.content?.length ? `<p>${renderInline(n.content)}</p>` : "";
    case "heading": return `<h${n.attrs.level}>${renderInline(n.content)}</h${n.attrs.level}>`;
    case "bulletList": return `<ul>${n.content.map((li) => `<li>${li.content.map((c) => renderBlock(c, mb)).join("")}</li>`).join("")}</ul>`;
    case "orderedList": return `<ol>${n.content.map((li) => `<li>${li.content.map((c) => renderBlock(c, mb)).join("")}</li>`).join("")}</ol>`;
    case "blockquote": return `<blockquote>${n.content.map((c) => renderBlock(c, mb)).join("")}</blockquote>`;
    case "codeBlock": return `<pre><code>${esc((n.content ?? []).map((t) => t.text).join(""))}</code></pre>`;
    case "horizontalRule": return "<hr>";
    case "image": {
      const wide = n.attrs.size === "wide";
      return `<figure class="bp-fig${wide ? " bp-wide" : ""}">${renderImg(n.attrs, mb, wide ? "(max-width: 1360px) 96vw, 1280px" : "(max-width: 760px) 92vw, 720px")}${n.attrs.caption ? `<figcaption>${esc(n.attrs.caption)}</figcaption>` : ""}</figure>`;
    }
    case "gallery": {
      const items = n.attrs.images.map((im) => `<figure class="bp-fig">${renderImg(im, mb, "(max-width: 760px) 92vw, 360px")}${im.caption ? `<figcaption>${esc(im.caption)}</figcaption>` : ""}</figure>`).join("");
      return `<div class="bp-gallery bp-wide bp-n${n.attrs.images.length}">${items}</div>`;
    }
    case "video": return renderVideo(n.attrs, mb);
  }
}

function renderVideo(v: VideoAttrs, mb: string): string {
  return `<figure class="bp-fig bp-wide"><video controls preload="metadata" playsinline src="${esc(`${base(mb)}/${v.key}/${v.original}`)}" aria-label="${esc(v.alt)}"${v.w && v.h ? ` width="${v.w}" height="${v.h}"` : ""}></video>${v.caption ? `<figcaption>${esc(v.caption)}</figcaption>` : ""}</figure>`;
}

/** Pure; escapes all text and attributes. Unknown nodes (which validation already rejects) render nothing. */
export function renderBlocksToHtml(blocks: BlockDoc | null | undefined, mediaBase: string): string {
  if (!blocks || !Array.isArray(blocks.content)) return "";
  return blocks.content.map((n) => renderBlock(n, mediaBase)).join("");
}

/** Plain-text paragraphs to HTML (the fallback for posts written before the editor). */
export function renderBodyToHtml(body: string): string {
  return body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/* ---------- listing ---------- */

export interface PublicPost {
  slug: string; title: string; type: "note" | "article"; excerpt: string; date: string; tags: string[]; url: string;
  cover: { src: string; w: number; h: number; alt: string } | null;
  build: { slug: string; title: string } | null;
  game: string | null; html: string; readMinutes: number | null;
}
export interface ListPostsOpts {
  mode: "published" | "draft";
  site?: "main" | "games";
  game?: string;
  type?: "note" | "article";
  limit?: number;
  /** Where /media lives (absolute for the feed). Default "/media". */
  mediaBase?: string;
  /** Origin used for `url`. Default https://josefyang.com. */
  siteUrl?: string;
  /** For tests. */
  now?: Date;
}

interface Row {
  slug: string | null; id: string; title: string; excerpt: string; body: string; type: string; tags_json: string; sites_json: string;
  game_slug: string | null; blocks_json: string | null; hero_media_id: string | null; entry_date: string | null; created_at: number;
  read_minutes: number | null; build_slug: string | null; build_meta: string | null;
  tag_ids_json: string | null; draft_json?: string | null;
}

export async function listPosts(db: D1Database, o: ListPostsOpts): Promise<PublicPost[]> {
  const isPublic = o.mode === "published";
  const where: string[] = [];
  const args: unknown[] = [];
  if (isPublic) {
    where.push("d.status = 'published' AND (d.publish_at IS NULL OR d.publish_at <= ?)");
    args.push((o.now ?? new Date()).toISOString());
    if (o.site) { where.push("d.sites_json LIKE ?"); args.push(`%"${o.site}"%`); }
    if (o.game) { where.push("d.game_slug = ?"); args.push(o.game); }
    if (o.type) { where.push("d.type = ?"); args.push(o.type); }
  }
  const limit = Math.min(100, Math.max(1, Math.floor(o.limit ?? 50)));
  const buildId = isPublic ? "d.build_id" : `CASE WHEN JSON_VALID(d.draft_json) THEN
    CASE WHEN JSON_TYPE(d.draft_json, '$.build_id') IS NOT NULL THEN JSON_EXTRACT(d.draft_json, '$.build_id') ELSE d.build_id END
    ELSE d.build_id END`;
  const sql = `SELECT d.*, b.slug AS build_slug, ${isPublic ? "b.published_json" : "b.draft_json"} AS build_meta
    FROM devlog d LEFT JOIN builds b ON b.id = ${buildId} AND b.deleted_at IS NULL
    ${isPublic ? `WHERE ${where.join(" AND ")} ORDER BY d.entry_date DESC, d.created_at DESC LIMIT ${limit}` : ""}`;
  const [postResult, terms] = await db.batch([db.prepare(sql).bind(...args), db.prepare(TAXONOMY_SQL)]);
  const taxonomy = new Map(((terms?.results ?? []) as unknown as TaxonomyTerm[]).map((term) => [term.id, term]));
  const rows = (postResult?.results ?? []) as unknown as Row[];
  const posts = isPublic ? rows : rows.map(postDraft).filter((r) => (!o.site || stringList(r.sites_json).includes(o.site)) &&
    (!o.game || r.game_slug === o.game) && (!o.type || r.type === o.type))
    .sort((a, b) => (b.entry_date ?? "").localeCompare(a.entry_date ?? "") || b.created_at - a.created_at).slice(0, limit);
  const mb = o.mediaBase ?? "/media";
  const site = (o.siteUrl ?? SITE_URL).replace(/\/$/, "");
  return posts.map((r) => {
    const doc = parseBlocksJson(r.blocks_json);
    const html = doc ? renderBlocksToHtml(doc, mb) : renderBodyToHtml(r.body ?? "");
    const text = doc ? plainText(doc) : r.body ?? "";
    let hero: { key?: string; widths?: number[]; original?: string; w?: number; h?: number; alt?: string; mediaId?: string | null } | null = null;
    try { hero = r.hero_media_id ? JSON.parse(r.hero_media_id) : null; } catch { hero = null; }
    let cover: PublicPost["cover"] = null;
    if (hero?.mediaId && hero.key) {
      const ws = (hero.widths ?? []).slice().sort((a, b) => a - b);
      const pick = ws.filter((w) => w <= 1600).at(-1) ?? ws[0];
      cover = { src: pick ? `${base(mb)}/${hero.key}/${pick}.webp` : `${base(mb)}/${hero.key}/${hero.original ?? "orig"}`, w: hero.w ?? 0, h: hero.h ?? 0, alt: hero.alt ?? "" };
    }
    if (!cover && doc) cover = firstBodyImage(doc, mb);
    let buildTitle = "";
    try { buildTitle = r.build_meta ? (JSON.parse(r.build_meta) as { meta?: { title?: { value?: string } } }).meta?.title?.value ?? "" : ""; } catch { /* keep empty */ }
    const slug = r.slug ?? r.id;
    return {
      slug, title: r.title, type: r.type === "article" ? "article" : "note",
      excerpt: r.excerpt || (text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text),
      date: r.entry_date ?? new Date(r.created_at).toISOString().slice(0, 10),
      tags: r.tag_ids_json == null ? stringList(r.tags_json) : assignedTerms(r.tag_ids_json, taxonomy, "tag").map((term) => term.name),
      url: `${site}/devlog/${slug}`, cover,
      build: r.build_slug && r.build_meta ? { slug: r.build_slug, title: buildTitle } : null,
      game: r.game_slug, html, readMinutes: doc ? readMinutesFor(text) : r.read_minutes,
    };
  });
}


/** Articles without a cover use the first image in the body (cards, og:image, the public feed). */
function firstBodyImage(doc: unknown, mb: string): PublicPost["cover"] {
  const seen: Record<string, unknown>[] = [];
  const visit = (n: unknown) => {
    if (seen.length || !n || typeof n !== "object") return;
    const o = n as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] };
    if (o.type === "image" && o.attrs?.key) seen.push(o.attrs);
    else if (o.type === "gallery" && Array.isArray(o.attrs?.images) && (o.attrs!.images as Record<string, unknown>[])[0]?.key) seen.push((o.attrs!.images as Record<string, unknown>[])[0]!);
    else o.content?.forEach(visit);
  };
  visit(doc);
  const im = seen[0] as { key: string; widths?: number[]; original?: string; w?: number; h?: number; alt?: string } | undefined;
  if (!im || !/^m\/[a-z0-9]+$/.test(im.key)) return null;
  const ws = (im.widths ?? []).slice().sort((a, b) => a - b);
  const pick = ws.filter((w) => w <= 1600).at(-1) ?? ws[0];
  return { src: pick ? `${base(mb)}/${im.key}/${pick}.webp` : `${base(mb)}/${im.key}/${im.original ?? "orig"}`, w: im.w ?? 0, h: im.h ?? 0, alt: im.alt ?? "" };
}
