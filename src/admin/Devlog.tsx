/** Blog (notes and articles): writing-first editor on Tiptap, with a side panel for everything else. */
import { Editor, type JSONContent } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { strToU8, zipSync } from "fflate";
import { useEffect, useRef, useState } from "preact/hooks";
import { parseBlocks, plainText, type ImageAttrs } from "../core/blocks";
import { noImage, type ImageField, type ImageValue } from "../core/fields";
import { slugify } from "../lib/dates";
import { api, isApiError } from "./api";
import { useAutosave } from "./autosave";
import { GalleryBlock, ImageBlock, VideoBlock } from "./blog-nodes";
import type { BuildRec } from "./Builds";
import { ImageControl } from "./Fields";
import { uploadFile } from "./Library";
import { ago, useAdmin, type MediaItem } from "./state";
import "../styles/blog-prose.css";

export type PostType = "note" | "article";
export type Site = "main" | "games";
export interface Entry {
  id: string; slug: string; title: string; excerpt: string; body: string; buildId: string | null; hero: ImageValue | null; images: ImageValue[];
  fuseUrl: string; readMinutes: number | null; date: string; status: "draft" | "published"; updatedAt: number;
  blocks: JSONContent | null; type: PostType; tags: string[]; sites: Site[]; gameSlug: string | null; publishAt: string | null; seoDescription: string;
}

const COVER: ImageField = { kind: "image", label: "Cover image", ratio: "16 / 10", modes: ["fill"], empty: "Cover" };
const LINK_OK = /^(https?:\/\/|mailto:|\/(?![/\\]))/;

type PostState = "draft" | "scheduled" | "published";
export function postState(e: Pick<Entry, "status" | "publishAt">): PostState {
  if (e.status !== "published") return "draft";
  return e.publishAt && Date.parse(e.publishAt) > Date.now() ? "scheduled" : "published";
}
const STATE_LABEL: Record<PostState, string> = { draft: "Draft", scheduled: "Scheduled", published: "Published" };
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(+d) ? "" : new Date(+d - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const localDate = (d: Date) => new Date(+d - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

/* ---------- list ---------- */

export function DevlogList({ entries, builds, onOpen, onChanged }: { entries: Entry[]; builds: BuildRec[]; onOpen: (id: string) => void; onChanged: () => void }) {
  const { toast } = useAdmin();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | PostType>("");
  const [state, setState] = useState<"" | PostState>("");
  const bench = builds.find((b) => b.meta.status === "bench");
  const create = async (t: PostType) => {
    try {
      const r = await api<{ id: string }>("POST", "devlog", { title: t === "note" ? "Untitled note" : "Untitled article", buildId: bench?.id ?? null, type: t });
      await onChanged();
      onOpen(r.id);
    } catch (x) { toast(isApiError(x) ? x.error : "Could not create the post"); }
  };
  const needle = q.trim().toLowerCase();
  const list = entries.filter((e) =>
    (!type || e.type === type) && (!state || postState(e) === state) &&
    (!needle || e.title.toLowerCase().includes(needle) || e.tags.some((t) => t.toLowerCase().includes(needle)) || e.excerpt.toLowerCase().includes(needle)));
  return (
    <div class="page-pad narrow blog-list">
      <div class="blog-list-head">
        <h1>Blog</h1>
        <div class="blog-new">
          <button type="button" class="primary" onClick={() => create("note")}>New note</button>
          <button type="button" class="primary" onClick={() => create("article")}>New article</button>
        </div>
      </div>
      <p class="muted">Notes are quick and text-first. Articles get a cover and a headline. On the bench: <strong>{bench?.meta.title.value ?? "nothing yet"}</strong>.</p>
      <div class="blog-filters">
        <label class="sr-only" for="bq">Search posts</label>
        <input id="bq" type="search" placeholder="Search posts" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <label class="sr-only" for="bt">Type</label>
        <select id="bt" value={type} onChange={(e) => setType((e.target as HTMLSelectElement).value as "" | PostType)}>
          <option value="">All types</option><option value="note">Notes</option><option value="article">Articles</option>
        </select>
        <label class="sr-only" for="bs">Status</label>
        <select id="bs" value={state} onChange={(e) => setState((e.target as HTMLSelectElement).value as "" | PostState)}>
          <option value="">All statuses</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option>
        </select>
      </div>
      {list.length === 0 && <p class="muted">{entries.length ? "Nothing matches." : "No posts yet. Start with a note."}</p>}
      <ul class="cards-list">
        {list.map((e) => {
          const s = postState(e);
          return (
            <li><button type="button" class="card-btn" onClick={() => onOpen(e.id)}>
              <span class="row-top">
                <span class={`state state-${s}`}>{STATE_LABEL[s]}</span>
                <span class="state state-type">{e.type === "article" ? "Article" : "Note"}</span>
                {e.sites.includes("games") && <span class="state state-type">Game hub</span>}
              </span>
              <strong>{e.title}</strong>
              <span class="muted small">{s === "scheduled" ? `Goes live ${new Date(e.publishAt!).toLocaleString()}` : e.date}, edited {ago(e.updatedAt)}</span>
            </button></li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- helpers ---------- */

const bodyToDoc = (body: string): JSONContent => ({
  type: "doc",
  content: body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
});

/** Number of media blocks without alt text (works on raw editor JSON, valid or not). */
function missingAltIn(doc: JSONContent | null): number {
  let n = 0;
  const visit = (x: JSONContent) => {
    if ((x.type === "image" || x.type === "video") && !String(x.attrs?.alt ?? "").trim()) n++;
    if (x.type === "gallery") for (const im of (x.attrs?.images ?? []) as { alt?: string }[]) if (!String(im.alt ?? "").trim()) n++;
    x.content?.forEach(visit);
  };
  if (doc) visit(doc);
  return n;
}
function mediaIn(doc: JSONContent | null): { key: string; original: string }[] {
  const out: { key: string; original: string }[] = [];
  const visit = (x: JSONContent) => {
    if ((x.type === "image" || x.type === "video") && x.attrs?.key) out.push({ key: x.attrs.key, original: x.attrs.original });
    if (x.type === "gallery") for (const im of (x.attrs?.images ?? []) as { key: string; original: string }[]) out.push(im);
    x.content?.forEach(visit);
  };
  if (doc) visit(doc);
  return out;
}

const imageAttrsFrom = (m: MediaItem): ImageAttrs => ({
  mediaId: m.id, key: m.key, widths: m.widths, original: m.original, w: m.w ?? undefined, h: m.h ?? undefined, alt: m.alt ?? "", caption: "", size: "normal",
});

async function exportPack(e: Entry, buildTitle: string) {
  const files: Record<string, Uint8Array> = {};
  const doc = parseBlocks(e.blocks);
  const text = doc ? plainText(doc) : e.body;
  const fm = ["---", `title: ${JSON.stringify(e.title)}`, `type: ${e.type}`, `build: ${JSON.stringify(buildTitle)}`, `date: ${e.date}`, `status: ${e.status}`, `tags: ${JSON.stringify(e.tags)}`, `fuse: ${e.fuseUrl || ""}`, "---", "", e.excerpt, "", text, ""].join("\n");
  files["post.md"] = strToU8(fm);
  files["post.json"] = strToU8(JSON.stringify(e.blocks ?? {}, null, 2));
  const imgs = [e.hero, ...e.images].filter((x): x is ImageValue => !!x?.mediaId && !!x.key).map((x) => ({ key: x.key!, original: x.original! })).concat(mediaIn(e.blocks));
  for (const [i, im] of imgs.entries()) {
    const res = await fetch(`/media/${im.key}/${im.original}`);
    if (res.ok) files[`images/${String(i + 1).padStart(2, "0")}-${im.original}`] = new Uint8Array(await res.arrayBuffer());
  }
  const blob = new Blob([zipSync(files, { level: 0 })], { type: "application/zip" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${e.date}-${e.slug}-post-pack.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* ---------- the body editor ---------- */

function T({ label, title, act, active, run }: { label: string; title: string; act: string; active?: boolean; run: () => void }) {
  return (
    <button type="button" class={`tb ${active ? "on" : ""}`} title={title} aria-label={title} aria-pressed={active === undefined ? undefined : active} data-tb={act}
      onMouseDown={(e) => e.preventDefault()} onClick={run}>{label}</button>
  );
}

interface BodyProps { initial: JSONContent; onDoc: (doc: JSONContent, missingAlt: number) => void; initialMissing: (n: number) => void }

function BodyEditor({ initial, onDoc, initialMissing }: BodyProps) {
  const admin = useAdmin();
  const adminRef = useRef(admin);
  adminRef.current = admin;
  const host = useRef<HTMLDivElement>(null);
  const edRef = useRef<Editor | null>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const onDocRef = useRef(onDoc);
  onDocRef.current = onDoc;
  const [, tick] = useState(0);
  const [busy, setBusy] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkVal, setLinkVal] = useState("");
  const [linkErr, setLinkErr] = useState("");

  const guard = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy((b) => b + 1);
    try { return await fn(); } catch (x) { adminRef.current.toast(x instanceof Error ? x.message : isApiError(x) ? x.error : "Upload failed"); return null; } finally { setBusy((b) => b - 1); }
  };
  const upload = async (file: File): Promise<MediaItem | null> => guard(async () => {
    const r = await uploadFile(file);
    if (r.warning) adminRef.current.toast(`${file.name}: ${r.warning}`);
    await adminRef.current.refreshMedia();
    return r.item;
  });
  const insertImages = async (files: File[], pos?: number) => {
    for (const f of files) {
      const item = await upload(f);
      const ed = edRef.current;
      if (!item || !ed) continue;
      const chain = ed.chain().focus();
      if (pos !== undefined) chain.setTextSelection(Math.min(pos, ed.state.doc.content.size));
      chain.insertContent({ type: "image", attrs: imageAttrsFrom(item) }).run();
      pos = undefined;
    }
  };
  const pickImage = async (): Promise<ImageAttrs | null> => {
    const m = await adminRef.current.pickMedia();
    return m ? imageAttrsFrom(m) : null;
  };

  useEffect(() => {
    if (!host.current) return;
    const ed = new Editor({
      element: host.current,
      content: initial,
      extensions: [
        StarterKit.configure({
          heading: { levels: [2, 3] },
          strike: false, underline: false,
          link: { openOnClick: false, autolink: true, defaultProtocol: "https", isAllowedUri: (url) => LINK_OK.test(url) },
        }),
        Placeholder.configure({ placeholder: "Start writing. Paste or drop images straight in." }),
        ImageBlock, VideoBlock, GalleryBlock.configure({ pickImage }),
      ],
      editorProps: {
        attributes: { class: "ed-prose bp", role: "textbox", "aria-multiline": "true", "aria-label": "Post body" },
        handlePaste: (_v, event) => {
          const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
          if (!files.length) return false;
          void insertImages(files);
          return true;
        },
        handleDrop: (view, event) => {
          const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
          if (!files.length) return false;
          const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
          void insertImages(files, at?.pos);
          return true;
        },
      },
      onUpdate: ({ editor }) => { const json = editor.getJSON(); onDocRef.current(json, missingAltIn(json)); },
      onTransaction: () => tick((n) => n + 1),
    });
    edRef.current = ed;
    initialMissing(missingAltIn(ed.getJSON()));
    tick((n) => n + 1);
    return () => { ed.destroy(); edRef.current = null; };
    // The editor owns its document after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ed = edRef.current;
  const on = (name: string, attrs?: Record<string, unknown>) => !!ed?.isActive(name, attrs);

  const openLink = () => {
    if (!ed) return;
    setLinkVal((ed.getAttributes("link").href as string | undefined) ?? "");
    setLinkErr("");
    setLinkOpen(true);
  };
  const applyLink = (e: Event) => {
    e.preventDefault();
    if (!ed) return;
    let v = linkVal.trim();
    if (!v) { ed.chain().focus().extendMarkRange("link").unsetLink().run(); setLinkOpen(false); return; }
    if (!LINK_OK.test(v) && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(v)) v = `https://${v}`;
    if (!LINK_OK.test(v) || v.length > 500) { setLinkErr("Use https://, mailto: or a /path"); return; }
    if (ed.state.selection.empty && !ed.isActive("link")) ed.chain().focus().insertContent({ type: "text", text: v, marks: [{ type: "link", attrs: { href: v } }] }).run();
    else ed.chain().focus().extendMarkRange("link").setLink({ href: v }).run();
    setLinkOpen(false);
  };

  const onGallery = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])].filter((f) => f.type.startsWith("image/"));
    input.value = "";
    if (files.length < 2 || files.length > 8) { adminRef.current.toast("Pick 2 to 8 images for a gallery."); return; }
    const items: ImageAttrs[] = [];
    for (const f of files) { const it = await upload(f); if (it) items.push(imageAttrsFrom(it)); }
    if (items.length >= 2) edRef.current?.chain().focus().insertContent({ type: "gallery", attrs: { images: items } }).run();
    else if (items.length) adminRef.current.toast("A gallery needs at least 2 images.");
  };
  const onVideo = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) { adminRef.current.toast("Videos can be up to 25 MB."); return; }
    const item = await guard(async () => { const fd = new FormData(); fd.append("original", file); return api<MediaItem>("POST", "media", fd); });
    if (item) {
      await adminRef.current.refreshMedia();
      edRef.current?.chain().focus().insertContent({ type: "video", attrs: { mediaId: item.id, key: item.key, original: item.original, w: item.w, h: item.h, alt: "", caption: "" } }).run();
    }
  };

  const c = () => edRef.current!.chain().focus();
  return (
    <div class="ed-wrap">
      <div class="ed-toolbar" role="toolbar" aria-label="Formatting">
        <T label="H2" title="Heading" act="h2" active={on("heading", { level: 2 })} run={() => c().toggleHeading({ level: 2 }).run()} />
        <T label="H3" title="Subheading" act="h3" active={on("heading", { level: 3 })} run={() => c().toggleHeading({ level: 3 }).run()} />
        <span class="tb-sep" aria-hidden="true" />
        <T label="B" title="Bold" act="bold" active={on("bold")} run={() => c().toggleBold().run()} />
        <T label="I" title="Italic" act="italic" active={on("italic")} run={() => c().toggleItalic().run()} />
        <T label="Link" title="Link (Ctrl+K)" act="link" active={on("link")} run={openLink} />
        <T label="Code" title="Inline code" act="code" active={on("code")} run={() => c().toggleCode().run()} />
        <span class="tb-sep" aria-hidden="true" />
        <T label="List" title="Bulleted list" act="ul" active={on("bulletList")} run={() => c().toggleBulletList().run()} />
        <T label="1." title="Numbered list" act="ol" active={on("orderedList")} run={() => c().toggleOrderedList().run()} />
        <T label="Quote" title="Quote" act="quote" active={on("blockquote")} run={() => c().toggleBlockquote().run()} />
        <T label="{ }" title="Code block" act="codeblock" active={on("codeBlock")} run={() => c().toggleCodeBlock().run()} />
        <T label="Divider" title="Divider" act="hr" run={() => c().setHorizontalRule().run()} />
        <span class="tb-sep" aria-hidden="true" />
        <T label="Image" title="Insert image" act="image" run={async () => { const im = await pickImage(); if (im) edRef.current?.chain().focus().insertContent({ type: "image", attrs: im }).run(); }} />
        <T label="Gallery" title="Insert gallery (2 to 8 images)" act="gallery" run={() => galleryInput.current?.click()} />
        <T label="Video" title="Insert video (MP4, up to 25 MB)" act="video" run={() => videoInput.current?.click()} />
        {busy > 0 && <span class="tb-busy small" role="status">Uploading…</span>}
        <input ref={galleryInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,.heic" multiple hidden onChange={onGallery} />
        <input ref={videoInput} type="file" accept="video/mp4" hidden onChange={onVideo} />
      </div>
      {linkOpen && (
        <form class="ed-link" onSubmit={applyLink}>
          <label class="sr-only" for="edl">Link address</label>
          <input id="edl" value={linkVal} placeholder="https://… (empty removes the link)" autoFocus onInput={(e) => setLinkVal((e.target as HTMLInputElement).value)} />
          <button type="submit" class="primary mini">Apply</button>
          <button type="button" class="mini" onClick={() => { setLinkOpen(false); ed?.commands.focus(); }}>Cancel</button>
          {linkErr && <span class="warn small" role="alert">{linkErr}</span>}
        </form>
      )}
      <div ref={host} class="ed-host" onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openLink(); } }} />
    </div>
  );
}

/* ---------- tags ---------- */

function Tags({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().replace(/,+$/, "").trim().slice(0, 30);
    setText("");
    if (t && !value.some((x) => x.toLowerCase() === t.toLowerCase()) && value.length < 8) onChange([...value, t]);
  };
  return (
    <div class="field">
      <label for="etag">Tags (up to 8)</label>
      {value.length > 0 && <ul class="tag-row">{value.map((t) => <li class="tag">{t}<button type="button" class="mini" aria-label={`Remove tag ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>×</button></li>)}</ul>}
      <input id="etag" value={text} placeholder="Type a tag, press Enter" maxLength={30}
        onInput={(e) => { const v = (e.target as HTMLInputElement).value; if (v.endsWith(",")) { setText(v); add(); } else setText(v); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1)); }}
        onBlur={add} />
    </div>
  );
}

/* ---------- the editor screen ---------- */

export function DevlogEditor({ entry, builds, onBack, onChanged }: { entry: Entry; builds: BuildRec[]; onBack: () => void; onChanged: () => void }) {
  const { toast } = useAdmin();
  const a = useAutosave<Entry>(entry, entry.updatedAt, async (v, updatedAt, keepalive) => {
    const { id: _id, updatedAt: _u, ...rest } = v;
    return api("PATCH", `devlog/${entry.id}`, { ...rest, updatedAt }, { keepalive });
  });
  const e = a.value;
  const latest = useRef(e);
  latest.current = e;
  const set = (patch: Partial<Entry>) => { const next = { ...latest.current, ...patch }; latest.current = next; a.setValue(next); };
  const [missing, setMissing] = useState(0);
  const [panel, setPanel] = useState(false);
  const bodyDoc = useRef<JSONContent>(e.blocks ?? bodyToDoc(e.body));
  const state = postState(e);
  const future = !!e.publishAt && Date.parse(e.publishAt) > Date.now();

  const publish = async () => {
    if (e.status === "published") { set({ status: "draft" }); }
    else {
      if (missing > 0) { toast(`Add alt text to ${missing} image${missing === 1 ? "" : "s"} first.`); return; }
      if (!e.title.trim()) { toast("Add a title first."); return; }
      set({ status: "published" });
    }
    await a.flush();
    onChanged();
  };
  const del = async () => { if (!confirm("Delete this post?")) return; try { await api("DELETE", `devlog/${entry.id}`); onChanged(); onBack(); } catch (x) { toast(isApiError(x) ? x.error : "Failed"); } };
  const buildTitle = builds.find((b) => b.id === e.buildId)?.meta.title.value ?? "";
  const onTitle = (title: string) => {
    const auto = e.status !== "published" && (e.slug === slugify(e.title) || e.slug === "" || /^untitled-(note|article)/.test(e.slug));
    set({ title, ...(auto ? { slug: slugify(title) || "untitled" } : {}) });
  };
  const toggleSite = (s: Site) => {
    const has = e.sites.includes(s);
    if (has && e.sites.length === 1) { toast("Show the post on at least one site."); return; }
    set({ sites: has ? e.sites.filter((x) => x !== s) : [...e.sites, s] });
  };
  const publishLabel = state === "published" ? "Unpublish" : state === "scheduled" ? "Unschedule" : future ? "Schedule" : "Publish";
  const statusLine = a.status === "saving" ? "Saving…" : a.status === "offline" ? "Offline, will retry" : a.status === "conflict" || a.status === "error" ? a.error : `${STATE_LABEL[state]}${a.status === "saved" ? ", saved" : ""}`;

  return (
    <div class="blog-ed" onFocusOut={() => void a.flush()}>
      <div class="statusbar blog-bar">
        <button type="button" class="linkish" onClick={onBack}>All posts</button>
        <span class={`status status-${a.status}`} role="status">{statusLine}</span>
        {missing > 0 && <span class="warn small" id="alt-warn">{missing} image{missing === 1 ? " needs" : "s need"} alt text</span>}
        <button type="button" class="panel-toggle" aria-expanded={panel} aria-controls="post-panel" onClick={() => setPanel(!panel)}>Details</button>
        <a href={`/preview/devlog/${e.slug}`} target="_blank" rel="noopener">Preview</a>
        <button type="button" class={state === "draft" ? "primary" : ""} disabled={state === "draft" && missing > 0} aria-describedby={missing > 0 ? "alt-warn" : undefined} onClick={publish}>{publishLabel}</button>
      </div>
      <div class="blog-grid">
        <div class="blog-main">
          <label class="sr-only" for="et">Title</label>
          <textarea id="et" class={`ed-title ${e.type === "note" ? "is-note" : ""}`} rows={1} maxLength={90} value={e.title} placeholder={e.type === "note" ? "Title of the note" : "Article headline"}
            onInput={(x) => { const t = x.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; onTitle(t.value.replace(/\n/g, " ")); }}
            onKeyDown={(x) => { if (x.key === "Enter") { x.preventDefault(); (document.querySelector(".ed-prose") as HTMLElement | null)?.focus(); } }}
            ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; } }} />
          <BodyEditor initial={bodyDoc.current} initialMissing={setMissing}
            onDoc={(doc, m) => { setMissing(m); set({ blocks: doc }); }} />
        </div>
        <aside id="post-panel" class={`blog-panel ${panel ? "open" : ""}`} aria-label="Post details">
          <div class="fields">
            <div class="field"><span class="lbl" id="ety">Type</span>
              <div class="seg" role="group" aria-labelledby="ety">
                {(["note", "article"] as PostType[]).map((t) => <button type="button" class={e.type === t ? "on" : ""} aria-pressed={e.type === t} onClick={() => set({ type: t })}>{t === "note" ? "Note" : "Article"}</button>)}
              </div>
            </div>
            <div class="field"><span class="lbl" id="esite">Show on</span>
              <div role="group" aria-labelledby="esite" class="checks">
                <label class="switch"><input type="checkbox" checked={e.sites.includes("main")} onChange={() => toggleSite("main")} /><span>josefyang.com</span></label>
                <label class="switch"><input type="checkbox" checked={e.sites.includes("games")} onChange={() => toggleSite("games")} /><span>Game hub</span></label>
              </div>
            </div>
            <div class="field"><label for="eat">Schedule (leave empty to publish right away)</label>
              <input id="eat" type="datetime-local" value={toLocalInput(e.publishAt)}
                onInput={(x) => { const v = (x.target as HTMLInputElement).value; set(v ? { publishAt: new Date(v).toISOString(), date: localDate(new Date(v)) } : { publishAt: null }); }} />
              {future && <p class="small muted">{state === "scheduled" ? "Scheduled for " : "Will go live on "}{new Date(e.publishAt!).toLocaleString()}.</p>}
            </div>
            <div class="field"><label for="ex">Excerpt ({e.excerpt.length} / 220)</label><textarea id="ex" rows={3} maxLength={220} value={e.excerpt} onInput={(x) => set({ excerpt: (x.target as HTMLTextAreaElement).value })} /></div>
            <ImageControl id="hero" field={COVER} value={e.hero ?? noImage("fill")} onChange={(v) => set({ hero: v.mediaId ? v : null })} />
            <Tags value={e.tags} onChange={(tags) => set({ tags })} />
            <div class="field"><label for="eb">Linked build</label>
              <select id="eb" value={e.buildId ?? ""} onChange={(x) => set({ buildId: (x.target as HTMLSelectElement).value || null })}>
                <option value="">None</option>{builds.map((b) => <option value={b.id}>{b.meta.title.value}</option>)}
              </select>
            </div>
            <div class="field"><label for="eg">Linked game (slug)</label><input id="eg" value={e.gameSlug ?? ""} maxLength={60} placeholder="e.g. my-game" onInput={(x) => set({ gameSlug: (x.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9-]/g, "-") || null })} /></div>
            <div class="field"><label for="eseo">SEO description ({e.seoDescription.length} / 200)</label><textarea id="eseo" rows={2} maxLength={200} value={e.seoDescription} placeholder="Shown in search results. Falls back to the excerpt." onInput={(x) => set({ seoDescription: (x.target as HTMLTextAreaElement).value })} /></div>
            <div class="field"><label for="es">Web address: /devlog/{e.slug}</label><input id="es" value={e.slug} onInput={(x) => set({ slug: (x.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div>
            <div class="field"><label for="ed">Date</label><input id="ed" type="date" value={e.date} onInput={(x) => set({ date: (x.target as HTMLInputElement).value })} /></div>
            <div class="field"><label for="ef">Rough note on Fuse (link)</label><input id="ef" type="url" value={e.fuseUrl} placeholder="https://fuse.josefyang.com/…" onInput={(x) => set({ fuseUrl: (x.target as HTMLInputElement).value.trim() })} /></div>
            <div class="panel-actions">
              <button type="button" onClick={() => exportPack(e, buildTitle).catch(() => toast("Export failed"))}>Export post pack</button>
              <button type="button" class="danger" onClick={del}>Delete</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
