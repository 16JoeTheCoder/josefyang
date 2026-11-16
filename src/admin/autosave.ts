/**
 * Autosave (architecture §12.5): saves ~2 s after typing stops, on blur and when the tab is hidden.
 * Offline: retries with backoff. Two tabs: the server rejects stale saves (409) and we show "Changed in another tab".
 */
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { isApiError } from "./api";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "conflict" | "error";
export interface Problem { path: string; label: string; message: string }
export type Saver<T> = (value: T, updatedAt: number, keepalive: boolean) => Promise<{ updatedAt: number; problems?: Problem[] }>;

export function useAutosave<T>(initial: T, initialUpdatedAt: number, save: Saver<T>) {
  const [value, setValueState] = useState<T>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const r = useRef({ value: initial, updatedAt: initialUpdatedAt, dirty: false, timer: 0, retry: 0, inflight: false, version: 0 });

  const run = useCallback(async (keepalive = false) => {
    const s = r.current;
    if (!s.dirty || s.inflight) return;
    s.inflight = true;
    s.dirty = false;
    const sentVersion = s.version;
    setStatus("saving");
    try {
      const res = await save(s.value, s.updatedAt, keepalive);
      s.updatedAt = res.updatedAt;
      s.retry = 0;
      setProblems(res.problems ?? []);
      setSavedAt(Date.now());
      setError("");
      setStatus(s.version === sentVersion ? "saved" : "saving");
    } catch (e) {
      s.dirty = true;
      if (isApiError(e) && e.status === 409) { setStatus("conflict"); setError(e.error); s.inflight = false; return; }
      if (isApiError(e) && e.status === 0) {
        setStatus("offline");
        s.retry = Math.min(s.retry + 1, 6);
        window.clearTimeout(s.timer);
        s.timer = window.setTimeout(() => void run(), 1000 * 2 ** s.retry);
      } else { setStatus("error"); setError(isApiError(e) ? e.error : "Save failed"); }
    } finally {
      s.inflight = false;
    }
    if (s.dirty && s.retry === 0 && status !== "conflict") { window.clearTimeout(s.timer); s.timer = window.setTimeout(() => void run(), 2000); }
  }, [save]);

  const setValue = useCallback((v: T) => {
    const s = r.current;
    s.value = v;
    s.dirty = true;
    s.version++;
    setValueState(v);
    window.clearTimeout(s.timer);
    s.timer = window.setTimeout(() => void run(), 2000);
  }, [run]);

  const flush = useCallback(() => { window.clearTimeout(r.current.timer); return run(); }, [run]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") void run(true); };
    const onUnload = (e: BeforeUnloadEvent) => { if (r.current.dirty || r.current.inflight) { e.preventDefault(); } };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("beforeunload", onUnload); window.clearTimeout(r.current.timer); };
  }, [run]);

  /** Replace local state from the server (after restore or reload) without saving. */
  const reset = useCallback((v: T, updatedAt: number) => {
    const s = r.current;
    s.value = v; s.updatedAt = updatedAt; s.dirty = false;
    setValueState(v); setStatus("idle"); setError("");
  }, []);

  return { value, setValue, status, savedAt, error, problems, flush, reset, isDirty: () => r.current.dirty || r.current.inflight };
}

export function statusText(status: SaveStatus, savedAt: number, error: string): string {
  switch (status) {
    case "saving": return "Saving…";
    case "saved": return `Draft, saved ${Math.max(0, Math.round((Date.now() - savedAt) / 1000))}s ago`;
    case "offline": return "Offline, will retry";
    case "conflict": return error || "Changed in another tab. Reload?";
    case "error": return error || "Save failed";
    default: return "Draft";
  }
}
