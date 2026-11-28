import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { loadPageData } from "../../core/db";
import { mediaBase } from "../../core/media";
import { SITE_URL, esc, renderBlocksToHtml, renderBodyToHtml } from "../../core/posts";

export const GET: APIRoute = async ({ locals, site }) => {
  const origin = (env.SITE_URL || site?.origin || SITE_URL).replace(/\/$/, "");
  const { data } = await loadPageData(env.DB, locals.mode, { pageId: "devlog", sections: [], needs: { builds: true, devlog: { limit: 50, full: true } } });
  const mb = mediaBase(env.MEDIA_BASE_URL) === "/media" ? `${origin}/media` : mediaBase(env.MEDIA_BASE_URL);
  const posts = data.devlog.filter((e) => e.sites.includes("main")).slice(0, 50);
  const items = posts.map((e) => {
    const html = e.blocks ? renderBlocksToHtml(e.blocks, mb) : renderBodyToHtml(e.body);
    const when = new Date(e.publishAt ?? `${e.date}T12:00:00Z`).toUTCString();
    return `<item><title>${esc(e.title)}</title><link>${origin}/devlog/${esc(e.slug)}</link><guid isPermaLink="true">${origin}/devlog/${esc(e.slug)}</guid><pubDate>${when}</pubDate>${e.excerpt ? `<description>${esc(e.excerpt)}</description>` : ""}${[...new Set([...e.categoryTerms.map((term) => term.name), ...e.tags])].map((t) => `<category>${esc(t)}</category>`).join("")}<content:encoded><![CDATA[${html.replace(/]]>/g, "]]]]><![CDATA[>")}]]></content:encoded></item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(data.settings.seo.title.value)} devlog</title><link>${origin}/devlog</link><description>${esc(data.settings.seo.description.value)}</description><language>en</language><atom:link href="${origin}/devlog/rss.xml" rel="self" type="application/rss+xml"/>${items.join("")}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" } });
};
