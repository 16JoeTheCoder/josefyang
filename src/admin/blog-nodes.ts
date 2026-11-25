/**
 * Tiptap nodes for media blocks (image, gallery, video). Plain DOM node views so they mount inside
 * the Preact admin without a framework bridge. Captions and alt text are edited in place.
 */
import { Node, type Editor } from "@tiptap/core";
import type { ImageAttrs, VideoAttrs } from "../core/blocks";

export interface MediaNodeOptions {
  /** Opens the media picker and resolves to image attrs (or null when cancelled). */
  pickImage: () => Promise<ImageAttrs | null>;
}

const imageDefaults = { mediaId: { default: "" }, key: { default: "" }, widths: { default: [] }, original: { default: "" }, w: { default: null }, h: { default: null }, alt: { default: "" }, caption: { default: "" }, size: { default: "normal" } };
const videoDefaults = { mediaId: { default: "" }, key: { default: "" }, original: { default: "" }, w: { default: null }, h: { default: null }, alt: { default: "" }, caption: { default: "" } };

interface Src { key: string; widths?: number[]; original: string }
export const previewSrc = (m: Src) => {
  const ws = [...(m.widths ?? [])].sort((a, b) => a - b);
  const pick = ws.find((w) => w >= 960) ?? ws.at(-1);
  return `/media/${m.key}/${pick ? `${pick}.webp` : m.original}`;
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", attrs: Record<string, string> = {}): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function btn(label: string, act: string, cls = ""): HTMLButtonElement {
  const b = el("button", `mini ${cls}`.trim(), { type: "button", "data-act": act });
  b.textContent = label;
  return b;
}
function field(placeholder: string, label: string, cls: string, max: number): HTMLInputElement {
  return el("input", cls, { type: "text", placeholder, "aria-label": label, maxlength: String(max) });
}
const put = (parent: { appendChild: (c: never) => unknown }, ...kids: unknown[]) => { for (const k of kids) parent.appendChild(k as never); };
const setIfDiff = (i: HTMLInputElement, v: string) => { if (i.value !== v) i.value = v; };

type View = { dom: HTMLElement; update: (n: import("@tiptap/pm/model").Node) => boolean; stopEvent: (e: Event) => boolean; ignoreMutation: () => boolean };
const interactive = (e: Event) => e.target instanceof HTMLElement && !!e.target.closest("input, textarea, button");

function patcher(editor: Editor, getPos: () => number | undefined, ref: { node: import("@tiptap/pm/model").Node }) {
  return (patch: Record<string, unknown>) => {
    const pos = getPos();
    if (pos === undefined) return;
    editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, { ...ref.node.attrs, ...patch }));
  };
}
function remover(editor: Editor, getPos: () => number | undefined, ref: { node: import("@tiptap/pm/model").Node }) {
  return () => {
    const pos = getPos();
    if (pos === undefined) return;
    editor.view.dispatch(editor.view.state.tr.delete(pos, pos + ref.node.nodeSize));
    editor.commands.focus();
  };
}

export const ImageBlock = Node.create<MediaNodeOptions>({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() { return imageDefaults; },
  parseHTML() { return [{ tag: "figure[data-bp=image]" }]; },
  renderHTML() { return ["figure", { "data-bp": "image" }]; },
  addNodeView() {
    return ({ node, getPos, editor }): View => {
      const ref = { node };
      const patch = patcher(editor, getPos, ref);
      const dom = el("figure", "ed-fig");
      const img = el("img", "", { alt: "" });
      const cap = field("Add a caption", "Caption", "ed-cap", 300);
      const alt = field("Alt text (required): what the image shows", "Alt text", "ed-alt", 200);
      const bar = el("div", "ed-fig-bar");
      const size = btn("", "size");
      const del = btn("Remove", "remove", "danger");
      put(bar, size, del);
      put(dom, img, cap, alt, bar);
      const paint = (n: import("@tiptap/pm/model").Node) => {
        const a = n.attrs as ImageAttrs;
        img.src = previewSrc(a);
        setIfDiff(cap, a.caption ?? "");
        setIfDiff(alt, a.alt ?? "");
        alt.classList.toggle("bad", !String(a.alt ?? "").trim());
        alt.setAttribute("aria-invalid", String(!String(a.alt ?? "").trim()));
        size.textContent = a.size === "wide" ? "Wide" : "Normal width";
        size.setAttribute("aria-pressed", String(a.size === "wide"));
        dom.dataset.size = a.size;
      };
      paint(node);
      cap.addEventListener("input", () => patch({ caption: cap.value }));
      alt.addEventListener("input", () => patch({ alt: alt.value }));
      size.addEventListener("click", () => patch({ size: (ref.node.attrs as ImageAttrs).size === "wide" ? "normal" : "wide" }));
      del.addEventListener("click", remover(editor, getPos, ref));
      return {
        dom,
        update(n) { if (n.type.name !== "image") return false; ref.node = n; paint(n); return true; },
        stopEvent: interactive,
        ignoreMutation: () => true,
      };
    };
  },
});

export const GalleryBlock = Node.create<MediaNodeOptions>({
  name: "gallery",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addOptions() { return { pickImage: async () => null }; },
  addAttributes() { return { images: { default: [] } }; },
  parseHTML() { return [{ tag: "div[data-bp=gallery]" }]; },
  renderHTML() { return ["div", { "data-bp": "gallery" }]; },
  addNodeView() {
    const opts = this.options;
    return ({ node, getPos, editor }): View => {
      const ref = { node };
      const patch = patcher(editor, getPos, ref);
      const dom = el("div", "ed-gallery");
      const grid = el("div", "ed-gallery-grid");
      const bar = el("div", "ed-fig-bar");
      const add = btn("Add image", "add");
      const del = btn("Remove gallery", "remove", "danger");
      const note = el("span", "ed-note small");
      put(bar, add, del, note);
      put(dom, grid, bar);
      const imgs = () => (ref.node.attrs.images as ImageAttrs[]) ?? [];
      const paint = (n: import("@tiptap/pm/model").Node) => {
        const list = (n.attrs.images as ImageAttrs[]) ?? [];
        grid.textContent = "";
        list.forEach((im, i) => {
          const cell = el("figure", "ed-gcell");
          const img = el("img", "", { alt: "", src: previewSrc(im) });
          const alt = field("Alt text (required)", `Alt text, image ${i + 1}`, "ed-alt", 200);
          alt.value = im.alt ?? "";
          alt.classList.toggle("bad", !alt.value.trim());
          alt.addEventListener("input", () => patch({ images: imgs().map((x, k) => (k === i ? { ...x, alt: alt.value } : x)) }));
          const cap = field("Caption", `Caption, image ${i + 1}`, "ed-cap", 300);
          cap.value = im.caption ?? "";
          cap.addEventListener("input", () => patch({ images: imgs().map((x, k) => (k === i ? { ...x, caption: cap.value } : x)) }));
          const rm = btn("Remove", `rm-${i}`, "danger");
          rm.disabled = list.length <= 2;
          rm.addEventListener("click", () => patch({ images: imgs().filter((_, k) => k !== i) }));
          put(cell, img, cap, alt, rm);
          put(grid, cell);
        });
        add.disabled = list.length >= 8;
        note.textContent = `${list.length} of 8 images`;
      };
      paint(node);
      add.addEventListener("click", async () => {
        const im = await opts.pickImage();
        if (im) patch({ images: [...imgs(), im].slice(0, 8) });
      });
      del.addEventListener("click", remover(editor, getPos, ref));
      return {
        dom,
        // Rebuilding the grid on every keystroke would steal focus: only repaint when the image list changes shape.
        update(n) {
          if (n.type.name !== "gallery") return false;
          const prev = imgs();
          const next = (n.attrs.images as ImageAttrs[]) ?? [];
          ref.node = n;
          if (prev.length !== next.length || prev.some((p, i) => p.mediaId !== next[i]?.mediaId)) paint(n);
          else grid.querySelectorAll<HTMLInputElement>(".ed-alt").forEach((a, i) => a.classList.toggle("bad", !String(next[i]?.alt ?? "").trim()));
          return true;
        },
        stopEvent: interactive,
        ignoreMutation: () => true,
      };
    };
  },
});

export const VideoBlock = Node.create({
  name: "video",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,
  addAttributes() { return videoDefaults; },
  parseHTML() { return [{ tag: "figure[data-bp=video]" }]; },
  renderHTML() { return ["figure", { "data-bp": "video" }]; },
  addNodeView() {
    return ({ node, getPos, editor }): View => {
      const ref = { node };
      const patch = patcher(editor, getPos, ref);
      const dom = el("figure", "ed-fig");
      const video = el("video", "", { controls: "", preload: "metadata", playsinline: "" });
      const cap = field("Add a caption", "Caption", "ed-cap", 300);
      const alt = field("Alt text (required): what the clip shows", "Alt text", "ed-alt", 200);
      const bar = el("div", "ed-fig-bar");
      const del = btn("Remove", "remove", "danger");
      put(bar, del);
      put(dom, video, cap, alt, bar);
      const paint = (n: import("@tiptap/pm/model").Node) => {
        const a = n.attrs as VideoAttrs;
        const src = `/media/${a.key}/${a.original}`;
        if (video.getAttribute("src") !== src) video.src = src;
        setIfDiff(cap, a.caption ?? "");
        setIfDiff(alt, a.alt ?? "");
        alt.classList.toggle("bad", !String(a.alt ?? "").trim());
      };
      paint(node);
      cap.addEventListener("input", () => patch({ caption: cap.value }));
      alt.addEventListener("input", () => patch({ alt: alt.value }));
      del.addEventListener("click", remover(editor, getPos, ref));
      return {
        dom,
        update(n) { if (n.type.name !== "video") return false; ref.node = n; paint(n); return true; },
        stopEvent: (e) => interactive(e) || (e.target instanceof HTMLElement && e.target.tagName === "VIDEO"),
        ignoreMutation: () => true,
      };
    };
  },
});
