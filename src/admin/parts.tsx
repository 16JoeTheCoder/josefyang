/** Shared admin pieces: preview iframe, Text/Images panels, version history, status bar. */
import { useEffect, useRef, useState } from "preact/hooks";
import { walk, type Fields, type ImageField, type TextField } from "../core/fields";
import { api, isApiError } from "./api";
import { statusText, type Problem, type SaveStatus } from "./autosave";
import { FieldControl } from "./Fields";
import { ago } from "./state";

/* ---------- path helpers ---------- */

export function setAtPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.replace(/\[(\d+)\]/g, ".$1").split(".").filter(Boolean);
  if (!keys.length) return obj;
  const clone = structuredClone(obj) as Record<string, unknown>;
  let cur: Record<string, unknown> = clone;
  for (const [i, key] of keys.entries()) {
    if (i === keys.length - 1) break;
    const child = cur[key];
    if (!child || typeof child !== "object") cur[key] = /^\d+$/.test(keys[i + 1]!) ? [] : {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[keys.at(-1)!] = value;
  return clone as T;
}

/* ---------- preview ---------- */


export interface PickMsg { section: string; path?: string | null; text: string; mediaKey: string | null; image: boolean }
export interface PreviewSelection { section: string; path: string | null }
export type LiveSend = (section: string, old: string, next: string, path?: string) => void;

interface PreviewProps {
  route: string;
  reloadKey: number;
  onPick?: (pick: PickMsg) => void;
  liveRef?: { current: LiveSend | null };
  selection?: PreviewSelection | null;
  /** Only a deliberate selection in the inspector or a deep link scrolls the canvas. */
  selectionRequest?: number;
  editMode?: boolean;
  showToolbar?: boolean;
  onFrameReady?: () => void;
}

export function Preview({ route, reloadKey, onPick, liveRef, selection, selectionRequest = 0, editMode = Boolean(onPick), showToolbar = true, onFrameReady }: PreviewProps) {
  const [width, setWidth] = useState<"desktop" | "mobile">(() => typeof window !== "undefined" && window.matchMedia("(max-width: 620px)").matches ? "mobile" : "desktop");
  const [loading, setLoading] = useState(true);
  const frame = useRef<HTMLIFrameElement>(null);
  const previousRoute = useRef<string | null>(null);
  const restoreScroll = useRef<number | null>(null);
  const sentRequest = useRef(0);
  const previousMode = useRef(editMode);
  const previewSrc = "/preview" + route + (route.includes("?") ? "&" : "?") + "r=" + reloadKey;
  const latest = useRef({ onPick, selection, selectionRequest, editMode, onFrameReady });
  latest.current = { onPick, selection, selectionRequest, editMode, onFrameReady };
  const post = (message: object) => {
    const current = frame.current?.contentWindow;
    try {
      if (current?.location.origin === location.origin) current.postMessage(message, location.origin);
    } catch { /* Only the same-origin draft accepts editor messages. */ }
  };
  const updateSelection = (allowScroll: boolean) => {
    const { selection, selectionRequest } = latest.current;
    const jump = allowScroll && selectionRequest !== sentRequest.current;
    if (allowScroll) sentRequest.current = selectionRequest;
    post({ type: "jy-select", section: selection?.section ?? "", path: selection?.path ?? null, scroll: jump });
  };

  useEffect(() => {
    if (liveRef) liveRef.current = (section, old, next, path) => post({ type: "jy-live", section, old, next, path });
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || e.data?.type !== "jy-pick") return;
      if (latest.current.editMode && typeof e.data.section === "string") latest.current.onPick?.(e.data as PickMsg);
    };
    window.addEventListener("message", onMsg);
    return () => {
      window.removeEventListener("message", onMsg);
      if (liveRef) liveRef.current = null;
    };
  }, [liveRef]);

  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    const newRoute = previousRoute.current !== route;
    previousRoute.current = route;
    restoreScroll.current = null;
    if (!newRoute) {
      try { restoreScroll.current = f.contentWindow?.scrollY ?? null; } catch { /* The sign-in page has a different origin. */ }
    }
    setLoading(true);
    try {
      if (!newRoute && f.contentWindow) f.contentWindow.location.replace(previewSrc);
      else f.src = previewSrc;
    } catch { f.src = previewSrc; }
  }, [route, reloadKey]);

  useEffect(() => {
    // Links followed in browse mode can leave the draft URL inside the frame.
    if (editMode && !previousMode.current && frame.current) {
      const expected = new URL(previewSrc, location.origin);
      let isDraft = false;
      try { isDraft = frame.current.contentWindow?.location.pathname === expected.pathname; } catch { /* Cross-origin preview navigation. */ }
      if (!isDraft) {
        frame.current.src = previewSrc;
        setLoading(true);
      }
    }
    previousMode.current = editMode;
  }, [editMode]);

  useEffect(() => {
    if (!loading) {
      post({ type: "jy-mode", editing: editMode });
      updateSelection(true);
    }
  }, [editMode, selection?.section, selection?.path, selectionRequest, loading]);

  const onLoad = () => {
    if (restoreScroll.current !== null) {
      try { frame.current?.contentWindow?.scrollTo(0, restoreScroll.current); } catch { /* The sign-in page has a different origin. */ }
      restoreScroll.current = null;
    }
    setLoading(false);
    post({ type: "jy-mode", editing: latest.current.editMode });
    updateSelection(true);
    latest.current.onFrameReady?.();
  };

  const box = useRef<HTMLDivElement>(null);
  const [desktop, setDesktop] = useState({ width: 1440, scale: 1 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const available = el.clientWidth - 24;
      const viewport = Math.max(1024, Math.min(1440, available));
      setDesktop({ width: viewport, scale: Math.min(1, Math.max(.1, available / viewport)) });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  return (
    <div class="preview" data-preview-mode={editMode ? "edit" : "browse"}>
      {showToolbar && <div class="preview-bar">
        <div class="seg" role="group" aria-label="Preview device">
          <button type="button" aria-pressed={width === "desktop"} class={width === "desktop" ? "on" : ""} onClick={() => setWidth("desktop")}>Desktop</button>
          <button type="button" aria-pressed={width === "mobile"} class={width === "mobile" ? "on" : ""} onClick={() => setWidth("mobile")}>Mobile</button>
        </div>
        {onPick && <span class="preview-hint">{editMode ? "Select an element to edit it" : "Preview interactions are enabled"}</span>}
        <a href={"/preview" + route} target="_blank" rel="noopener">Open preview</a>
      </div>}
      <div class={"preview-frame " + width} aria-busy={loading} ref={box} style={width === "desktop" ? "--s:" + desktop.scale : undefined}>
        <iframe ref={frame} title="Live draft preview" onLoad={onLoad} style={width === "desktop" ? { width: desktop.width } : undefined} />
      </div>
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

export function Versions({ ownerType, ownerId, onRestored, refreshKey, beforeRestore, expanded = false }: {
  ownerType: string;
  ownerId: string;
  onRestored: () => void | Promise<void>;
  refreshKey: number;
  beforeRestore?: () => Promise<void>;
  expanded?: boolean;
}) {
  const [list, setList] = useState<{ id: number; reason: string; created_at: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open && !expanded) return;
    let active = true;
    setLoading(true);
    setError("");
    void api<typeof list>("GET", `versions?owner_type=${ownerType}&owner_id=${encodeURIComponent(ownerId)}`).then(
      (versions) => { if (active) setList(versions); },
      () => { if (active) setError("Could not load version history."); },
    ).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, expanded, ownerType, ownerId, refreshKey]);

  const restore = async (id: number) => {
    if (!confirm("Restore this version into the draft? The current draft is kept as a version too.")) return;
    setRestoring(true);
    setError("");
    try {
      await beforeRestore?.();
      await api("POST", `versions/${id}/restore`, {});
      await onRestored();
    } catch (cause) {
      setError(isApiError(cause) ? cause.error : "Could not restore this version.");
    } finally { setRestoring(false); }
  };
  const history = <>
      {error && <p class="warn small" role="status">{error}</p>}
      {loading && <p class="muted small" role="status">Loading history…</p>}
      {!loading && (list.length === 0 ? !error && <p class="muted small">No versions yet. One is saved on every publish and every 10 minutes of editing.</p> : (
        <ul class="versions">{list.map((v) => <li><span>{v.reason}, {ago(v.created_at)}</span><button type="button" class="mini" disabled={restoring} onClick={() => void restore(v.id)}>Restore</button></li>)}</ul>
      ))}
    </>;
  return expanded ? history : <details class="panel" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
    <summary>Version history</summary>
    {history}
  </details>;
}
