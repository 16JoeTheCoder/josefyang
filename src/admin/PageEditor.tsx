import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { walk, type Fields, type ImageValue, type TextValue } from "../core/fields";
import type { PageId, Section } from "../core/module";
import { getModule, modules } from "../core/registry";
import { api, isApiError } from "./api";
import { useAutosave, type Problem } from "./autosave";
import { FieldsForm } from "./Fields";
import { ImagesPanel, Preview, StatusBar, TextPanel, Versions, setAtPath, type LiveSend, type PanelSection, type PickMsg } from "./parts";
import { useAdmin } from "./state";

export interface PageRec { id: string; sections: Section[]; updatedAt: number; dirty: boolean }

export const PAGE_ROUTES: Record<string, string> = { home: "/", projects: "/projects", failures: "/failures", devlog: "/devlog", about: "/about", entry: "/devlog" };
export const PAGE_NAMES: Record<string, string> = { home: "Home", projects: "Projects", failures: "Failures", devlog: "Devlog page", entry: "Devlog entry layout", about: "About" };

/** A request from the preview (or the panels) to open a section and focus one of its fields. */
export interface FocusReq { sectionId: string; path: string | null; n: number }

const PAGE_KIND: Record<string, PageId> = { home: "home", projects: "projects", failures: "failures", devlog: "devlog", entry: "devlog", about: "about" };

/** Section list editor: reused by pages and by build pages. Drag the handle or use Move up/down. */
export function SectionsEditor({ sections, onChange, page = "build", focus }: { sections: Section[]; onChange: (s: Section[]) => void; page?: string; focus?: FocusReq | null }) {
  const [open, setOpen] = useState<string | null>(sections[0]?.sectionId ?? null);
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; h: number } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const move = (from: number, to: number) => { if (from === to) return; const a = [...sections]; const [x] = a.splice(from, 1); a.splice(to, 0, x!); onChange(a); };

  // Click-to-edit: open the section, then focus and flash the field.
  useEffect(() => {
    if (!focus) return;
    setOpen(focus.sectionId);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const root = listRef.current?.querySelector<HTMLElement>(`[data-section="${CSS.escape(focus.sectionId)}"]`);
      const field = focus.path ? root?.querySelector<HTMLElement>(`[data-field-path="${CSS.escape(`${focus.sectionId}.${focus.path}`)}"]`) : null;
      const target = field ?? root;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.classList.remove("flash"); void target?.offsetWidth; target?.classList.add("flash");
      field?.querySelector<HTMLElement>("input, textarea, select, button")?.focus({ preventScroll: true });
    }));
  }, [focus?.n]);

  // Pointer drag on the handle. Only transforms move during the drag; the order commits on release.
  const onHandleDown = (i: number) => (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setOpen(null); // collapse first so every row is the same height while dragging
    let rects: DOMRect[] = [];
    let h = 0;
    let startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    let state = { from: i, to: i, dy: 0, h };
    setDrag(state);
    const onMove = (ev: PointerEvent) => {
      if (!rects.length) {
        const items = [...(listRef.current?.children ?? [])] as HTMLElement[];
        rects = items.map((el) => el.getBoundingClientRect());
        h = rects[i]!.height + 8;
        startY = rects[i]!.top + rects[i]!.height / 2; // collapsing moved the row: follow the pointer from its new centre
      }
      const dy = ev.clientY - startY;
      const mid = rects[i]!.top + rects[i]!.height / 2 + dy;
      let to = i;
      rects.forEach((r, k) => { if (k < i && mid < r.top + r.height / 2) to = Math.min(to, k); if (k > i && mid > r.top + r.height / 2) to = Math.max(to, k); });
      state = { from: i, to, dy, h };
      setDrag(state);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      setDrag(null);
      move(state.from, state.to);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  const shift = (k: number) => {
    if (!drag) return undefined;
    if (k === drag.from) return `transform: translateY(${drag.dy}px); z-index: 2; box-shadow: 0 18px 30px -18px rgb(0 0 0 / .35)`;
    if (drag.from < drag.to && k > drag.from && k <= drag.to) return `transform: translateY(${-drag.h}px)`;
    if (drag.from > drag.to && k < drag.from && k >= drag.to) return `transform: translateY(${drag.h}px)`;
    return "transform: none";
  };

  const kind = PAGE_KIND[page] ?? "build";
  const available = Object.values(modules).filter((m) => m.pages.includes(kind)).sort((a, b) => a.name.localeCompare(b.name));
  const add = (moduleId: string) => {
    const m = getModule(moduleId)!;
    let id = moduleId; let k = 2;
    while (sections.some((x) => x.sectionId === id)) id = `${moduleId}-${k++}`;
    onChange([...sections, { sectionId: id, moduleId, moduleVersion: m.version, content: structuredClone(m.defaults) }]);
    setAdding(false); setOpen(id);
  };

  return (
    <div class="sections-wrap">
      <ol class={`sections ${drag ? "is-dragging" : ""}`} ref={listRef}>
        {sections.map((s, i) => {
          const m = getModule(s.moduleId);
          const isOpen = open === s.sectionId;
          return (
            <li class={`section ${s.hidden ? "is-hidden" : ""} ${drag?.from === i ? "is-lifted" : ""}`} key={s.sectionId} data-section={s.sectionId} style={shift(i)}>
              <div class="section-bar">
                <span class="drag-handle" onPointerDown={onHandleDown(i)} title="Drag to reorder" aria-hidden="true"><span></span><span></span><span></span></span>
                <button type="button" class="section-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.sectionId)}>
                  <span class="num">{i + 1}</span> {m?.name ?? s.moduleId}{s.hidden ? " (hidden)" : ""}
                </button>
                <span class="section-actions">
                  <button type="button" class="mini" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Move ${m?.name} up`}>Move up</button>
                  <button type="button" class="mini" disabled={i === sections.length - 1} onClick={() => move(i, i + 1)} aria-label={`Move ${m?.name} down`}>Move down</button>
                  <button type="button" class="mini" onClick={() => onChange(sections.map((x, k) => (k === i ? { ...x, hidden: !x.hidden } : x)))}>{s.hidden ? "Show" : "Hide"}</button>
                  <button type="button" class={`mini ${confirmRemove === s.sectionId ? "danger" : ""}`} onBlur={() => setConfirmRemove(null)}
                    onClick={() => { if (confirmRemove === s.sectionId) { onChange(sections.filter((_, k) => k !== i)); setConfirmRemove(null); } else setConfirmRemove(s.sectionId); }}>
                    {confirmRemove === s.sectionId ? "Click again to remove" : "Remove"}
                  </button>
                </span>
              </div>
              {isOpen && m && (
                <div class="section-body">
                  <p class="muted small">{m.description}</p>
                  <FieldsForm fields={m.fields} value={s.content as Record<string, unknown>} onChange={(c) => onChange(sections.map((x, k) => (k === i ? { ...x, content: c } : x)))} path={s.sectionId} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {adding ? (
        <div class="library" role="group" aria-label="Add a section">
          <div class="library-head"><strong>Add a section</strong><button type="button" class="mini" onClick={() => setAdding(false)}>Close</button></div>
          <ul class="library-list">
            {available.map((m) => (
              <li><button type="button" class="library-item" onClick={() => add(m.id)}><strong>{m.name}</strong><span>{m.description}</span></button></li>
            ))}
          </ul>
        </div>
      ) : (
        <button type="button" class="add-section" onClick={() => setAdding(true)}>+ Add a section</button>
      )}
    </div>
  );
}

/** Finds which field of a section shows this text or image (click-to-edit from the preview). */
export function findField(sections: Section[], msg: PickMsg): FocusReq | null {
  const s = sections.find((x) => x.sectionId === msg.section);
  if (!s) return null;
  const m = getModule(s.moduleId);
  if (!m) return { sectionId: s.sectionId, path: null, n: Date.now() };
  const slots = walk(m.fields, s.content);
  let hit: string | null = null;
  if (msg.image) {
    hit = slots.find((x) => x.field.kind === "image" && msg.mediaKey && (x.value as ImageValue | undefined)?.key === msg.mediaKey)?.path
      ?? slots.find((x) => x.field.kind === "image" && !(x.value as ImageValue | undefined)?.mediaId)?.path ?? null;
  } else if (msg.text) {
    const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
    const want = norm(msg.text);
    const texts = slots.filter((x) => x.field.kind === "text").map((x) => ({ path: x.path, v: norm((x.value as TextValue | undefined)?.value ?? "") })).filter((x) => x.v);
    hit = texts.find((x) => x.v === want)?.path ?? texts.find((x) => want.includes(x.v) || x.v.includes(want))?.path ?? null;
  }
  return { sectionId: s.sectionId, path: hit, n: Date.now() };
}

/** Text slots whose value changed between two drafts (sent to the preview live, before saving). */
export function changedTexts(prev: Section[], next: Section[]): { section: string; old: string; next: string }[] {
  const out: { section: string; old: string; next: string }[] = [];
  for (const n of next) {
    const p = prev.find((x) => x.sectionId === n.sectionId);
    const m = getModule(n.moduleId);
    if (!p || !m || p.content === n.content) continue;
    const before = new Map(walk(m.fields, p.content).filter((x) => x.field.kind === "text").map((x) => [x.path, (x.value as TextValue | undefined)?.value ?? ""]));
    for (const x of walk(m.fields, n.content)) {
      if (x.field.kind !== "text") continue;
      const v = (x.value as TextValue | undefined)?.value ?? "";
      const o = before.get(x.path);
      if (o !== undefined && o !== v && o.trim()) out.push({ section: n.sectionId, old: o, next: v });
    }
  }
  return out;
}

export function panelSections(sections: Section[], onChange: (s: Section[]) => void): PanelSection[] {
  return sections.filter((s) => !s.hidden).flatMap((s) => {
    const m = getModule(s.moduleId);
    if (!m) return [];
    return [{
      title: m.name,
      fields: m.fields as Fields,
      content: s.content,
      onChange: (path: string, v: unknown) => onChange(sections.map((x) => (x.sectionId === s.sectionId ? { ...x, content: setAtPath(x.content, path, v) } : x))),
    }];
  });
}

export function PageEditor({ page, onPublished, focusSection }: { page: PageRec; onPublished: () => void; focusSection?: string | null }) {
  const { toast } = useAdmin();
  const [reloadKey, setReloadKey] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(page.dirty);
  const [serverProblems, setServerProblems] = useState<Problem[]>([]);
  const a = useAutosave<Section[]>(page.sections, page.updatedAt, async (sections, updatedAt, keepalive) => {
    const r = await api<{ updatedAt: number; problems: Problem[] }>("PATCH", `pages/${page.id}`, { sections, updatedAt }, { keepalive });
    setReloadKey((k) => k + 1);
    setDirty(true);
    return r;
  });
  const publish = async () => {
    setPublishing(true);
    try {
      await a.flush();
      await api("POST", `pages/${page.id}/publish`, {});
      setDirty(false); setServerProblems([]);
      toast(`${PAGE_NAMES[page.id]} is live.`);
      onPublished();
    } catch (e) {
      if (isApiError(e)) { setServerProblems(e.problems ?? []); toast(e.error); }
    } finally { setPublishing(false); }
  };
  const reload = async () => {
    const p = await api<PageRec>("GET", `pages/${page.id}`);
    a.reset(p.sections, p.updatedAt);
    setDirty(true);
    setReloadKey((k) => k + 1);
  };
  const problems = a.problems.length ? a.problems : serverProblems;
  const live = useRef<LiveSend | null>(null);
  const [focus, setFocus] = useState<FocusReq | null>(null);
  // Deep link from "Ready to publish": #page/home?s=home-hero opens that section.
  useEffect(() => { if (focusSection) setFocus({ sectionId: focusSection, path: null, n: Date.now() }); }, [focusSection]);
  const valueRef = useRef(a.value);
  valueRef.current = a.value;
  const edit = (next: Section[]) => {
    for (const c of changedTexts(valueRef.current, next)) live.current?.(c.section, c.old, c.next);
    a.setValue(next);
  };
  const onPick = useCallback((m: PickMsg) => setFocus(findField(valueRef.current, m)), []);
  return (
    <div class="split">
      <div class="editor" onFocusOut={() => void a.flush()}>
        <header class="ed-head"><h1>{PAGE_NAMES[page.id] ?? page.id}</h1></header>
        <StatusBar status={a.status} savedAt={a.savedAt} error={a.error} problems={problems} onPublish={publish} publishing={publishing} dirty={dirty} />
        <TextPanel sections={panelSections(a.value, edit)} />
        <ImagesPanel sections={panelSections(a.value, edit)} />
        <h2 class="ed-sub">Sections</h2>
        <SectionsEditor sections={a.value} onChange={edit} page={page.id} focus={focus} />
        <Versions ownerType="page" ownerId={page.id} onRestored={reload} refreshKey={reloadKey} />
      </div>
      <Preview route={PAGE_ROUTES[page.id] ?? "/"} reloadKey={reloadKey} onPick={onPick} liveRef={live} />
    </div>
  );
}
