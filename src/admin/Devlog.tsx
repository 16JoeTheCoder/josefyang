/** Blog (notes and articles): writing-first editor on Tiptap, with a side panel for everything else. */
import { Editor, type JSONContent } from "@tiptap/core";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { strToU8, zipSync } from "fflate";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { parseBlocks, plainText, type ImageAttrs } from "../core/blocks";
import { noImage, type ImageField, type ImageValue } from "../core/fields";
import { FAILURE_CATEGORY_ID, type TaxonomyTerm } from "../core/taxonomy";
import { slugify } from "../lib/dates";
import { api, isApiError } from "./api";
import { useAutosave } from "./autosave";
import { GalleryBlock, ImageBlock, VideoBlock } from "./blog-nodes";
import type { BuildRec } from "./Builds";
import { ImageControl } from "./Fields";
import { uploadFile } from "./Library";
import { ago, useAdmin, type MediaItem } from "./state";
import "../styles/blog-prose.css";
import "./devlog-workspace.css";

export type PostType = "note" | "article";
export type Site = "main" | "games";
export interface Entry {
  id: string; slug: string; title: string; excerpt: string; body: string; buildId: string | null; hero: ImageValue | null; images: ImageValue[];
  readMinutes: number | null; date: string; status: "draft" | "published"; updatedAt: number;
  blocks: JSONContent | null; type: PostType; tags: string[]; tagIds: string[]; sites: Site[]; gameSlug: string | null; publishAt: string | null; seoDescription: string; categories?: string[]; seoTitle?: string; hasDraft?: boolean; livePublishAt?: string | null; publishedAt?: number | null;
}

const COVER: ImageField = { kind: "image", label: "Cover image", ratio: "16 / 10", modes: ["fill"], empty: "Cover" };
const LINK_OK = /^(https?:\/\/|mailto:|\/(?![/\\]))/;

type PostState = "draft" | "scheduled" | "published";
export function postState(e: Pick<Entry, "status" | "publishAt" | "livePublishAt">): PostState {
  if (e.status !== "published") return "draft";
  const scheduledAt = e.livePublishAt === undefined ? e.publishAt : e.livePublishAt;
  return scheduledAt && Date.parse(scheduledAt) > Date.now() ? "scheduled" : "published";
}
const STATE_LABEL: Record<PostState, string> = { draft: "Draft", scheduled: "Scheduled", published: "Published" };
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(+d) ? "" : new Date(+d - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const localDate = (d: Date) => new Date(+d - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const cleanSlug = (slug: string) => slug.replace(/-+/g, "-").replace(/^-|-$/g, "");

/* ---------- taxonomy ---------- */

type TermKind = TaxonomyTerm["kind"];


function useTaxonomy() {
  const [terms, setTerms] = useState<TaxonomyTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api<TaxonomyTerm[] | { terms: TaxonomyTerm[] }>("GET", "taxonomy");
      setTerms(Array.isArray(response) ? response : response.terms ?? []);
      return true;
    } catch (e) {
      setError(isApiError(e) ? e.error : "Could not load categories and tags.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { terms, error, loading, load };
}

function TaxonomyManager({ taxonomy, onChanged }: { taxonomy: ReturnType<typeof useTaxonomy>; onChanged: () => Promise<void> }) {
  const [kind, setKind] = useState<TermKind>("category");
  const [editingId, setEditingId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);
  const noun = kind === "category" ? "category" : "tag";
  const matching = taxonomy.terms.filter((term) => term.kind === kind);
  const reset = () => { setEditingId(""); setName(""); setDescription(""); };
  const submit = async (event: Event) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setFeedback("");
    setError(false);
    try {
      const data = { kind, name: name.trim(), description: description.trim() };
      await api(editingId ? "PATCH" : "POST", editingId ? "taxonomy/" + encodeURIComponent(editingId) : "taxonomy", data);
      setFeedback(editingId ? "Changes saved." : (kind === "category" ? "Category" : "Tag") + " created.");
      reset();
      await taxonomy.load();
      await onChanged();
    } catch (e) { setError(true); setFeedback(isApiError(e) ? e.error : "Could not save the " + noun + "."); }
    finally { setBusy(false); }
  };
  const remove = async (term: TaxonomyTerm) => {
    if (busy || !window.confirm(`Delete ${term.name}? This removes it from any posts that use it.`)) return;
    setBusy(true);
    setFeedback("");
    setError(false);
    try {
      await api("DELETE", "taxonomy/" + encodeURIComponent(term.id));
      if (editingId === term.id) reset();
      setFeedback(`${term.name} deleted.`);
      await taxonomy.load();
      await onChanged();
    } catch (e) { setError(true); setFeedback(isApiError(e) ? e.error : "Could not delete the " + noun + "."); }
    finally { setBusy(false); }
  };
  return (
    <section class="taxonomy-manager" aria-label="Manage categories and tags">
      <div class="blog-subtabs" aria-label="Term type">
        <button type="button" aria-pressed={kind === "category"} onClick={() => { setKind("category"); reset(); setFeedback(""); }}>Categories</button>
        <button type="button" aria-pressed={kind === "tag"} onClick={() => { setKind("tag"); reset(); setFeedback(""); }}>Tags</button>
      </div>
      <div class="taxonomy-layout">
        <form class="taxonomy-form fields" onSubmit={submit}>
          <h2>{editingId ? "Edit " + noun : kind === "category" ? "New category" : "New tag"}</h2>
          <label class="field">Name<input required maxLength={kind === "tag" ? 30 : 60} value={name} onInput={(e) => setName(e.currentTarget.value)} /></label>
          <label class="field">Description <span class="muted small">Optional</span><textarea rows={3} maxLength={240} value={description} onInput={(e) => setDescription(e.currentTarget.value)} /></label>
          <div class="blog-action-row">
            <button class="primary" type="submit" disabled={!name.trim() || busy}>{busy ? "Working…" : editingId ? "Save changes" : "Create " + noun}</button>
            {editingId && <button type="button" onClick={reset} disabled={busy}>Cancel</button>}
          </div>
          {feedback && <p class={error ? "warn" : "muted"} role={error ? "alert" : "status"}>{feedback}</p>}
        </form>
        <div class="taxonomy-list">
          {taxonomy.error && <p class="warn" role="alert">{taxonomy.error} <button type="button" onClick={taxonomy.load}>Try again</button></p>}
          {taxonomy.loading && <p class="muted" role="status">Loading {kind === "category" ? "categories" : "tags"}…</p>}
          {!taxonomy.loading && !taxonomy.error && !matching.length && <p class="muted">{kind === "category" ? "No categories yet." : "No tags yet."}</p>}
          <ul>
            {matching.map((term) => (
              <li key={term.id}>
                <div><strong>{term.name}</strong><span class="muted small">{term.slug}</span>{term.description && <p>{term.description}</p>}</div>
                {term.id === FAILURE_CATEGORY_ID ? <div class="blog-action-row"><span class="muted small">Built in</span><button type="button" class="mini" disabled={busy} onClick={() => { setEditingId(term.id); setName(term.name); setDescription(term.description); setFeedback(""); }}>Edit</button></div> : (
                  <div class="blog-action-row">
                    <button type="button" class="mini" disabled={busy} onClick={() => { setEditingId(term.id); setName(term.name); setDescription(term.description); setFeedback(""); }}>Edit</button>
                    <button type="button" class="mini danger" disabled={busy} onClick={() => void remove(term)} aria-label={"Delete " + term.name}>Delete</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ---------- catalog ---------- */

interface PostFilters { q: string; type: "" | PostType; state: "" | PostState; build: string; category: string }
const NO_FILTERS: PostFilters = { q: "", type: "", state: "", build: "", category: "" };
const FILTER_KEY = "josefyang-admin-post-filters";
function readPostFilters(): PostFilters {
  try { return { ...NO_FILTERS, ...JSON.parse(sessionStorage.getItem(FILTER_KEY) ?? "{}") }; }
  catch { return NO_FILTERS; }
}

export function DevlogList({ entries, builds, onOpen, onChanged }: { entries: Entry[]; builds: BuildRec[]; onOpen: (id: string) => void; onChanged: () => Promise<void> }) {
  const [filters, setFilters] = useState(readPostFilters);
  const [view, setView] = useState<"posts" | "taxonomy">("posts");
  const [newType, setNewType] = useState<PostType>("article");
  const [creating, setCreating] = useState(false);
  const taxonomy = useTaxonomy();
  const { toast } = useAdmin();
  const titles = new Map(builds.map((build) => [build.id, build.meta.title.value]));
  const categories = taxonomy.terms.filter((term) => term.kind === "category");
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const setFilter = (change: Partial<PostFilters>) => setFilters((old) => ({ ...old, ...change }));

  useEffect(() => {
    try { sessionStorage.setItem(FILTER_KEY, JSON.stringify(filters)); }
    catch { /* The catalog still works if browser storage is unavailable. */ }
  }, [filters]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const r = await api<{ id: string }>("POST", "devlog", { title: newType === "note" ? "Untitled note" : "Untitled article", type: newType });
      await onChanged();
      onOpen(r.id);
    } catch (e) { toast(isApiError(e) ? e.error : "Could not create the post."); }
    finally { setCreating(false); }
  };
  const needle = filters.q.trim().toLowerCase();
  const list = entries.filter((e) =>
    (!filters.type || e.type === filters.type) && (!filters.state || postState(e) === filters.state) &&
    (!filters.build || (filters.build === "unlinked" ? !e.buildId : filters.build === e.buildId)) &&
    (!filters.category || (e.categories ?? []).includes(filters.category)) &&
    (!needle || [e.title, e.excerpt, ...(e.tags ?? []), titles.get(e.buildId ?? "") ?? "", ...(e.categories ?? []).map((id) => categoryNames.get(id) ?? "")]
      .some((text) => text.toLowerCase().includes(needle))));
  const statuses = Object.keys(STATE_LABEL) as PostState[];
  const counts = new Map(statuses.map((status) => [status, entries.filter((e) => postState(e) === status).length]));
  return (
    <div class="blog-workspace blog-catalog">
      <header class="blog-catalog-heading">
        <div><h1>Posts</h1><p class="muted">Write, organize and publish your devlog.</p></div>
        <div class="blog-create">
          <label class="sr-only" for="new-post-type">New post format</label>
          <select id="new-post-type" value={newType} onChange={(e) => setNewType(e.currentTarget.value === "note" ? "note" : "article")}><option value="article">Article</option><option value="note">Note</option></select>
          <button type="button" class="primary" disabled={creating} onClick={() => void create()}>{creating ? "Creating…" : "New post"}</button>
        </div>
      </header>
      <div class="blog-subtabs" aria-label="Blog workspace">
        <button type="button" aria-pressed={view === "posts"} onClick={() => setView("posts")}>All posts</button>
        <button type="button" aria-pressed={view === "taxonomy"} onClick={() => setView("taxonomy")}>Categories &amp; tags</button>
      </div>
      {view === "taxonomy" ? <TaxonomyManager taxonomy={taxonomy} onChanged={onChanged} /> : (
        <>
          <nav class="blog-status-filters" aria-label="Filter by status">
            <button type="button" aria-pressed={!filters.state} onClick={() => setFilter({ state: "" })}>All <span>{entries.length}</span></button>
            {statuses.map((status) => <button type="button" key={status} aria-pressed={filters.state === status} onClick={() => setFilter({ state: status })}>{STATE_LABEL[status]} <span>{counts.get(status)}</span></button>)}
          </nav>
          <div class="blog-catalog-filters">
            <label class="field">Search <input type="search" placeholder="Title, excerpt, tag or build" value={filters.q} onInput={(e) => setFilter({ q: e.currentTarget.value })} /></label>
            <label class="field">Format <select value={filters.type} onChange={(e) => setFilter({ type: e.currentTarget.value as PostFilters["type"] })}><option value="">All formats</option><option value="note">Notes</option><option value="article">Articles</option></select></label>
            <label class="field">Project <select value={filters.build} onChange={(e) => setFilter({ build: e.currentTarget.value })}><option value="">All projects</option><option value="unlinked">No project</option>{builds.map((b) => <option key={b.id} value={b.id}>{b.meta.title.value}</option>)}</select></label>
            <label class="field">Category <select value={filters.category} onChange={(e) => setFilter({ category: e.currentTarget.value })}><option value="">All categories</option>{categories.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}</select></label>
            {Object.values(filters).some(Boolean) && <button class="blog-clear" type="button" onClick={() => setFilters(NO_FILTERS)}>Clear</button>}
          </div>
          {taxonomy.error && <p class="warn small" role="status">Category filter unavailable. <button type="button" class="mini" onClick={taxonomy.load}>Retry</button></p>}
          <p class="blog-result muted small" role="status">{list.length} {list.length === 1 ? "post" : "posts"}</p>
          {list.length ? <div class="blog-catalog-scroll">
            <table class="blog-post-table">
              <thead><tr><th scope="col">Post</th><th scope="col">Status</th><th scope="col">Project / category</th><th scope="col">Date</th></tr></thead>
              <tbody>{list.map((e) => {
                const state = postState(e);
                const assigned = (e.categories ?? []).map((id) => categoryNames.get(id)).filter(Boolean);
                const project = titles.get(e.buildId ?? "");
                const schedule = state === "scheduled" ? e.livePublishAt ?? e.publishAt : null;
                return (
                  <tr key={e.id}>
                    <td><button type="button" class="blog-post-title" onClick={() => onOpen(e.id)}>{e.title.trim() || "Untitled post"}</button><div class="muted small">{e.type === "article" ? "Article" : "Note"}{e.sites.includes("games") ? " · Game hub" : ""}</div></td>
                    <td><span class={"state state-" + state}>{STATE_LABEL[state]}</span>{e.hasDraft && <div class="small muted">Unpublished changes</div>}</td>
                    <td>{project ?? <span class="muted">—</span>}{assigned.length > 0 && <div class="muted small">{assigned.join(", ")}</div>}</td>
                    <td><time dateTime={schedule ?? e.date}>{schedule ? new Date(schedule).toLocaleString() : e.date}</time><div class="muted small">Edited {ago(e.updatedAt)}</div></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div> : <p class="blog-empty">{entries.length ? "No posts match the current filters." : "Your first draft will appear here."}</p>}
        </>
      )}
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
  const fm = ["---", `title: ${JSON.stringify(e.title)}`, `type: ${e.type}`, `build: ${JSON.stringify(buildTitle)}`, `date: ${e.date}`, `status: ${e.status}`, `tags: ${JSON.stringify(e.tags)}`, `categories: ${JSON.stringify(e.categories ?? [])}`, "---", "", e.excerpt, "", text, ""].join("\n");
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
  const words = ed?.getText().match(/\S+/g)?.length ?? 0;
  const headingLevel = on("heading", { level: 2 }) ? "2" : on("heading", { level: 3 }) ? "3" : "0";
  return (
    <div class="ed-wrap">
      <div class="ed-toolbar" role="toolbar" aria-label="Formatting">
        <T label="Undo" title="Undo (Ctrl+Z)" act="undo" run={() => { if (edRef.current) c().undo().run(); }} />
        <T label="Redo" title="Redo (Ctrl+Shift+Z)" act="redo" run={() => { if (edRef.current) c().redo().run(); }} />
        <span class="tb-sep" aria-hidden="true" />
        <label class="sr-only" for="blog-text-style">Text style</label>
        <select id="blog-text-style" class="blog-text-style" value={headingLevel} onChange={(event) => {
          const level = event.currentTarget.value;
          if (!edRef.current) return;
          if (level === "2" || level === "3") c().setHeading({ level: level === "2" ? 2 : 3 }).run();
          else c().setParagraph().run();
        }}><option value="0">Normal text</option><option value="2">Heading</option><option value="3">Subheading</option></select>
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
      <p class="blog-document-count muted small">{words} {words === 1 ? "word" : "words"}</p>
    </div>
  );
}

/* ---------- post settings ---------- */

function AssignedTerms({ terms, value, onChange, kind }: { terms: TaxonomyTerm[]; value: string[]; onChange: (selected: string[]) => void; kind: TermKind }) {
  const isCategory = kind === "category";
  const limit = isCategory ? 12 : 8;
  const available = terms.filter((term) => term.kind === kind);
  const labels = new Map(available.map((term) => [term.id, term.name]));
  const heading = isCategory ? "Categories" : "Tags";
  const add = (event: Event) => {
    const input = event.currentTarget as HTMLSelectElement;
    const selected = input.value;
    if (selected && !value.includes(selected) && value.length < limit) onChange([...value, selected]);
    input.value = "";
  };
  return (
    <div class="field">
      <label for={"post-term-" + kind}>{heading}</label>
      {value.length > 0 && <ul class="post-terms">{value.map((selected) => (
        <li key={selected}>{labels.get(selected) ?? selected}<button type="button" class="mini" aria-label={"Remove " + (labels.get(selected) ?? selected)} onClick={() => onChange(value.filter((x) => x !== selected))}>Remove</button></li>
      ))}</ul>}
      <select id={"post-term-" + kind} disabled={value.length >= limit || !available.some((term) => !value.includes(term.id))} onChange={add}>
        <option value="">{value.length >= limit ? "Limit reached" : isCategory ? "Add a category" : "Add a tag"}</option>
        {available.filter((term) => !value.includes(term.id)).map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
      </select>
      {available.length === 0 && <p class="muted small">Manage {heading.toLowerCase()} in the posts catalog.</p>}
    </div>
  );
}

type PublishIntent = "save" | "publish" | "unpublish";
type PostPanel = "content" | "seo" | "publishing";
const POST_PANELS: { id: PostPanel; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "seo", label: "SEO" },
  { id: "publishing", label: "Publishing" },
];

export function DevlogEditor({ entry, builds, onBack, onChanged }: { entry: Entry; builds: BuildRec[]; onBack: () => void; onChanged: () => Promise<void> }) {
  const { toast } = useAdmin();
  const taxonomy = useTaxonomy();
  const pendingIntent = useRef<PublishIntent>("save");
  const [publication, setPublication] = useState(() => ({
    status: entry.status,
    hasDraft: entry.hasDraft ?? false,
    livePublishAt: entry.livePublishAt === undefined ? entry.publishAt : entry.livePublishAt,
  }));
  const a = useAutosave<Entry>(entry, entry.updatedAt, async (v, updatedAt, keepalive) => {
    const intent = pendingIntent.current;
    pendingIntent.current = "save";
    const response = await api<{ updatedAt: number; hasDraft?: boolean; status?: Entry["status"]; livePublishAt?: string | null }>(
      "PATCH", "devlog/" + entry.id, {
        slug: cleanSlug(v.slug), title: v.title, excerpt: v.excerpt, body: v.body, buildId: v.buildId, hero: v.hero, images: v.images,
        readMinutes: v.readMinutes, date: v.date, status: publication.status, updatedAt, blocks: v.blocks, type: v.type,
        tagIds: v.tagIds, categories: v.categories ?? [], seoTitle: v.seoTitle ?? "", seoDescription: v.seoDescription,
        sites: v.sites, gameSlug: v.gameSlug, publishAt: v.publishAt, intent,
      }, { keepalive }
    );
    setPublication((previous) => ({
      status: response.status ?? (intent === "publish" ? "published" : intent === "unpublish" ? "draft" : previous.status),
      hasDraft: response.hasDraft ?? (intent === "save" && previous.status === "published"),
      livePublishAt: response.livePublishAt === undefined
        ? intent === "publish" ? v.publishAt : intent === "unpublish" ? null : previous.livePublishAt
        : response.livePublishAt,
    }));
    return response;
  });
  const e = a.value;
  const previewUrl = "/preview/devlog/" + entry.id;
  const latest = useRef(e);
  latest.current = e;
  const set = (patch: Partial<Entry>) => { const next = { ...latest.current, ...patch }; latest.current = next; a.setValue(next); };
  const [missing, setMissing] = useState(0);
  const [panel, setPanel] = useState<PostPanel>("content");
  const [panelOpen, setPanelOpen] = useState(() => matchMedia("(min-width: 901px)").matches);
  const [operation, setOperation] = useState<"publishing" | "unpublishing" | "deleting" | null>(null);
  const bodyDoc = useRef<JSONContent>(e.blocks ?? bodyToDoc(e.body));
  const writing = useRef<HTMLDivElement>(null);
  const state = postState({ ...e, ...publication });
  const future = !!e.publishAt && Date.parse(e.publishAt) > Date.now();
  const missingAlt = missing + Number(!!e.hero?.mediaId && !e.hero.alt.trim()) + e.images.filter((image) => image.mediaId && !image.alt.trim()).length;
  const publishLabel = state !== "draft" ? state === "scheduled" ? "Update schedule" : future ? "Reschedule" : "Publish changes" : future ? "Schedule" : "Publish";
  const statusLine = a.status === "saving" ? "Saving draft…" : a.status === "offline" ? "Offline, draft pending" : a.status === "conflict" || a.status === "error"
    ? a.error || "Could not save draft"
    : publication.hasDraft || (publication.status === "published" && a.isDirty()) ? "Unpublished changes"
    : state === "draft" && a.status === "saved" ? "Draft saved" : STATE_LABEL[state];

  const onTitle = (title: string) => {
    const auto = publication.status !== "published" && (e.slug === slugify(e.title) || e.slug === "" || e.slug === entry.id || /^untitled-(note|article)/.test(e.slug));
    set({ title, ...(auto ? { slug: cleanSlug(slugify(title)) } : {}) });
  };
  const toggleSite = (s: Site) => {
    const has = e.sites.includes(s);
    if (has && e.sites.length === 1) { toast("Show the post on at least one site."); return; }
    set({ sites: has ? e.sites.filter((x) => x !== s) : [...e.sites, s] });
  };
  const changePublication = async (intent: "publish" | "unpublish") => {
    if (operation) return;
    if (intent === "publish") {
      if (missingAlt) { toast("Add alt text to every image and video first."); return; }
      if (!e.title.trim() || !cleanSlug(e.slug)) { toast("Add a title and web address first."); return; }
    }
    setOperation(intent === "publish" ? "publishing" : "unpublishing");
    try {
      await a.flush();
      pendingIntent.current = intent;
      a.setValue({ ...latest.current });
      await a.flush();
      await onChanged();
    } catch (error) {
      pendingIntent.current = "save";
      toast(isApiError(error) ? error.error : error instanceof Error ? error.message : "The publication change did not save.");
    } finally { setOperation(null); }
  };
  const goBack = async () => {
    try { await a.flush(); await onChanged(); onBack(); }
    catch (error) { toast(isApiError(error) ? error.error : "The draft could not be saved."); }
  };
  const preview = async (event: MouseEvent) => {
    if (!a.isDirty()) return;
    event.preventDefault();
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try { await a.flush(); if (tab) tab.location.href = previewUrl; else toast("Allow pop-ups to open the preview."); }
    catch (error) { tab?.close(); toast(isApiError(error) ? error.error : "Save the draft to open the preview."); }
  };
  const del = async () => {
    if (operation || !confirm("Delete this post?")) return;
    setOperation("deleting");
    try { await a.flush(); await api("DELETE", "devlog/" + entry.id); await onChanged(); onBack(); }
    catch (error) { toast(isApiError(error) ? error.error : "Could not delete the post."); }
    finally { setOperation(null); }
  };
  const buildTitle = builds.find((b) => b.id === e.buildId)?.meta.title.value ?? "";
  const openPanel = (id: PostPanel) => { setPanel(id); setPanelOpen(true); };
  const resizeTitle = (target: HTMLTextAreaElement) => { target.style.height = "auto"; target.style.height = target.scrollHeight + "px"; };

  return (
    <div class="blog-ed blog-workspace">
      <header class="statusbar blog-bar blog-workspace-bar">
        <button type="button" class="linkish blog-back" onClick={() => void goBack()}>All posts</button>
        <div class="blog-save-state"><span class={"status status-" + a.status} role="status">{statusLine}</span>
          {missingAlt > 0 && <span class="warn small" id="alt-warn">{missingAlt} media {missingAlt === 1 ? "item needs" : "items need"} alt text</span>}
        </div>
        <div class="blog-action-row">
          <button type="button" disabled={!!operation} onClick={() => void a.flush().catch((error) => toast(isApiError(error) ? error.error : "The draft could not be saved."))}>Save</button>
          <a class="blog-preview" href={previewUrl} target="_blank" rel="noopener" onClick={(event) => void preview(event)}>Preview</a>
          <button type="button" class="blog-panel-toggle" aria-expanded={panelOpen} aria-controls="post-panel" onClick={() => setPanelOpen(!panelOpen)}>Settings</button>
          <button type="button" class="primary" disabled={!!operation || missingAlt > 0 || !e.title.trim() || !cleanSlug(e.slug)} aria-describedby={missingAlt > 0 ? "alt-warn" : undefined} onClick={() => void changePublication("publish")}>
            {operation === "publishing" ? "Updating…" : publishLabel}
          </button>
        </div>
      </header>
      <div class={"blog-grid blog-writing-grid" + (panelOpen ? "" : " writing-wide")}>
        <div class="blog-main blog-writing" ref={writing}>
          <div class="blog-document">
            <label class="sr-only" for="et">Post title</label>
            <textarea id="et" class={"ed-title" + (e.type === "note" ? " is-note" : "")} rows={1} maxLength={90} value={e.title} placeholder={e.type === "note" ? "Title of the note" : "Article headline"}
              onInput={(event) => { resizeTitle(event.currentTarget); onTitle(event.currentTarget.value.replace(/\n/g, " ")); }}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); writing.current?.querySelector<HTMLElement>(".ed-prose")?.focus(); } }}
              ref={(element) => { if (element) resizeTitle(element); }} />
            <BodyEditor initial={bodyDoc.current} initialMissing={setMissing}
              onDoc={(doc, missingMedia) => { setMissing(missingMedia); set({ blocks: doc }); }} />
          </div>
        </div>
        {panelOpen && <aside id="post-panel" class="blog-panel blog-post-inspector open" aria-label="Post settings">
          <div class="blog-panel-head"><h2>Post settings</h2><button type="button" class="mini" onClick={() => setPanelOpen(false)}>Close</button></div>
          <div class="blog-panel-tabs" aria-label="Settings views">
            {POST_PANELS.map((tab) => <button type="button" key={tab.id} aria-pressed={panel === tab.id} onClick={() => openPanel(tab.id)}>{tab.label}</button>)}
          </div>
          {panel === "content" && <section class="fields post-panel-fields" aria-label="Content settings">
            <label class="field">Format<select value={e.type} onChange={(event) => set({ type: event.currentTarget.value === "note" ? "note" : "article" })}><option value="article">Article</option><option value="note">Note</option></select></label>
            <label class="field">Linked project<select value={e.buildId ?? ""} onChange={(event) => set({ buildId: event.currentTarget.value || null })}><option value="">None</option>{builds.map((b) => <option key={b.id} value={b.id}>{b.meta.title.value}</option>)}</select></label>
            <label class="field">Excerpt <span class="muted small">{e.excerpt.length} / 220</span><textarea rows={3} maxLength={220} value={e.excerpt} onInput={(event) => set({ excerpt: event.currentTarget.value })} /></label>
            <ImageControl id="hero" field={COVER} value={e.hero ?? noImage("fill")} onChange={(v) => set({ hero: v.mediaId ? v : null })} />
            {taxonomy.error && <p class="warn small" role="alert">{taxonomy.error} <button type="button" class="mini" onClick={taxonomy.load}>Retry</button></p>}
            <AssignedTerms kind="category" terms={taxonomy.terms} value={e.categories ?? []} onChange={(categories) => set({ categories })} />
            {(e.categories ?? []).includes(FAILURE_CATEGORY_ID) && <p class="muted small">This post appears in Failures when published to the portfolio.</p>}
            <AssignedTerms kind="tag" terms={taxonomy.terms} value={e.tagIds} onChange={(tagIds) => {
              const tags = taxonomy.terms.filter((term) => tagIds.includes(term.id)).map((term) => term.name);
              set({ tagIds, tags });
            }} />
          </section>}
          {panel === "seo" && <section class="fields post-panel-fields" aria-label="SEO settings">
            <div class="post-search-preview"><span class="muted small">Search preview</span><strong>{e.seoTitle || e.title || "Post title"}</strong><span class="post-preview-url">josefyang.com/devlog/{e.slug || "post-address"}</span>{(e.seoDescription || e.excerpt) && <p>{e.seoDescription || e.excerpt}</p>}</div>
            <label class="field">SEO title <span class="muted small">{(e.seoTitle ?? "").length} / 90</span><input value={e.seoTitle ?? ""} maxLength={90} placeholder={e.title} onInput={(event) => set({ seoTitle: event.currentTarget.value })} /></label>
            <label class="field">SEO description <span class="muted small">{e.seoDescription.length} / 200</span><textarea rows={4} maxLength={200} value={e.seoDescription} placeholder={e.excerpt || "Short description for search and sharing."} onInput={(event) => set({ seoDescription: event.currentTarget.value })} /></label>
            <label class="field">Web address <span class="muted small">/devlog/</span><input value={e.slug} maxLength={60} onInput={(event) => set({ slug: event.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></label>
            {publication.status === "published" && <p class="muted small">Changing this address updates the public URL when you publish changes.</p>}
          </section>}
          {panel === "publishing" && <section class="fields post-panel-fields" aria-label="Publishing settings">
            <fieldset class="group"><legend>Show on</legend>
              <div class="checks">
                <label class="switch"><input type="checkbox" checked={e.sites.includes("main")} onChange={() => toggleSite("main")} /><span>Portfolio</span></label>
                <label class="switch"><input type="checkbox" checked={e.sites.includes("games")} onChange={() => toggleSite("games")} /><span>Game hub</span></label>
              </div>
            </fieldset>
            {e.sites.includes("games") && <label class="field">Linked game slug<input value={e.gameSlug ?? ""} maxLength={60} placeholder="my-game" onInput={(event) => set({ gameSlug: event.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") || null })} /></label>}
            <label class="field">Entry date<input type="date" value={e.date} onInput={(event) => { if (event.currentTarget.value) set({ date: event.currentTarget.value }); }} /></label>
            <label class="field">Schedule <span class="muted small">Leave empty to publish immediately</span>
              <input type="datetime-local" value={toLocalInput(e.publishAt)} onInput={(event) => {
                const value = event.currentTarget.value;
                if (!value) set({ publishAt: null });
                else { const date = new Date(value); if (Number.isFinite(+date)) set({ publishAt: date.toISOString(), date: localDate(date) }); }
              }} />
            </label>
            {publication.livePublishAt && state === "scheduled" && <p class="muted small">Live schedule: {new Date(publication.livePublishAt).toLocaleString()}</p>}
            <div class="panel-actions blog-action-row">
              {state !== "draft" && <button type="button" disabled={!!operation} onClick={() => void changePublication("unpublish")}>{operation === "unpublishing" ? "Updating…" : "Return to draft"}</button>}
              <button type="button" disabled={!!operation} onClick={() => exportPack(e, buildTitle).catch(() => toast("Export failed."))}>Export post pack</button>
              <button type="button" class="danger" disabled={!!operation} onClick={() => void del()}>Delete post</button>
            </div>
          </section>}
        </aside>}
      </div>
    </div>
  );
}
