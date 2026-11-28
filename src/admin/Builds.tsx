import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { buildFields, type BuildMeta } from "../core/build-fields";
import { f, walk, type Fields, type TextValue } from "../core/fields";
import type { Section } from "../core/module";
import { api, isApiError } from "./api";
import { useAutosave, type Problem } from "./autosave";
import { useDragList } from "./drag";
import { getModule } from "../core/registry";
import { FieldInspector, SectionLayers, changedTexts, findField, type FocusReq } from "./PageEditor";
import { ExportButton, ImportProject, PackHelp } from "./ProjectPack";
import { Preview, StatusBar, Versions, setAtPath, type LiveSend, type PickMsg } from "./parts";
import { ago, useAdmin } from "./state";

export interface BuildRec { id: string; slug: string; meta: BuildMeta; sections: Section[]; templateId: string; templateVer: number; updatedAt: number; publishedAt: number | null; dirty: boolean }
export interface TemplateRow { id: string; version: number; name: string; sections_json: string; created_at: number; used: number }

const FAILURE_KEYS = ["whatBroke", "whatLearned", "failedOn", "lessonUrl", "tileImage", "failureEvidence", "failureChange"];
const FLOOR_KEYS = ["homeOrder", "floorImage", "floorNudgeX", "floorNudgeY"];
const STATUS = { in_progress: "In progress", bench: "On the bench", finished: "Finished", failed: "Failed" } as Record<string, string>;

function pick(keys: (k: string) => boolean): Fields {
  return Object.fromEntries(Object.entries(buildFields).filter(([k]) => keys(k))) as Fields;
}

export function BuildsList({ builds, templates, onOpen, onChanged }: { builds: BuildRec[]; templates: TemplateRow[]; onOpen: (id: string) => void; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [tpl, setTpl] = useState(templates.find((item) => item.id === "build-default")?.id ?? templates[0]?.id ?? "build-default");
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("");
  const [kind, setKind] = useState("");
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const choices = [...new Map(templates.map(({ id, name }) => [id, name])).entries()];
  const publication = (b: BuildRec) => b.publishedAt === null ? "draft" : b.dirty ? "changes" : "live";
  const filtered = builds.filter((b) => (
    (!state || publication(b) === state) &&
    (!kind || b.meta.kind === kind) &&
    `${b.meta.title.value} ${b.slug}`.toLowerCase().includes(query.trim().toLowerCase())
  ));
  const create = async (e: Event) => {
    e.preventDefault();
    if (creating || !title.trim()) return;
    setErr("");
    setCreating(true);
    try {
      const r = await api<{ id: string }>("POST", "builds", { title: title.trim(), templateId: tpl });
      setTitle("");
      await onChanged();
      onOpen(r.id);
    } catch (x) { setErr(isApiError(x) ? x.error : "Could not create the project."); }
    finally { setCreating(false); }
  };
  return (
    <div class="page-pad project-library">
      <header class="project-library-heading">
        <div><h1>Projects</h1><p class="muted">Manage project pages, featured images and drafts.</p></div>
        <button type="button" class="primary" aria-expanded={formOpen} onClick={() => setFormOpen(!formOpen)}>{formOpen ? "Cancel" : "New project"}</button>
      </header>
      {formOpen && <form class="create" onSubmit={create}>
        <label for="nb">New build name</label>
        <input id="nb" value={title} maxLength={40} required onInput={(e) => setTitle(e.currentTarget.value)} />
        <label for="nt">Template</label>
        <select id="nt" value={tpl} onChange={(e) => setTpl(e.currentTarget.value)}>{choices.map(([id, name]) => <option key={id} value={id}>{name || id}</option>)}</select>
        <button type="submit" class="primary" disabled={creating || !title.trim()}>{creating ? "Creating…" : "Create project"}</button>
        {err && <p class="warn" role="alert">{err}</p>}
      </form>}
      <details class="project-import"><summary>Import a project pack</summary><ImportProject builds={builds} onOpen={onOpen} onChanged={onChanged} /><PackHelp /></details>
      <div class="project-library-filters" role="group" aria-label="Filter projects">
        <label>Search projects<input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} /></label>
        <label>Publication<select value={state} onChange={(e) => setState(e.currentTarget.value)}><option value="">Any state</option><option value="draft">Draft</option><option value="changes">Unpublished changes</option><option value="live">Live</option></select></label>
        <label>Project type<select value={kind} onChange={(e) => setKind(e.currentTarget.value)}><option value="">Any type</option><option value="hardware">Hardware</option><option value="software">Software</option></select></label>
      </div>
      {filtered.length === 0 && <div class="empty"><p><strong>{builds.length ? "No matching projects." : "No projects yet."}</strong></p><p class="muted">{builds.length ? "Change the search or filters to see more projects." : "Create a project or import a project pack."}</p></div>}
      {filtered.length > 0 && <div class="project-library-table"><table class="table">
        <thead><tr><th>Project</th><th>Build status</th><th>Type</th><th>Home</th><th>Publication</th><th>Edited</th></tr></thead>
        <tbody>
          {filtered.map((b) => (
            <tr key={b.id}>
              <td><button type="button" class="linkish" onClick={() => onOpen(b.id)}>{b.meta.title.value}</button><div class="muted small">/builds/{b.slug}</div></td>
              <td>{STATUS[b.meta.status]}</td>
              <td>{b.meta.kind}</td>
              <td>{b.meta.featured ? `Stop ${b.meta.homeOrder}` : ""}</td>
              <td>{publication(b) === "draft" ? "Draft" : b.dirty ? "Unpublished changes" : "Live"}</td>
              <td class="muted">{ago(b.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>}
    </div>
  );
}


export function BuildEditor({ build, onBack, onChanged, focusSection }: { build: BuildRec; onBack: () => void; onChanged: () => Promise<void>; focusSection?: string | null }) {
  const { toast } = useAdmin();
  const [reloadKey, setReloadKey] = useState(0);
  const [previewSlug, setPreviewSlug] = useState(build.slug);
  const [published, setPublished] = useState(build.publishedAt !== null);
  const [dirty, setDirty] = useState(build.dirty);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [pane, setPane] = useState<"properties" | "sections" | "history" | "actions">("properties");
  const [editing, setEditing] = useState(true);
  const [focus, setFocus] = useState<FocusReq | null>(null);
  const [request, setRequest] = useState(0);
  const [upgrade, setUpgrade] = useState<{ from: number; to: number; added: string[]; removed: string[]; migrated: string[] } | null>(null);
  const live = useRef<LiveSend | null>(null);
  const path = `builds/${build.id}`;
  const toDoc = ({ slug, meta, sections }: BuildRec) => ({ slug, meta, sections });
  const a = useAutosave(toDoc(build), build.updatedAt, async (doc, updatedAt, keepalive) => {
    const saved = await api<{ updatedAt: number; problems: Problem[] }>("PATCH", path, { doc, updatedAt }, { keepalive });
    setPreviewSlug(doc.slug);
    setReloadKey((key) => key + 1);
    return saved;
  });
  const doc = a.value;
  const current = useRef(doc);
  current.current = doc;
  const selected = doc.sections.find((item) => item.sectionId === focus?.sectionId);
  const module = selected && getModule(selected.moduleId);
  const metadata = { ...doc.meta, slug: { value: doc.slug } };
  const metaFields = {
    slug: f.label("Web address slug", { max: 72, maxLines: 1 }),
    ...pick((key) => (!FAILURE_KEYS.includes(key) || doc.meta.status === "failed") && (!FLOOR_KEYS.includes(key) || doc.meta.featured)),
  };

  function choose(sectionId: string, field: string | null, jump = false) {
    setFocus({ sectionId, path: field, n: performance.now() });
    setEditing(true);
    setPane("properties");
    if (jump) setRequest((value) => value + 1);
  }

  useEffect(() => { if (focusSection) choose(focusSection, null, true); }, [focusSection]);

  const onPick = useCallback((msg: PickMsg) => {
    if (msg.section === "build-meta") { choose("build-meta", msg.path ?? null); return; }
    const match = findField(current.current.sections, msg);
    if (match) choose(match.sectionId, match.path);
  }, []);

  function edit(next: typeof doc) {
    for (const item of changedTexts(current.current.sections, next.sections)) live.current?.(item.section, item.old, item.next, item.path);
    current.current = next;
    setDirty(true);
    setProblems([]);
    a.setValue(next);
  }

  function changeMeta(field: string, value: unknown) {
    if (field === "slug") {
      const slug = (value as TextValue).value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
      edit({ ...current.current, slug });
      return;
    }
    const meta = setAtPath(current.current.meta, field, value);
    const slot = walk(buildFields, current.current.meta).find((item) => item.path === field);
    if (slot?.field.kind === "text") {
      live.current?.("build-meta", (slot.value as TextValue | undefined)?.value ?? "", (value as TextValue).value, field);
    }
    edit({ ...current.current, meta });
  }

  async function run(action: () => Promise<void>, message?: string) {
    setBusy(true);
    try {
      await a.flush();
      if (a.isDirty()) return false;
      await action();
      setProblems([]);
      if (message) toast(message);
      return true;
    } catch (error) {
      if (isApiError(error)) setProblems(error.problems ?? []);
      toast(isApiError(error) ? error.error : "Could not finish this action.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const restored = await api<BuildRec>("GET", path);
    a.reset(toDoc(restored), restored.updatedAt);
    setDirty(restored.dirty);
    setPublished(restored.publishedAt !== null);
    setPreviewSlug(restored.slug);
    setReloadKey((key) => key + 1);
  }

  const showInspector = (next: typeof pane) => setPane(pane === next ? "properties" : next);
  const close = () => setPane("properties");
  const changeSections = (sections: Section[]) => edit({ ...current.current, sections });

  return <section class="visual-workspace" aria-label="Project editor">
    <header class="visual-workspace-toolbar">
      <div class="project-editor-identity"><button type="button" class="linkish" onClick={onBack}>All projects</button><h1>{doc.meta.title.value || "Untitled project"}</h1></div>
      <div class="visual-workspace-actions">
        <button type="button" aria-pressed={pane === "properties" && focus?.sectionId === "build-meta"} onClick={() => choose("build-meta", null)}>Details</button>
        <button type="button" aria-pressed={pane === "sections"} onClick={() => showInspector("sections")}>Sections</button>
        <button type="button" aria-pressed={pane === "history"} onClick={() => showInspector("history")}>History</button>
        <button type="button" aria-pressed={!editing} onClick={() => setEditing(!editing)}>{editing ? "Preview interactions" : "Back to editing"}</button>
        <button type="button" aria-pressed={pane === "actions"} onClick={() => showInspector("actions")}>Actions</button>
      </div>
      <StatusBar status={a.status} savedAt={a.savedAt} error={a.error} problems={a.problems.length ? a.problems : problems}
        onPublish={() => void run(async () => { await api("POST", path + "/publish", {}); setPublished(true); setDirty(a.isDirty()); await onChanged(); }, "Project is live.")}
        publishing={busy} dirty={dirty || !published}
        extra={<button type="button" onClick={() => void a.flush().catch(() => {})} disabled={a.status === "saving" || !a.isDirty()}>Save draft</button>} />
    </header>
    <div class="visual-workspace-body">
      <Preview route={`/builds/${previewSlug}`} reloadKey={reloadKey} editMode={editing} onPick={onPick} liveRef={live}
        selection={focus ? { section: focus.sectionId, path: focus.path } : null} selectionRequest={request} />
      <aside class="visual-inspector" aria-label={pane === "properties" ? "Selected properties" : `Project ${pane}`}>
        {pane === "sections" ? <>
          <div class="visual-inspector-heading"><h2>Sections</h2><button type="button" class="mini" onClick={close}>Close</button></div>
          <SectionLayers sections={doc.sections} onChange={changeSections} onSelect={(id) => choose(id, null, true)} />
        </> : pane === "history" ? <>
          <div class="visual-inspector-heading"><h2>History</h2><button type="button" class="mini" onClick={close}>Close</button></div>
          <div class="visual-inspector-content"><Versions ownerType="build" ownerId={build.id} beforeRestore={a.flush} onRestored={refresh} refreshKey={reloadKey} expanded /></div>
        </> : pane === "actions" ? <>
          <div class="visual-inspector-heading"><h2>Actions</h2><button type="button" class="mini" onClick={close}>Close</button></div>
          <div class="visual-inspector-content project-more">
            <ExportButton getDoc={async () => { await a.flush(); return current.current; }} />
            <button type="button" disabled={busy} onClick={() => void run(async () => setUpgrade(await api("POST", path + "/upgrade", { apply: false })))}>Check template update</button>
            {upgrade && <div class="notice">
              <p>{upgrade.from === upgrade.to ? "Project uses the latest template." : `Template update v${upgrade.from} to v${upgrade.to}`}</p>
              {upgrade.from !== upgrade.to && <><ul>{upgrade.added.map((name) => <li>Adds {name}</li>)}{upgrade.removed.map((name) => <li>Removes {name}</li>)}{upgrade.migrated.map((name) => <li>Updates {name}</li>)}</ul>
                <button type="button" disabled={busy} onClick={() => void run(async () => { await api("POST", path + "/upgrade", { apply: true }); setUpgrade(null); await refresh(); await onChanged(); }, "Template updated.")}>Apply update</button></>}
            </div>}
            {published && <button type="button" disabled={busy} onClick={() => void run(async () => { await api("POST", path + "/unpublish", {}); setPublished(false); await onChanged(); }, "Project taken offline.")}>Take offline</button>}
            <button type="button" disabled={busy} class="danger" onClick={async () => {
              if (confirm(`Delete "${current.current.meta.title.value}"? This removes it from the site.`) &&
                await run(async () => { await api("DELETE", path); await onChanged(); }, "Project deleted.")) onBack();
            }}>Delete project</button>
          </div>
        </> : focus?.sectionId === "build-meta" ? (
          <FieldInspector title="Project details" fields={metaFields} content={metadata} focus={focus} onPick={(field) => choose("build-meta", field, true)} onChange={changeMeta} onClose={() => setFocus(null)} />
        ) : focus && selected && module ? (
          <FieldInspector title={module.name} fields={module.fields} content={selected.content} focus={focus} onPick={(field) => choose(selected.sectionId, field, true)} onClose={() => setFocus(null)}
            onChange={(field, value) => changeSections(current.current.sections.map((item) => item.sectionId === selected.sectionId ? { ...item, content: setAtPath(item.content, field, value) } : item))} />
        ) : <>
          <div class="visual-inspector-heading"><h2>Properties</h2></div>
          <div class="visual-inspector-content visual-inspector-empty">
            <p>{editing ? "Select an element in the preview to edit it here." : "Return to editing to select elements in the preview."}</p>
            <button type="button" onClick={() => choose("build-meta", "selectorImage")}>Add a project image</button>
            <button type="button" onClick={() => choose("build-meta", null)}>Open project details</button>
          </div>
        </>}
      </aside>
    </div>
  </section>;
}

interface PendingRow { id: string; title: string; wasFeatured: boolean; featured: boolean; wasOrder: number; order: number }

export function HomePlacement({ builds, onOpen, onChanged }: { builds: BuildRec[]; onOpen: (id: string) => void; onChanged: () => Promise<void> }) {
  const { toast } = useAdmin();
  const featured = builds.filter((b) => b.meta.featured).sort((x, y) => x.meta.homeOrder - y.meta.homeOrder);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [reload, setReload] = useState(0);
  // Edits made in a build editor do not refresh the app's copy, so fetch fresh drafts before anything here saves.
  useEffect(() => { void onChanged(); }, []);
  const sig = builds.map((b) => `${b.id}${b.updatedAt}`).join();
  useEffect(() => { void api<{ pending: PendingRow[] }>("GET", "placement/status").then((r) => setPending(r.pending), () => setPending([])); }, [sig, reload]);
  const save = async (list: BuildRec[]) => {
    setBusy(true);
    try {
      for (const [i, b] of list.entries()) {
        if (b.meta.homeOrder === i + 1) continue;
        await api("PATCH", `builds/${b.id}`, { doc: { slug: b.slug, meta: { ...b.meta, homeOrder: i + 1 }, sections: b.sections }, updatedAt: b.updatedAt });
      }
      toast("Order saved as a draft. Press Publish order to put it live.");
      await onChanged();
    } catch (e) { toast(isApiError(e) ? e.error : "Could not save"); } finally { setBusy(false); }
  };
  const move = (i: number, d: number) => { const a = [...featured]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x!); void save(a); };
  const publishOrder = async () => {
    setBusy(true);
    try {
      const r = await api<{ published: number }>("POST", "placement/publish", {});
      toast(r.published ? `Home order is live (${r.published} build${r.published === 1 ? "" : "s"} updated).` : "Nothing to publish.");
      setReload((n) => n + 1);
      await onChanged();
    } catch (e) { toast(isApiError(e) ? e.error : "Could not publish the order"); } finally { setBusy(false); }
  };
  const { listRef, drag, down, shift } = useDragList((from, to) => move(from, to - from));
  const unpublishedOnly = featured.filter((b) => !b.publishedAt);
  return (
    <div class="split">
      <div class="editor">
        <h1>Home placement</h1>
        <p class="muted">Drag a row (or use Move up / Move down) to set the order of the Home floor, then press Publish order. Turn "Featured on the Home floor" on inside a build to add it.</p>
        <div class="statusbar placement-bar">
          <span class="status" role="status">{pending.length ? `${pending.length} build${pending.length === 1 ? " has" : "s have"} a Home change that is not live yet` : "Home order is live"}</span>
          <button type="button" class="primary" disabled={busy || pending.length === 0} onClick={publishOrder}>Publish order</button>
        </div>
        {featured.length === 0 ? <div class="empty"><p><strong>Nothing on the Home floor yet.</strong></p><p class="muted">Open a build and switch on "Featured on the Home floor".</p></div> : (
          <ol class={`sections ${drag ? "is-dragging" : ""}`} ref={listRef}>
            {featured.map((b, i) => (
              <li class={`section ${drag?.from === i ? "is-lifted" : ""}`} key={b.id} style={shift(i)}><div class="section-bar">
                <span class="drag-handle" onPointerDown={down(i)} title="Drag to reorder" aria-hidden="true"><span></span><span></span><span></span></span>
                <button type="button" class="section-toggle" onClick={() => onOpen(b.id)}><span class="num">{i + 1}</span> {b.meta.title.value}{!b.publishedAt ? " (not published)" : ""}</button>
                <span class="section-actions">
                  <button type="button" class="mini" disabled={busy || i === 0} onClick={() => move(i, -1)}>Move up</button>
                  <button type="button" class="mini" disabled={busy || i === featured.length - 1} onClick={() => move(i, 1)}>Move down</button>
                </span>
              </div></li>
            ))}
          </ol>
        )}
        {unpublishedOnly.length > 0 && <p class="muted small">{unpublishedOnly.map((b) => b.meta.title.value).join(", ")} {unpublishedOnly.length === 1 ? "is" : "are"} not published yet, so {unpublishedOnly.length === 1 ? "it" : "they"} will not appear on Home until you publish {unpublishedOnly.length === 1 ? "it" : "them"}.</p>}
      </div>
      <Preview route="/" reloadKey={reload + (featured.reduce((n, b) => n + b.updatedAt, 0) % 100000)} />
    </div>
  );
}
