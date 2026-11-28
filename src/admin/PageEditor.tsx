import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { walk, withDefaults, type Fields, type ImageValue, type ListField, type Slot, type TextValue } from "../core/fields";
import type { PageId, Section } from "../core/module";
import { getModule, modules } from "../core/registry";
import { api, isApiError } from "./api";
import { useAutosave, type Problem } from "./autosave";
import { emptyValue, FieldControl, FieldsForm } from "./Fields";
import { Preview, StatusBar, Versions, setAtPath, type LiveSend, type PanelSection, type PickMsg } from "./parts";
import { useAdmin } from "./state";
import "./visual-workspace.css";

export interface PageRec { id: string; sections: Section[]; updatedAt: number; dirty: boolean }

export const PAGE_ROUTES: Record<string, string> = { home: "/", projects: "/projects", failures: "/failures", devlog: "/devlog", about: "/about", games: "/games" };
export const PAGE_NAMES: Record<string, string> = { home: "Home", projects: "Projects", failures: "Failures", devlog: "Devlog page", entry: "Devlog entry layout", about: "About", games: "Games journey" };

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


/** Fields visible in the inspector, with collection controls and nested paths. */
function inspectorSlots(fields: Fields, content: unknown, base = "", context = ""): (Slot & { title: string })[] {
  const record = (content ?? {}) as Record<string, unknown>;
  return Object.entries(fields).flatMap(([key, field]) => {
    const path = base ? base + "." + key : key;
    const title = context + field.label;
    const value = record[key];
    if (field.kind === "group") return inspectorSlots(field.fields, value, path, title + " / ");
    if (field.kind !== "list") return [{ path, value, field, title }];
    const items = Array.isArray(value) ? value : [];
    return [{ path, value, field, title }, ...items.flatMap((item, i) => inspectorSlots(field.of, item, path + "[" + i + "]", title + " / " + field.itemLabel + " " + (i + 1) + " / "))];
  });
}

/** An exact descriptor path takes precedence. Older sections fall back only to a unique match. */
export function findField(sections: Section[], msg: PickMsg): FocusReq | null {
  const s = sections.find((x) => x.sectionId === msg.section);
  if (!s) return null;
  const m = getModule(s.moduleId);
  const slots = m ? inspectorSlots(m.fields, s.content) : [];
  const exact = msg.path && slots.find((slot) => slot.path === msg.path);
  const norm = (v: string) => v.replace(/\s+/g, " ").trim();
  const text = norm(msg.text ?? "");
  const matches = msg.image ? slots.filter(({ field, value }) => {
    if (field.kind !== "image") return false;
    const image = value as ImageValue | undefined;
    return msg.mediaKey ? image?.key === msg.mediaKey : !image?.mediaId;
  }) : text ? slots.filter(({ field, value }) =>
    field.kind === "text" && norm((value as TextValue | undefined)?.value ?? "") === text,
  ) : [];
  return { sectionId: s.sectionId, path: exact ? exact.path : matches.length === 1 ? matches[0]!.path : null, n: performance.now() };
}

function prepareSections(sections: Section[]): Section[] {
  return sections.map((section) => {
    const m = getModule(section.moduleId);
    if (!m) return section;
    const content = section.moduleVersion < m.version && m.migrate ? m.migrate(section.content, section.moduleVersion) : section.content;
    return { ...section, moduleVersion: m.version, content: withDefaults(m.defaults, content) };
  });
}

function CollectionInspector({ slot, onChange, onPick }: { slot: Slot<ListField>; onChange: (value: unknown) => void; onPick: (path: string) => void }) {
  const items = Array.isArray(slot.value) ? slot.value as Record<string, unknown>[] : [];
  const { field, path } = slot;
  const move = (from: number, to: number) => {
    const next = [...items];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  return <div class="visual-collection">
    <p>{items.length} of {field.max} items</p>
    <ol>
      {items.map((item, i) => {
        const label = Object.entries(field.of).find(([, child]) => child.kind === "text");
        const title = label && (item[label[0]] as TextValue | undefined)?.value;
        const children = inspectorSlots(field.of, item, path + "[" + i + "]");
        return <li key={i}>
          <strong>{title || field.itemLabel + " " + (i + 1)}</strong>
          <div class="visual-collection-actions">
            {children[0] && <button type="button" class="mini" onClick={() => onPick(children[0]!.path)}>Edit</button>}
            <button type="button" class="mini" disabled={!i} onClick={() => move(i, i - 1)} aria-label={"Move item " + (i + 1) + " up"}>Up</button>
            <button type="button" class="mini" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} aria-label={"Move item " + (i + 1) + " down"}>Down</button>
            <button type="button" class="mini danger" disabled={items.length <= field.min} onClick={() => onChange(items.filter((_, j) => i !== j))}>Remove</button>
          </div>
        </li>;
      })}
    </ol>
    {items.length < field.max && <button type="button" onClick={() => onChange([...items, emptyValue({ kind: "group", label: field.itemLabel, fields: field.of })])}>Add {field.itemLabel.toLowerCase()}</button>}
  </div>;
}

/** One selected field only. The chooser provides access to settings without a canvas element. */
export function FieldInspector({ title, fields, content, focus, onPick, onChange, onClose }: {
  title: string;
  fields: Fields;
  content: unknown;
  focus: FocusReq;
  onPick: (path: string | null) => void;
  onChange: (path: string, value: unknown) => void;
  onClose: () => void;
}) {
  const selectedControl = useRef<HTMLDivElement>(null);
  const slots = inspectorSlots(fields, content);
  const selected = slots.find((slot) => slot.path === focus.path);
  useEffect(() => {
    const field = selectedControl.current?.querySelector<HTMLElement>('textarea, input:not([type="range"]):not([type="checkbox"])');
    if (selected?.field.kind === "text") field?.focus({ preventScroll: true });
    else if (!selected) selectedControl.current?.querySelector<HTMLElement>("select")?.focus({ preventScroll: true });
  }, [focus.n]);

  return <>
    <div class="visual-inspector-heading">
      <div><p>{title}</p><h2>{selected?.field.label ?? "Properties"}</h2></div>
      <button type="button" class="mini" onClick={onClose}>Clear</button>
    </div>
    <div class="visual-inspector-content" ref={selectedControl}>
      <label class="visual-field-picker">
        <span>{selected ? "Switch property" : "Choose a property"}</span>
        <select value={selected?.path ?? ""} onChange={(event) => onPick((event.currentTarget as HTMLSelectElement).value || null)}>
          <option value="">{selected ? "Select a different property" : "Select a property"}</option>
          {slots.map(({ path, title: label }) => <option key={path} value={path}>{label}</option>)}
        </select>
      </label>
      {selected && (selected.field.kind === "list"
        ? <CollectionInspector key={selected.path} slot={selected as Slot<ListField>} onChange={(value) => onChange(selected.path, value)} onPick={onPick} />
        : <FieldControl key={selected.path} id={focus.sectionId + "." + selected.path} field={selected.field} value={selected.value} onChange={(value) => onChange(selected.path, value)} />)}
      {!selected && <p class="muted small">Choose a property here, or select an element on the page.</p>}
    </div>
  </>;
}

/** Structural edits are grouped in the section outline, away from individual properties. */
export function SectionLayers({ sections, page = "build", onChange, onSelect }: {
  sections: Section[];
  page?: string;
  onChange: (sections: Section[]) => void;
  onSelect: (id: string) => void;
}) {
  const [addId, setAddId] = useState("");
  const [remove, setRemove] = useState<string | null>(null);
  const kind = PAGE_KIND[page] ?? "build";
  const available = Object.values(modules).filter((m) => m.pages.includes(kind)).sort((a, b) => a.name.localeCompare(b.name));
  const move = (i: number, to: number) => {
    const next = [...sections];
    const [section] = next.splice(i, 1);
    next.splice(to, 0, section!);
    onChange(next);
  };
  function add() {
    const m = getModule(addId);
    if (!m) return;
    let id = m.id;
    for (let i = 2; sections.some((section) => section.sectionId === id); i++) id = m.id + "-" + i;
    onChange([...sections, { sectionId: id, moduleId: m.id, moduleVersion: m.version, content: structuredClone(m.defaults) }]);
    setAddId("");
    onSelect(id);
  }

  return <div class="visual-layer-list">
    <ol>
      {sections.map((section, i) => <li class="visual-layer" key={section.sectionId}>
        <button type="button" class="visual-layer-name" onClick={() => onSelect(section.sectionId)}>
          <strong>{getModule(section.moduleId)?.name ?? section.moduleId}</strong>
          {section.hidden && <span class="muted small">Hidden</span>}
        </button>
        <details>
          <summary>Section options</summary>
          <div class="visual-collection-actions">
            <button type="button" class="mini" disabled={i === 0} onClick={() => move(i, i - 1)}>Move up</button>
            <button type="button" class="mini" disabled={i === sections.length - 1} onClick={() => move(i, i + 1)}>Move down</button>
            <button type="button" class="mini" onClick={() => onChange(sections.map((item) => item === section ? { ...item, hidden: !item.hidden } : item))}>{section.hidden ? "Show" : "Hide"}</button>
            <button type="button" class="mini danger" onClick={() => {
              if (remove !== section.sectionId) { setRemove(section.sectionId); return; }
              onChange(sections.filter((item) => item !== section));
              setRemove(null);
            }}>{remove === section.sectionId ? "Confirm removal" : "Remove"}</button>
            {remove === section.sectionId && <button type="button" class="mini" onClick={() => setRemove(null)}>Cancel</button>}
          </div>
        </details>
      </li>)}
    </ol>
    {available.length > 0 && sections.length < 40 && <div class="visual-add-layer">
      <label><span>Add a section</span>
        <select value={addId} onChange={(event) => setAddId((event.currentTarget as HTMLSelectElement).value)}>
          <option value="">Choose a section type</option>
          {available.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <button type="button" disabled={!addId} onClick={add}>Add section</button>
    </div>}
  </div>;
}

/** Text slots whose value changed between two drafts (sent to the preview live, before saving). */
export function changedTexts(prev: Section[], next: Section[]): { section: string; old: string; next: string; path: string }[] {
  const out: { section: string; old: string; next: string; path: string }[] = [];
  for (const n of next) {
    const p = prev.find((x) => x.sectionId === n.sectionId);
    const m = getModule(n.moduleId);
    if (!p || !m || p.content === n.content) continue;
    const before = new Map(walk(m.fields, p.content).filter((x) => x.field.kind === "text").map((x) => [x.path, (x.value as TextValue | undefined)?.value ?? ""]));
    for (const x of walk(m.fields, n.content)) {
      if (x.field.kind !== "text") continue;
      const v = (x.value as TextValue | undefined)?.value ?? "";
      const o = before.get(x.path);
      if (o !== undefined && o !== v) out.push({ section: n.sectionId, old: o, next: v, path: x.path });
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


export function PageEditor({ page, onPublished, focusSection, entryPreviewId, onOpenDevlog }: {
  page: PageRec;
  onPublished: () => void;
  focusSection?: string | null;
  entryPreviewId?: string;
  onOpenDevlog?: () => void;
}) {
  const { toast } = useAdmin();
  const [reloadKey, setReloadKey] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(page.dirty);
  const [serverProblems, setServerProblems] = useState<Problem[]>([]);
  const [focus, setFocus] = useState<FocusReq | null>(null);
  const [pane, setPane] = useState<"properties" | "sections" | "history">("properties");
  const [editMode, setEditMode] = useState(true);
  const [canvasRequest, setCanvasRequest] = useState(0);
  const live = useRef<LiveSend | null>(null);
  const inspector = useRef<HTMLElement>(null);
  const a = useAutosave<Section[]>(prepareSections(page.sections), page.updatedAt, async (sections, updatedAt, keepalive) => {
    const saved = await api<{ updatedAt: number; problems: Problem[] }>("PATCH", "pages/" + page.id, { sections, updatedAt }, { keepalive });
    setReloadKey((k) => k + 1);
    return saved;
  });
  const valueRef = useRef(a.value);
  valueRef.current = a.value;
  const route = page.id === "entry"
    ? entryPreviewId ? `/devlog/${encodeURIComponent(entryPreviewId)}` : null
    : PAGE_ROUTES[page.id] ?? "/";
  const selected = a.value.find((item) => item.sectionId === focus?.sectionId);
  const selectedModule = selected && getModule(selected.moduleId);

  function choose(sectionId: string, path: string | null, jump = true) {
    setFocus({ sectionId, path, n: performance.now() });
    setPane("properties");
    setEditMode(true);
    if (jump) setCanvasRequest((n) => n + 1);
  }

  useEffect(() => {
    if (focusSection) choose(focusSection, null);
  }, [focusSection]);

  const revealInspector = useCallback(() => {
    if (matchMedia("(max-width: 850px)").matches) inspector.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const onPick = useCallback((msg: PickMsg) => {
    const result = findField(valueRef.current, msg);
    if (!result) return;
    setFocus(result);
    setPane("properties");
    revealInspector();
  }, [revealInspector]);

  function edit(next: Section[]) {
    for (const c of changedTexts(valueRef.current, next)) live.current?.(c.section, c.old, c.next, c.path);
    valueRef.current = next;
    setDirty(true);
    setServerProblems([]);
    a.setValue(next);
  }

  async function publish() {
    setPublishing(true);
    try {
      await a.flush();
      if (a.isDirty()) { toast("Wait for the draft to save before publishing."); return; }
      await api("POST", "pages/" + page.id + "/publish", {});
      setDirty(a.isDirty());
      setServerProblems([]);
      toast((PAGE_NAMES[page.id] ?? page.id) + " is live.");
      onPublished();
    } catch (e) {
      if (isApiError(e)) { setServerProblems(e.problems ?? []); toast(e.error); }
      else toast("Could not publish this page.");
    } finally { setPublishing(false); }
  }

  async function upgradeLayout() {
    await a.flush();
    const r = await api<{ changed: boolean; notes: string[] }>("POST", "pages/" + page.id + "/upgrade-layout", {});
    await reload();
    toast(r.changed ? `Draft updated: ${r.notes.join(". ")}. Publish when it looks right.` : "The Home draft already uses the new layout.");
  }

  async function reload() {
    const restored = await api<PageRec>("GET", "pages/" + page.id);
    a.reset(prepareSections(restored.sections), restored.updatedAt);
    setDirty(restored.dirty);
    setServerProblems([]);
    setFocus(null);
    setReloadKey((k) => k + 1);
  }

  return <section class="visual-workspace" aria-label="Page editor">
    <header class="visual-workspace-toolbar">
      <h1>{PAGE_NAMES[page.id] ?? page.id}</h1>
      <div class="visual-workspace-actions">
        <button type="button" aria-pressed={pane === "sections"} onClick={() => { setPane(pane === "sections" ? "properties" : "sections"); setEditMode(true); revealInspector(); }}>Sections</button>
        <button type="button" aria-pressed={pane === "history"} onClick={() => { setPane(pane === "history" ? "properties" : "history"); revealInspector(); }}>History</button>
        {page.id === "home" && !a.value.some((s) => s.moduleId === "on-my-bench") && <button type="button" onClick={() => void upgradeLayout().catch(() => toast("Could not update the layout."))}
          title="Adds On my bench after the floor and hides the two older sections in the draft. The live page changes only when you publish.">Use the new Home layout</button>}
        {route && <button type="button" aria-pressed={!editMode} onClick={() => setEditMode((v) => !v)}>{editMode ? "Preview interactions" : "Back to editing"}</button>}
      </div>
      <StatusBar status={a.status} savedAt={a.savedAt} error={a.error} problems={a.problems.length ? a.problems : serverProblems} onPublish={publish} publishing={publishing} dirty={dirty}
        extra={<button type="button" onClick={() => void a.flush().catch(() => { /* The save status shows the error. */ })} disabled={a.status === "saving" || !a.isDirty()}>Save draft</button>} />
    </header>
    <div class="visual-workspace-body">
      {route ? <Preview route={route} reloadKey={reloadKey} editMode={editMode} onPick={onPick} liveRef={live}
        selection={focus ? { section: focus.sectionId, path: focus.path } : null} selectionRequest={canvasRequest} /> : <div class="preview visual-canvas-empty">
        <h2>Preview an entry</h2>
        <p>Create a Devlog entry to see this layout with your content.</p>
        {onOpenDevlog && <button type="button" onClick={onOpenDevlog}>Open Devlog</button>}
      </div>}
      <aside ref={inspector} class="visual-inspector" aria-label={pane === "properties" ? "Selected properties" : pane === "sections" ? "Page sections" : "Version history"}>
        {pane === "sections" ? <>
          <div class="visual-inspector-heading"><h2>Sections</h2><button type="button" class="mini" onClick={() => setPane("properties")}>Close</button></div>
          <SectionLayers sections={a.value} page={page.id} onChange={edit} onSelect={(id) => choose(id, null)} />
        </> : pane === "history" ? <>
          <div class="visual-inspector-heading"><h2>History</h2><button type="button" class="mini" onClick={() => setPane("properties")}>Close</button></div>
          <div class="visual-inspector-content"><Versions ownerType="page" ownerId={page.id} beforeRestore={a.flush} onRestored={reload} refreshKey={reloadKey} expanded /></div>
        </> : selected && selectedModule && focus ? (
          <FieldInspector title={selectedModule.name} fields={selectedModule.fields} content={selected.content} focus={focus}
            onPick={(path) => choose(selected.sectionId, path)} onClose={() => setFocus(null)}
            onChange={(path, value) => edit(valueRef.current.map((item) => item.sectionId === selected.sectionId ? { ...item, content: setAtPath(item.content, path, value) } : item))} />
        ) : <>
          <div class="visual-inspector-heading"><h2>Properties</h2></div>
          <div class="visual-inspector-content visual-inspector-empty">
            <p>{!route ? "Browse the layout’s sections to edit their properties." : editMode ? "Select text or an image on the page to edit it here." : "Return to editing to select elements on the page."}</p>
            {editMode && <button type="button" onClick={() => setPane("sections")}>Browse sections</button>}
          </div>
        </>}
      </aside>
    </div>
  </section>;
}
