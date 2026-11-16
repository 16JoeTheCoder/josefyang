import { useState } from "preact/hooks";
import type { Fields } from "../core/fields";
import type { Section } from "../core/module";
import { getModule } from "../core/registry";
import { api, isApiError } from "./api";
import { useAutosave, type Problem } from "./autosave";
import { FieldsForm } from "./Fields";
import { ImagesPanel, Preview, StatusBar, TextPanel, Versions, setAtPath, type PanelSection } from "./parts";
import { useAdmin } from "./state";

export interface PageRec { id: string; sections: Section[]; updatedAt: number; dirty: boolean }

export const PAGE_ROUTES: Record<string, string> = { home: "/", projects: "/projects", failures: "/failures", devlog: "/devlog", about: "/about", entry: "/devlog" };
export const PAGE_NAMES: Record<string, string> = { home: "Home", projects: "Projects", failures: "Failures", devlog: "Devlog page", entry: "Devlog entry layout", about: "About" };

/** Section list editor: reused by pages and by build pages. */
export function SectionsEditor({ sections, onChange }: { sections: Section[]; onChange: (s: Section[]) => void }) {
  const [open, setOpen] = useState<string | null>(sections[0]?.sectionId ?? null);
  const move = (i: number, d: number) => { const a = [...sections]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x!); onChange(a); };
  return (
    <ol class="sections">
      {sections.map((s, i) => {
        const m = getModule(s.moduleId);
        const isOpen = open === s.sectionId;
        return (
          <li class={`section ${s.hidden ? "is-hidden" : ""}`} key={s.sectionId}>
            <div class="section-bar">
              <button type="button" class="section-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.sectionId)}>
                <span class="num">{i + 1}</span> {m?.name ?? s.moduleId}{s.hidden ? " (hidden)" : ""}
              </button>
              <span class="section-actions">
                <button type="button" class="mini" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${m?.name} up`}>Move up</button>
                <button type="button" class="mini" disabled={i === sections.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${m?.name} down`}>Move down</button>
                <button type="button" class="mini" onClick={() => onChange(sections.map((x, k) => (k === i ? { ...x, hidden: !x.hidden } : x)))}>{s.hidden ? "Show" : "Hide"}</button>
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
  );
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

export function PageEditor({ page, onPublished }: { page: PageRec; onPublished: () => void }) {
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
  return (
    <div class="split">
      <div class="editor" onFocusOut={() => void a.flush()}>
        <header class="ed-head"><h1>{PAGE_NAMES[page.id] ?? page.id}</h1></header>
        <StatusBar status={a.status} savedAt={a.savedAt} error={a.error} problems={problems} onPublish={publish} publishing={publishing} dirty={dirty} />
        <TextPanel sections={panelSections(a.value, a.setValue)} />
        <ImagesPanel sections={panelSections(a.value, a.setValue)} />
        <h2 class="ed-sub">Sections</h2>
        <SectionsEditor sections={a.value} onChange={a.setValue} />
        <Versions ownerType="page" ownerId={page.id} onRestored={reload} refreshKey={reloadKey} />
      </div>
      <Preview route={PAGE_ROUTES[page.id] ?? "/"} reloadKey={reloadKey} />
    </div>
  );
}
