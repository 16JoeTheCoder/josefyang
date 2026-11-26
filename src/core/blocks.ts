/**
 * Blog post documents: ProseMirror / Tiptap JSON with a strict whitelist.
 * Unknown node types or mark types fail validation; unknown keys are stripped (Zod object default),
 * so what we store is always exactly the whitelist. Link hrefs follow the same rule as every URL field.
 */
import { z } from "zod";
import { urlSchema } from "./fields";

export const MAX_DOC_BYTES = 400_000;

const mediaKey = z.string().regex(/^m\/[a-z0-9]{4,64}$/, "Bad media key");
const fileName = z.string().regex(/^[A-Za-z0-9_.-]{1,120}$/, "Bad file name");

/* ---------- marks + inline ---------- */

const linkHref = urlSchema.refine((v) => v !== "", "Link needs an address");
const markSchema = z.union([
  z.object({ type: z.enum(["bold", "italic", "code"]) }),
  z.object({ type: z.literal("link"), attrs: z.object({ href: linkHref }) }),
]);
const textNode = z.object({ type: z.literal("text"), text: z.string().min(1).max(20000), marks: z.array(markSchema).max(4).optional() });
const hardBreak = z.object({ type: z.literal("hardBreak") });
const inline = z.union([textNode, hardBreak]);

/* ---------- media blocks ---------- */

export const imageAttrs = z.object({
  mediaId: z.string().min(1).max(64),
  key: mediaKey,
  widths: z.array(z.number().int().min(16).max(6000)).max(8).default([]),
  original: fileName,
  w: z.number().int().min(1).max(20000).nullish().transform((v) => v ?? undefined),
  h: z.number().int().min(1).max(20000).nullish().transform((v) => v ?? undefined),
  alt: z.string().max(200).default(""),
  caption: z.string().max(300).default(""),
  size: z.enum(["normal", "wide"]).default("normal"),
});
export const videoAttrs = z.object({
  mediaId: z.string().min(1).max(64),
  key: mediaKey,
  original: fileName,
  w: z.number().int().min(1).max(20000).nullish().transform((v) => v ?? undefined),
  h: z.number().int().min(1).max(20000).nullish().transform((v) => v ?? undefined),
  alt: z.string().max(200).default(""),
  caption: z.string().max(300).default(""),
});
export type ImageAttrs = z.infer<typeof imageAttrs>;
export type VideoAttrs = z.infer<typeof videoAttrs>;

/* ---------- block nodes ---------- */

export type Mark = z.infer<typeof markSchema>;
export type Inline = z.infer<typeof inline>;
export type Block =
  | { type: "paragraph"; content?: Inline[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: Inline[] }
  | { type: "bulletList" | "orderedList"; content: ListItem[] }
  | { type: "blockquote"; content: Block[] }
  | { type: "codeBlock"; attrs?: { language?: string | null }; content?: { type: "text"; text: string }[] }
  | { type: "horizontalRule" }
  | { type: "image"; attrs: ImageAttrs }
  | { type: "gallery"; attrs: { images: ImageAttrs[] } }
  | { type: "video"; attrs: VideoAttrs };
export interface ListItem { type: "listItem"; content: Block[] }
export interface BlockDoc { type: "doc"; content: Block[] }

const paragraph = z.object({ type: z.literal("paragraph"), content: z.array(inline).max(500).optional() });
const heading = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
  content: z.array(inline).max(200).optional(),
});
const codeBlock = z.object({
  type: z.literal("codeBlock"),
  attrs: z.object({ language: z.string().regex(/^[A-Za-z0-9+#_-]{1,20}$/).nullish().transform((v) => v ?? undefined) }).optional(),
  content: z.array(z.object({ type: z.literal("text"), text: z.string().min(1).max(20000) })).max(5).optional(),
});
const hr = z.object({ type: z.literal("horizontalRule") });
const image = z.object({ type: z.literal("image"), attrs: imageAttrs });
const gallery = z.object({ type: z.literal("gallery"), attrs: z.object({ images: z.array(imageAttrs).min(2).max(8) }) });
const video = z.object({ type: z.literal("video"), attrs: videoAttrs });

const listItem: z.ZodType<ListItem> = z.lazy(() =>
  z.object({ type: z.literal("listItem"), content: z.array(block).min(1).max(20) }),
) as z.ZodType<ListItem>;
const list = (name: "bulletList" | "orderedList") => z.object({ type: z.literal(name), content: z.array(listItem).min(1).max(100) });
const blockquote = z.lazy(() => z.object({ type: z.literal("blockquote"), content: z.array(block).min(1).max(50) }));

const block: z.ZodType<Block> = z.lazy(() =>
  z.union([paragraph, heading, list("bulletList"), list("orderedList"), blockquote, codeBlock, hr, image, gallery, video]),
) as z.ZodType<Block>;

export const blockDocSchema: z.ZodType<BlockDoc> = z.object({
  type: z.literal("doc"),
  content: z.array(block).max(400),
}) as z.ZodType<BlockDoc>;

export const emptyDoc = (): BlockDoc => ({ type: "doc", content: [{ type: "paragraph" }] });

/** Validate and return the cleaned document, or null when invalid. */
export function parseBlocks(raw: unknown): BlockDoc | null {
  const r = blockDocSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Parse a stored JSON string; null when empty or invalid. */
export function parseBlocksJson(s: string | null | undefined): BlockDoc | null {
  if (!s) return null;
  try { return parseBlocks(JSON.parse(s)); } catch { return null; }
}

/* ---------- walkers ---------- */

export function walk(nodes: Block[], fn: (n: Block) => void): void {
  for (const n of nodes) {
    fn(n);
    if (n.type === "blockquote") walk(n.content, fn);
    if (n.type === "bulletList" || n.type === "orderedList") for (const li of n.content) walk(li.content, fn);
  }
}

export interface MediaRef { mediaId: string; alt: string; kind: "image" | "video"; path: string }
export function mediaRefs(doc: BlockDoc | null): MediaRef[] {
  const out: MediaRef[] = [];
  if (!doc) return out;
  let i = 0;
  walk(doc.content, (n) => {
    i++;
    if (n.type === "image") out.push({ mediaId: n.attrs.mediaId, alt: n.attrs.alt, kind: "image", path: `blocks[${i}]` });
    if (n.type === "video") out.push({ mediaId: n.attrs.mediaId, alt: n.attrs.alt, kind: "video", path: `blocks[${i}]` });
    if (n.type === "gallery") n.attrs.images.forEach((im, k) => out.push({ mediaId: im.mediaId, alt: im.alt, kind: "image", path: `blocks[${i}].${k}` }));
  });
  return out;
}
export const countMissingAlt = (doc: BlockDoc | null): number => mediaRefs(doc).filter((m) => !m.alt.trim()).length;

function inlineText(c: Inline[] | undefined): string {
  return (c ?? []).map((x) => (x.type === "text" ? x.text : " ")).join("");
}
/** Plain text, one paragraph-ish chunk per block, separated by blank lines (the `body` fallback). */
export function plainText(doc: BlockDoc | null): string {
  if (!doc) return "";
  const parts: string[] = [];
  walk(doc.content, (n) => {
    if (n.type === "paragraph" || n.type === "heading") parts.push(inlineText(n.content));
    else if (n.type === "codeBlock") parts.push((n.content ?? []).map((t) => t.text).join(""));
    else if (n.type === "image" && n.attrs.caption) parts.push(n.attrs.caption);
    else if (n.type === "video" && n.attrs.caption) parts.push(n.attrs.caption);
  });
  return parts.map((p) => p.trim()).filter(Boolean).join("\n\n");
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
/** 200 words per minute, at least 1 when there is any text. */
export function readMinutesFor(text: string): number | null {
  const n = wordCount(text);
  return n === 0 ? null : Math.max(1, Math.round(n / 200));
}
