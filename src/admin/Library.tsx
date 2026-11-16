/** Media library (architecture §12.4 #7): upload with browser resizing, usage, replace everywhere, blocked deletion. */
import { useState } from "preact/hooks";
import { api, isApiError } from "./api";
import { prepareImage } from "./resize";
import { thumb, useAdmin, type MediaItem } from "./state";

export async function uploadFile(file: File, alt = "", minWidth = 0): Promise<{ item: MediaItem; warning?: string }> {
  const p = await prepareImage(file, minWidth);
  const fd = new FormData();
  fd.append("original", file);
  for (const v of p.variants) fd.append(`w${v.w}`, new File([v.blob], `${v.w}.webp`, { type: "image/webp" }));
  fd.append("width", String(p.width));
  fd.append("height", String(p.height));
  fd.append("transparent", p.transparent ? "1" : "0");
  fd.append("alt", alt);
  const item = await api<MediaItem>("POST", "media", fd);
  return { item, warning: p.warning };
}

export function Uploader({ onDone }: { onDone: (m: MediaItem) => void }) {
  const { toast, refreshMedia } = useAdmin();
  const [busy, setBusy] = useState(false);
  const onPick = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    if (!files.length) return;
    setBusy(true);
    try {
      let last: MediaItem | null = null;
      for (const f of files) {
        const r = await uploadFile(f);
        if (r.warning) toast(`${f.name}: ${r.warning}`);
        last = r.item;
      }
      await refreshMedia();
      if (last) onDone(last);
    } catch (x) {
      toast(x instanceof Error ? x.message : isApiError(x) ? x.error : "Upload failed");
    } finally { setBusy(false); input.value = ""; }
  };
  return (
    <label class={`upload ${busy ? "busy" : ""}`}>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,.heic" multiple onChange={onPick} disabled={busy} />
      <span>{busy ? "Resizing and uploading…" : "Upload images (up to 20 MB each)"}</span>
    </label>
  );
}

export function Picker({ onClose }: { onClose: (m: MediaItem | null) => void }) {
  const { media } = useAdmin();
  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label="Choose an image">
      <div class="modal-box">
        <div class="modal-head"><h2>Choose an image</h2><button type="button" onClick={() => onClose(null)}>Close</button></div>
        <Uploader onDone={(m) => onClose(m)} />
        <ul class="media-grid">
          {media.map((m) => (
            <li><button type="button" class="media-tile" onClick={() => onClose(m)}>
              <img src={thumb(m)} alt="" loading="lazy" />
              <span class="small">{m.name || m.id.slice(0, 8)}{m.w ? `, ${m.w}×${m.h}` : ""}</span>
            </button></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Library() {
  const { media, refreshMedia, toast, pickMedia } = useAdmin();
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [sel, setSel] = useState<MediaItem | null>(null);
  const [uses, setUses] = useState<{ owner_type: string; owner_id: string; field_path: string; on: boolean }[]>([]);
  const open = async (m: MediaItem) => {
    setSel(m);
    const u = await api<{ owner_type: string; owner_id: string; field_path: string }[]>("GET", `media/${m.id}/usage`);
    setUses(u.map((x) => ({ ...x, on: true })));
  };
  const replace = async () => {
    if (!sel) return;
    const chosen = uses.filter((u) => u.on);
    if (!chosen.length) return toast("Tick at least one place.");
    const w = await pickMedia();
    if (!w || w.id === sel.id) return;
    try {
      const r = await api<{ replaced: number; note: string }>("POST", `media/${sel.id}/replace`, { withId: w.id, usages: chosen.map(({ on: _on, ...u }) => u) });
      toast(`Replaced in ${r.replaced} place${r.replaced === 1 ? "" : "s"}. ${r.note}`);
      await refreshMedia();
      setSel(null);
    } catch (x) { toast(isApiError(x) ? x.error : "Replace failed"); }
  };
  const del = async (m: MediaItem) => {
    if (!confirm("Delete this image for good?")) return;
    try { await api("DELETE", `media/${m.id}`); await refreshMedia(); setSel(null); } catch (x) { toast(isApiError(x) ? x.error : "Delete failed"); }
  };
  const list = onlyUnused ? media.filter((m) => m.uses === 0) : media;
  return (
    <div class="page-pad">
      <h1>Media</h1>
      <Uploader onDone={() => undefined} />
      <label class="switch"><input type="checkbox" checked={onlyUnused} onChange={() => setOnlyUnused(!onlyUnused)} /><span>Only unused</span></label>
      <ul class="media-grid">
        {list.map((m) => (
          <li><button type="button" class={`media-tile ${sel?.id === m.id ? "on" : ""}`} onClick={() => open(m)}>
            <img src={thumb(m)} alt="" loading="lazy" />
            <span class="small">{m.uses ? `Used ${m.uses}×` : "Unused"}{m.transparent ? ", cut-out" : ""}</span>
          </button></li>
        ))}
      </ul>
      {sel && (
        <div class="notice">
          <h2>{sel.name || "Image"} <span class="muted small">{sel.w}×{sel.h}, {Math.round((sel.bytes ?? 0) / 1024)} KB, sizes {sel.widths.join(", ")}</span></h2>
          {uses.length === 0 ? <p>Not used anywhere.</p> : (
            <>
              <p>Used in:</p>
              <ul>{uses.map((u, i) => (
                <li><label class="switch"><input type="checkbox" checked={u.on} onChange={() => setUses(uses.map((x, k) => (k === i ? { ...x, on: !x.on } : x)))} /><span>{u.owner_type} {u.owner_id}, {u.field_path}</span></label></li>
              ))}</ul>
              <button type="button" class="primary" onClick={replace}>Replace everywhere ticked</button>
            </>
          )}
          <button type="button" class="danger" disabled={sel.uses > 0} title={sel.uses > 0 ? "Still in use: replace it first" : ""} onClick={() => del(sel)}>Delete</button>
        </div>
      )}
    </div>
  );
}
