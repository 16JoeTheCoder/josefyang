/** Media library (architecture §12.4 #7): upload with browser resizing, usage, replace everywhere, blocked deletion. */
import { useState } from "preact/hooks";
import { api, isApiError } from "./api";
import { prepareImage } from "./resize";
import { isVideoItem, thumb, useAdmin, videoSrc, type MediaItem } from "./state";

export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const isVideoFile = (f: File) => f.type === "video/mp4" || /\.mp4$/i.test(f.name);

/** Read a clip's pixel size in the browser (no upload yet). Resolves {0,0} if the browser can't decode it. */
export function videoSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((ok) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const done = (w: number, h: number) => { URL.revokeObjectURL(url); ok({ w, h }); };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => done(v.videoWidth, v.videoHeight);
    v.onerror = () => done(0, 0);
    setTimeout(() => done(0, 0), 8000);
    v.src = url;
  });
}

async function uploadVideo(file: File, alt: string): Promise<{ item: MediaItem; warning?: string }> {
  if (file.size > MAX_VIDEO_BYTES) throw new Error("Videos can be up to 25 MB. Trim or compress it first.");
  const { w, h } = await videoSize(file);
  const fd = new FormData();
  fd.append("original", file);
  if (w) { fd.append("width", String(w)); fd.append("height", String(h)); }
  fd.append("alt", alt);
  return { item: await api<MediaItem>("POST", "media", fd) };
}

export async function uploadFile(file: File, alt = "", minWidth = 0): Promise<{ item: MediaItem; warning?: string }> {
  if (isVideoFile(file)) return uploadVideo(file, alt);
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

export function Uploader({ onDone, kind = "all" }: { onDone: (m: MediaItem) => void; kind?: "all" | "image" | "video" }) {
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
      <input type="file" accept={kind === "video" ? "video/mp4,.mp4" : kind === "image" ? "image/jpeg,image/png,image/webp,image/avif,image/heic,.heic" : "image/jpeg,image/png,image/webp,image/avif,image/heic,.heic,video/mp4,.mp4"} multiple={kind !== "video"} onChange={onPick} disabled={busy} />
      <span>{busy ? "Resizing and uploading…" : kind === "video" ? "Upload an MP4 (up to 25 MB)" : kind === "image" ? "Upload images (up to 20 MB each)" : "Upload images (up to 20 MB) or MP4 videos (up to 25 MB)"}</span>
    </label>
  );
}

const OWNER: Record<string, string> = { page: "Page", build: "Build", devlog: "Devlog entry", settings: "Settings" };
const PAGE: Record<string, string> = { home: "Home", projects: "Projects", failures: "Failures", devlog: "Devlog", entry: "Devlog entry layout", about: "About" };
function usageLabel(u: { owner_type: string; owner_id: string; field_path: string }) {
  const field = u.field_path.replace(/sections\[\d+\]\.content\./, "").replace(/^meta\./, "").replace(/([A-Z])/g, " $1").replace(/\[(\d+)\]/g, (_m, n) => ` ${Number(n) + 1}`).toLowerCase();
  const owner = u.owner_type === "page" ? `${PAGE[u.owner_id] ?? u.owner_id} page` : `${OWNER[u.owner_type] ?? u.owner_type}${u.owner_type === "settings" ? `: ${u.owner_id}` : ""}`;
  return `${owner}, ${field}`;
}

function Tile({ m }: { m: MediaItem }) {
  return isVideoItem(m)
    ? <video src={`${videoSrc(m)}#t=0.1`} preload="metadata" muted playsInline aria-hidden="true" tabIndex={-1} />
    : <img src={thumb(m)} alt="" loading="lazy" />;
}

export function Picker({ onClose, kind = "image" }: { onClose: (m: MediaItem | null) => void; kind?: "image" | "video" }) {
  const { media } = useAdmin();
  const label = kind === "video" ? "Choose a video" : "Choose an image";
  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label={label}>
      <div class="modal-box">
        <div class="modal-head"><h2>{label}</h2><button type="button" onClick={() => onClose(null)}>Close</button></div>
        <Uploader kind={kind} onDone={(m) => onClose(m)} />
        <ul class="media-grid">
          {media.filter((m) => isVideoItem(m) === (kind === "video")).map((m) => (
            <li><button type="button" class="media-tile" onClick={() => onClose(m)}>
              <Tile m={m} />
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
    if (!confirm(`Delete this ${isVideoItem(m) ? "video" : "image"} for good?`)) return;
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
            <Tile m={m} />
            <span class="small">{isVideoItem(m) ? "Video, " : ""}{m.uses ? `Used ${m.uses}×` : "Unused"}{m.transparent ? ", cut-out" : ""}</span>
          </button></li>
        ))}
      </ul>
      {sel && (
        <div class="notice">
          <h2>{sel.name || (isVideoItem(sel) ? "Video" : "Image")} <span class="muted small">{sel.w}×{sel.h}, {Math.round((sel.bytes ?? 0) / 1024)} KB{sel.widths.length ? `, sizes ${sel.widths.join(", ")}` : ""}</span></h2>
          {isVideoItem(sel) && <video class="lib-video" src={videoSrc(sel)} controls preload="metadata" playsInline />}
          {uses.length === 0 ? <p>Not used anywhere.</p> : (
            <>
              <p>Used in:</p>
              <ul>{uses.map((u, i) => (
                <li><label class="switch"><input type="checkbox" checked={u.on} onChange={() => setUses(uses.map((x, k) => (k === i ? { ...x, on: !x.on } : x)))} /><span>{usageLabel(u)}</span></label></li>
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
