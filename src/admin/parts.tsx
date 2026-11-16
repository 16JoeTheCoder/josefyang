/** Shared admin pieces: preview iframe, Text/Images panels, version history, status bar. */
import { useEffect, useRef, useState } from "preact/hooks";
import { walk, type Fields, type ImageField, type TextField } from "../core/fields";
import { api } from "./api";
import { statusText, type Problem, type SaveStatus } from "./autosave";
import { FieldControl } from "./Fields";
import { ago } from "./state";

/* ---------- path helpers ---------- */

export function setAtPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  const clone = structuredClone(obj) as Record<string, unknown>;
  let cur: Record<string, unknown> = clone;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]!] as Record<string, unknown>;
  cur[keys.at(-1)!] = value;
  return clone as T;
}

/* ---------- preview ---------- */

export function Preview({ route, reloadKey }: { route: string; reloadKey: number }) {
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const ref = useRef<HTMLIFrameElement>(null);
  const scroll = useRef(0);
  useEffect(() => {
    const f = ref.current;
    if (!f) return;
    try { scroll.current = f.contentWindow?.scrollY ?? 0; } catch { /* ignore */ }
    const src = `/preview${route}${route.includes("?") ? "&" : "?"}r=${reloadKey}`;
    if (reloadKey === 0) f.src = src;
    else f.contentWindow?.location.replace(src);
  }, [route, reloadKey]);
  const onLoad = () => { try { ref.current?.contentWindow?.scrollTo(0, scroll.current); } catch { /* ignore */ } };
  // Desktop preview renders at 1440px and is scaled down to fit, so it shows the real desktop layout.
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, (el.clientWidth - 24) / 1440)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div class="preview">
      <div class="preview-bar">
        <div class="seg" role="group" aria-label="Preview width">
          <button type="button" aria-pressed={width === "desktop"} onClick={() => setWidth("desktop")}>Desktop</button>
          <button type="button" aria-pressed={width === "mobile"} onClick={() => setWidth("mobile")}>Mobile</button>
        </div>
        <a href={`/preview${route}`} target="_blank" rel="noopener">Open preview in a new tab</a>
      </div>
      <div class={`preview-frame ${width}`} ref={box} style={width === "desktop" ? `--s:${scale}` : undefined}><iframe ref={ref} title="Live preview (draft)" onLoad={onLoad} /></div>
    </div>
  );
}

/* ---------- status + publish bar ---------- */

export function StatusBar({ status, savedAt, error, problems, onPublish, publishing, dirty, extra }: {
  status: SaveStatus; savedAt: number; error: string; problems: Problem[]; onPublish: () => void; publishing: boolean; dirty: boolean; extra?: preact.ComponentChildren;
}) {
  const quiet = status === "idle" || (status === "saved" && !dirty);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 5000); return () => clearInterval(id); }, []);
  return (
    <div class="statusbar">
      <span class={`status status-${status}`} role="status">{quiet ? (dirty ? "Draft has unpublished changes" : "Published, no changes") : statusText(status, savedAt, error)}</span>
      {status === "conflict" && <button type="button" onClick={() => location.reload()}>Reload</button>}
      {extra}
      <button type="button" class="primary" disabled={publishing || problems.length > 0 || status === "saving"} onClick={onPublish} title={problems.length ? "Fix the problems listed first" : ""}>
        {publishing ? "Publishing…" : "Publish"}
      </button>
      {problems.length > 0 && (
        <ul class="problems">{problems.map((p) => <li><strong>{p.label}</strong>: {p.message}</li>)}</ul>
      )}
    </div>
  );
}

/* ---------- Text on this page / Images on this page ---------- */

export interface PanelSection { title: string; fields: Fields; content: unknown; onChange: (path: string, v: unknown) => void }

export function TextPanel({ sections }: { sections: PanelSection[] }) {
  return (
    <details class="panel">
      <summary>Text on this page</summary>
      {sections.map((s) => {
        const slots = walk(s.fields, s.content).filter((x) => x.field.kind === "text");
        if (!slots.length) return null;
        return (
          <div class="panel-group">
            <h4>{s.title}</h4>
            {slots.map((x) => <FieldControl id={`tp.${s.title}.${x.path}`} field={x.field as TextField} value={x.value} onChange={(v) => s.onChange(x.path, v)} />)}
          </div>
        );
      })}
    </details>
  );
}

export function ImagesPanel({ sections }: { sections: PanelSection[] }) {
  return (
    <details class="panel">
      <summary>Images on this page</summary>
      {sections.map((s) => {
        const slots = walk(s.fields, s.content).filter((x) => x.field.kind === "image");
        if (!slots.length) return null;
        return (
          <div class="panel-group">
            <h4>{s.title}</h4>
            {slots.map((x) => <FieldControl id={`ip.${s.title}.${x.path}`} field={x.field as ImageField} value={x.value} onChange={(v) => s.onChange(x.path, v)} />)}
          </div>
        );
      })}
    </details>
  );
}

/* ---------- versions ---------- */

export function Versions({ ownerType, ownerId, onRestored, refreshKey }: { ownerType: string; ownerId: string; onRestored: () => void; refreshKey: number }) {
  const [list, setList] = useState<{ id: number; reason: string; created_at: number }[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) void api<typeof list>("GET", `versions?owner_type=${ownerType}&owner_id=${encodeURIComponent(ownerId)}`).then(setList);
  }, [open, ownerType, ownerId, refreshKey]);
  const restore = async (id: number) => {
    if (!confirm("Restore this version into the draft? The current draft is kept as a version too.")) return;
    await api("POST", `versions/${id}/restore`, {});
    onRestored();
  };
  return (
    <details class="panel" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Version history</summary>
      {list.length === 0 ? <p class="muted small">No versions yet. One is saved on every publish and every 10 minutes of editing.</p> : (
        <ul class="versions">{list.map((v) => <li><span>{v.reason}, {ago(v.created_at)}</span><button type="button" class="mini" onClick={() => restore(v.id)}>Restore</button></li>)}</ul>
      )}
    </details>
  );
}
