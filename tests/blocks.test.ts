import { describe, expect, it } from "vitest";
import { countMissingAlt, parseBlocks, plainText, readMinutesFor } from "../src/core/blocks";
import { esc, renderBlocksToHtml } from "../src/core/posts";

const img = { mediaId: "m1", key: "m/abc123", widths: [480, 960, 1600], original: "orig.png", w: 1600, h: 900, alt: "A bench", caption: "On the <bench>", size: "normal" };
const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (text: string, marks?: unknown[]) => ({ type: "paragraph", content: [{ type: "text", text, marks }] });

describe("block validation", () => {
  it("accepts the whitelist", () => {
    const d = doc(
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hi" }] },
      p("bold", [{ type: "bold" }, { type: "link", attrs: { href: "https://example.com" } }]),
      { type: "bulletList", content: [{ type: "listItem", content: [p("x")] }] },
      { type: "orderedList", content: [{ type: "listItem", content: [p("y")] }] },
      { type: "blockquote", content: [p("q")] },
      { type: "codeBlock", attrs: { language: null }, content: [{ type: "text", text: "<b>" }] },
      { type: "horizontalRule" },
      { type: "image", attrs: img },
      { type: "gallery", attrs: { images: [img, img] } },
      { type: "video", attrs: { mediaId: "v", key: "m/vid1", original: "orig.mp4", alt: "clip", caption: "" } },
    );
    expect(parseBlocks(d)).not.toBeNull();
  });
  it("rejects script nodes, unknown nodes and heading level 1", () => {
    expect(parseBlocks(doc({ type: "script", content: [] }))).toBeNull();
    expect(parseBlocks(doc({ type: "iframe", attrs: { src: "https://x" } }))).toBeNull();
    expect(parseBlocks(doc({ type: "heading", attrs: { level: 1 }, content: [] }))).toBeNull();
    expect(parseBlocks(doc(p("x", [{ type: "underline" }])))).toBeNull();
  });
  it("rejects unsafe links", () => {
    for (const href of ["javascript:alert(1)", "//evil.com", "data:text/html,x", "", " javascript:alert(1)"]) {
      expect(parseBlocks(doc(p("x", [{ type: "link", attrs: { href } }])))).toBeNull();
    }
    expect(parseBlocks(doc(p("x", [{ type: "link", attrs: { href: "/builds/a" } }])))).not.toBeNull();
    expect(parseBlocks(doc(p("x", [{ type: "link", attrs: { href: "mailto:a@b.co" } }])))).not.toBeNull();
  });
  it("limits galleries to 2-8 images and rejects path-ish media keys", () => {
    expect(parseBlocks(doc({ type: "gallery", attrs: { images: [img] } }))).toBeNull();
    expect(parseBlocks(doc({ type: "gallery", attrs: { images: Array(9).fill(img) } }))).toBeNull();
    expect(parseBlocks(doc({ type: "image", attrs: { ...img, key: "../../etc" } }))).toBeNull();
    expect(parseBlocks(doc({ type: "image", attrs: { ...img, original: 'x" onerror="y' } }))).toBeNull();
  });
  it("strips unknown attributes on links", () => {
    const d = parseBlocks(doc(p("x", [{ type: "link", attrs: { href: "https://a.co", onclick: "x()", target: "_self" } }])));
    expect(JSON.stringify(d)).not.toContain("onclick");
  });
  it("counts images without alt", () => {
    const d = parseBlocks(doc({ type: "image", attrs: { ...img, alt: " " } }, { type: "gallery", attrs: { images: [img, { ...img, alt: "" }] } }));
    expect(countMissingAlt(d)).toBe(2);
  });
  it("derives plain text and read time", () => {
    const d = parseBlocks(doc(p("one two"), p("three")));
    expect(plainText(d)).toBe("one two\n\nthree");
    expect(readMinutesFor("word ".repeat(450))).toBe(2);
    expect(readMinutesFor("")).toBeNull();
  });
});

describe("renderBlocksToHtml", () => {
  it("escapes text, code and attributes", () => {
    const d = parseBlocks(doc(
      p('<script>alert("x")</script>', [{ type: "bold" }]),
      { type: "codeBlock", content: [{ type: "text", text: "<img src=x onerror=1>" }] },
      { type: "image", attrs: { ...img, alt: 'a"b<c', caption: "<i>cap</i>" } },
      p("link", [{ type: "link", attrs: { href: "https://a.co/?a=1&b=\"2\"" } }]),
    ))!;
    const html = renderBlocksToHtml(d, "/media");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<i>cap");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('alt="a&quot;b&lt;c"');
    expect(html).toContain("&amp;b=&quot;2&quot;");
  });
  it("builds a responsive img with lazy loading and a figcaption", () => {
    const html = renderBlocksToHtml(parseBlocks(doc({ type: "image", attrs: img }))!, "https://cdn.test/media/");
    expect(html).toContain('srcset="https://cdn.test/media/m/abc123/480.webp 480w, https://cdn.test/media/m/abc123/960.webp 960w, https://cdn.test/media/m/abc123/1600.webp 1600w"');
    expect(html).toContain('src="https://cdn.test/media/m/abc123/1600.webp"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("<figcaption>On the &lt;bench&gt;</figcaption>");
  });
  it("drops an unsafe link that bypassed validation", () => {
    const bad = { type: "doc", content: [p("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])] } as never;
    expect(renderBlocksToHtml(bad, "/media")).toBe("<p>x</p>");
  });
  it("esc covers quotes", () => expect(esc(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;"));
});
