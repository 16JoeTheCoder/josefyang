/** Bench + devlog (architecture §12.4 #4): the one admin area designed mobile-first. */
import { strToU8, zipSync } from "fflate";
import { useState } from "preact/hooks";
import { noImage, type ImageField, type ImageValue } from "../core/fields";
import { api, isApiError } from "./api";
import { useAutosave } from "./autosave";
import { ImageControl } from "./Fields";
import type { BuildRec } from "./Builds";
import { ago, useAdmin } from "./state";

export interface Entry { id: string; slug: string; title: string; excerpt: string; body: string; buildId: string | null; hero: ImageValue | null; images: ImageValue[]; fuseUrl: string; readMinutes: number | null; date: string; status: "draft" | "published"; updatedAt: number }

const HERO: ImageField = { kind: "image", label: "Main photo (4:5 and 16:10 crops)", ratio: "4 / 5", modes: ["fill"], empty: "Photo" };
const EXTRA: ImageField = { kind: "image", label: "Photo", ratio: "4 / 5", modes: ["fill", "fit"], empty: "Photo" };

export function DevlogList({ entries, builds, onOpen, onChanged }: { entries: Entry[]; builds: BuildRec[]; onOpen: (id: string) => void; onChanged: () => void }) {
  const [title, setTitle] = useState("");
  const bench = builds.find((b) => b.meta.status === "bench");
  const create = async (e: Event) => {
    e.preventDefault();
    const r = await api<{ id: string }>("POST", "devlog", { title: title.trim(), buildId: bench?.id ?? null });
    setTitle("");
    await onChanged();
    onOpen(r.id);
  };
  return (
    <div class="page-pad narrow">
      <h1>Devlog</h1>
      <p class="muted">On the bench: <strong>{bench?.meta.title.value ?? "nothing yet"}</strong>. Set a build's status to "On the bench now" to change it (one at a time).</p>
      <form class="create" onSubmit={create}>
        <label for="ne">Quick post: title</label>
        <input id="ne" value={title} required maxLength={90} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        <button type="submit" class="primary">New entry</button>
      </form>
      <ul class="cards-list">
        {entries.map((e) => (
          <li><button type="button" class="card-btn" onClick={() => onOpen(e.id)}>
            <strong>{e.title}</strong>
            <span class="muted small">{e.date}, {e.status === "published" ? "live" : "draft"}, edited {ago(e.updatedAt)}</span>
          </button></li>
        ))}
      </ul>
    </div>
  );
}

async function exportPack(e: Entry, buildTitle: string) {
  const files: Record<string, Uint8Array> = {};
  const fm = ["---", `title: ${JSON.stringify(e.title)}`, `build: ${JSON.stringify(buildTitle)}`, `date: ${e.date}`, `status: ${e.status}`, `fuse: ${e.fuseUrl || ""}`, "---", "", e.excerpt, "", e.body, ""].join("\n");
  files["post.md"] = strToU8(fm);
  const imgs = [e.hero, ...e.images].filter((x): x is ImageValue => !!x?.mediaId && !!x.key);
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

export function DevlogEditor({ entry, builds, onBack, onChanged }: { entry: Entry; builds: BuildRec[]; onBack: () => void; onChanged: () => void }) {
  const { toast } = useAdmin();
  const a = useAutosave<Entry>(entry, entry.updatedAt, async (v, updatedAt, keepalive) => {
    const { id: _id, updatedAt: _u, ...rest } = v;
    return api("PATCH", `devlog/${entry.id}`, { ...rest, updatedAt }, { keepalive });
  });
  const e = a.value;
  const set = (patch: Partial<Entry>) => a.setValue({ ...e, ...patch });
  const togglePublish = async () => { set({ status: e.status === "published" ? "draft" : "published" }); await a.flush(); onChanged(); };
  const del = async () => { if (!confirm("Delete this entry?")) return; try { await api("DELETE", `devlog/${entry.id}`); onChanged(); onBack(); } catch (x) { toast(isApiError(x) ? x.error : "Failed"); } };
  const buildTitle = builds.find((b) => b.id === e.buildId)?.meta.title.value ?? "";
  return (
    <div class="page-pad narrow" onFocusOut={() => void a.flush()}>
      <button type="button" class="linkish" onClick={onBack}>All entries</button>
      <div class="statusbar">
        <span class={`status status-${a.status}`} role="status">{a.status === "saving" ? "Saving…" : a.status === "offline" ? "Offline, will retry" : a.error || (e.status === "published" ? "Live" : "Draft")}</span>
        <button type="button" class={e.status === "published" ? "" : "primary"} onClick={togglePublish}>{e.status === "published" ? "Unpublish" : "Publish"}</button>
        <a href={`/preview/devlog/${e.slug}`} target="_blank" rel="noopener">Preview</a>
        <button type="button" onClick={() => exportPack(e, buildTitle).catch(() => toast("Export failed"))}>Export post pack</button>
        <button type="button" class="danger" onClick={del}>Delete</button>
      </div>
      <div class="fields">
        <div class="field"><label for="et">Title</label><input id="et" value={e.title} maxLength={90} onInput={(x) => set({ title: (x.target as HTMLInputElement).value })} /></div>
        <div class="field"><label for="es">Web address: /devlog/{e.slug}</label><input id="es" value={e.slug} onInput={(x) => set({ slug: (x.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div>
        <div class="field field-inline"><label for="ed">Date</label><input id="ed" type="date" value={e.date} onInput={(x) => set({ date: (x.target as HTMLInputElement).value })} /></div>
        <div class="field field-inline"><label for="eb">Build</label>
          <select id="eb" value={e.buildId ?? ""} onChange={(x) => set({ buildId: (x.target as HTMLSelectElement).value || null })}>
            <option value="">None</option>{builds.map((b) => <option value={b.id}>{b.meta.title.value}</option>)}
          </select>
        </div>
        <div class="field"><label for="ex">Summary (one or two sentences)</label><textarea id="ex" rows={2} maxLength={220} value={e.excerpt} onInput={(x) => set({ excerpt: (x.target as HTMLTextAreaElement).value })} /></div>
        <div class="field"><label for="ebody">Entry (blank line = new paragraph)</label><textarea id="ebody" rows={12} value={e.body} onInput={(x) => set({ body: (x.target as HTMLTextAreaElement).value })} /></div>
        <div class="field"><label for="ef">Rough note on Fuse (link)</label><input id="ef" type="url" value={e.fuseUrl} placeholder="https://fuse.josefyang.com/…" onInput={(x) => set({ fuseUrl: (x.target as HTMLInputElement).value.trim() })} /></div>
        <div class="field field-inline"><label for="er">Read time (min)</label><input id="er" type="number" min={1} max={60} value={e.readMinutes ?? ""} onInput={(x) => { const n = Number((x.target as HTMLInputElement).value); set({ readMinutes: n >= 1 ? Math.min(60, n) : null }); }} /></div>
        <ImageControl id="hero" field={HERO} value={e.hero ?? noImage("fill")} onChange={(v) => set({ hero: v.mediaId ? v : null })} />
        <fieldset class="group"><legend>More photos ({e.images.length} / 12)</legend>
          {e.images.map((im, i) => (
            <div class="list-item">
              <div class="list-bar"><strong>Photo {i + 1}</strong><span>
                <button type="button" class="mini" disabled={i === 0} onClick={() => { const x = [...e.images]; [x[i - 1], x[i]] = [x[i]!, x[i - 1]!]; set({ images: x }); }}>Move up</button>
                <button type="button" class="mini danger" onClick={() => set({ images: e.images.filter((_, k) => k !== i) })}>Remove</button>
              </span></div>
              <ImageControl id={`img${i}`} field={EXTRA} value={im} onChange={(v) => set({ images: e.images.map((x, k) => (k === i ? v : x)) })} />
            </div>
          ))}
          {e.images.length < 12 && <button type="button" class="ghost" onClick={() => set({ images: [...e.images, noImage("fill")] })}>Add photo</button>}
        </fieldset>
      </div>
    </div>
  );
}
