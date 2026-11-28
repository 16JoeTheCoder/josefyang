/** Serializes autosaves and gives explicit actions a save barrier. */
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { isApiError } from "./api";

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "conflict" | "error";
export interface Problem { path: string; label: string; message: string }
export type Saver<T> = (value: T, updatedAt: number, keepalive: boolean) => Promise<{ updatedAt: number; problems?: Problem[] }>;

export function useAutosave<T>(initial: T, initialUpdatedAt: number, save: Saver<T>) {
  const [value, setValueState] = useState<T>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<Problem[]>([]);
  const saveRef = useRef(save);
  saveRef.current = save;
  const state = useRef({ value: initial, updatedAt: initialUpdatedAt, dirty: false, timer: 0, retry: 0,
    pending: null as Promise<void> | null, revision: 0, generation: 0, conflict: null as unknown, mounted: true });

  const flush = useCallback(async (keepalive = false) => {
    const s = state.current;
    window.clearTimeout(s.timer);
    while (s.dirty || s.pending) {
      if (s.conflict) throw s.conflict;
      if (s.pending) {
        await s.pending;
        continue;
      }
      const revision = s.revision;
      const generation = s.generation;
      s.dirty = false;
      if (s.mounted) setStatus("saving");
      const pending = Promise.resolve().then(() => saveRef.current(s.value, s.updatedAt, keepalive));
      s.pending = pending.then((result) => {
        if (s.generation !== generation) return;
        s.updatedAt = result.updatedAt;
        s.retry = 0;
        if (!s.mounted) return;
        setProblems(result.problems ?? []);
        setSavedAt(Date.now());
        setError("");
        setStatus(s.revision === revision ? "saved" : "saving");
      }, (cause: unknown) => {
        if (s.generation !== generation) return;
        s.dirty = true;
        const info = isApiError(cause) ? cause : null;
        if (info?.status === 409) s.conflict = cause;
        if (s.mounted) {
          setError(info?.error ?? (cause instanceof Error ? cause.message : "Save failed"));
          setStatus(info?.status === 409 ? "conflict" : info?.status === 0 ? "offline" : "error");
          if (info?.status === 0) {
            s.retry = Math.min(s.retry + 1, 6);
            window.clearTimeout(s.timer);
            s.timer = window.setTimeout(() => { void flush().catch(() => {}); }, 1000 * 2 ** s.retry);
          }
        }
        throw cause;
      }).finally(() => { s.pending = null; });
      await s.pending;
    }
  }, []);

  const setValue = useCallback((next: T) => {
    const s = state.current;
    s.value = next;
    s.dirty = true;
    s.revision++;
    setValueState(next);
    window.clearTimeout(s.timer);
    s.timer = window.setTimeout(() => { void flush().catch(() => {}); }, 2000);
  }, [flush]);

  useEffect(() => {
    state.current.mounted = true;
    const onHide = () => { if (document.visibilityState === "hidden") void flush(true).catch(() => {}); };
    const onUnload = (event: BeforeUnloadEvent) => { if (state.current.dirty || state.current.pending) event.preventDefault(); };
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void flush().catch(() => {});
      }
    };
    const onNavigate = (event: Event) => {
      const { waitUntil } = (event as CustomEvent<{ waitUntil: (p: Promise<void>) => void }>).detail;
      waitUntil(flush());
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("keydown", onKey);
    window.addEventListener("jy-before-admin-route", onNavigate);
    return () => {
      state.current.mounted = false;
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("jy-before-admin-route", onNavigate);
      window.clearTimeout(state.current.timer);
      void flush(true).catch(() => {});
    };
  }, [flush]);

  const reset = useCallback((next: T, updatedAt: number) => {
    const s = state.current;
    window.clearTimeout(s.timer);
    s.generation++;
    s.value = next;
    s.updatedAt = updatedAt;
    s.dirty = false;
    s.retry = 0;
    s.conflict = null;
    setValueState(next);
    setStatus("idle");
    setError("");
    setProblems([]);
  }, []);

  return { value, setValue, status, savedAt, error, problems, flush, reset, isDirty: () => state.current.dirty || !!state.current.pending };
}

export function statusText(status: SaveStatus, savedAt: number, error: string): string {
  switch (status) {
    case "saving": return "Saving.";
    case "saved": return "Draft saved" + (savedAt ? " at " + new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "");
    case "offline": return "Offline, will retry";
    case "conflict": return error || "Changed in another tab. Reload to recover.";
    case "error": return error || "Save failed";
    default: return "Draft";
  }
}
