import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { buildFields, type BuildMeta } from "../core/build-fields";
import { walk, type Fields, type ImageValue, type TextValue } from "../core/fields";
import type { Section } from "../core/module";
import { api, isApiError } from "./api";
import { useAutosave, type Problem } from "./autosave";
import { useDragList } from "./drag";
import { FieldsForm } from "./Fields";
import { SectionsEditor, changedTexts, findField, panelSections, type FocusReq } from "./PageEditor";
import { ExportButton, ImportProject, PackHelp } from "./ProjectPack";
import { ImagesPanel, Preview, StatusBar, TextPanel, Versions, type LiveSend, type PickMsg } from "./parts";
import { ago, useAdmin } from "./state";

export interface BuildRec { id: string; slug: string; meta: BuildMeta; sections: Section[]; templateId: string; templateVer: number; updatedAt: number; publishedAt: number | null; dirty: boolean }
export interface TemplateRow { id: string; version: number; name: string; sections_json: string; created_at: number; used: number }

const FAILURE_KEYS = ["whatBroke", "whatLearned", "failedOn", "lessonUrl", "tileImage"];
const FLOOR_KEYS = ["homeOrder", "floorImage", "floorNudgeX", "floorNudgeY"];
const STATUS = { in_progress: "In progress", bench: "On the bench", finished: "Finished", failed: "Failed" } as Record<string, string>;

function pick(keys: (k: string) => boolean): Fields {
  return Object.fromEntries(Object.entries(buildFields).filter(([k]) => keys(k))) as Fields;
}

export function BuildsList({ builds, templates, onOpen, onChanged }: { builds: BuildRec[]; templates: TemplateRow[]; onOpen: (id: string) => void; onChanged: () => void }) {
  const [title, setTitle] = useState("");
  const [tpl, setTpl] = useState("build-default");
  const [err, setErr] = useState("");
  const tplIds = [...new Set(templates.map((t) => t.id))];
  const create = async (e: Event) => {
    e.preventDefault();
    try {
      const r = await api<{ id: string }>("POST", "builds", { title: title.trim(), templateId: tpl });
      setTitle("");
      await onChanged();
      onOpen(r.id);
    } catch (x) { setErr(isApiError(x) ? x.error : "Could not create"); }
  };
  return (
    <div class="page-pad">
      <h1>Builds</h1>
      <form class="create" onSubmit={create}>
        <label for="nb">New build name</label>
        <input id="nb" value={title} maxLength={40} required onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        <label for="nt">Template</label>
        <select id="nt" value={tpl} onChange={(e) => setTpl((e.target as HTMLSelectElement).value)}>{tplIds.map((t) => <option value={t}>{t}</option>)}</select>
        <button type="submit" class="primary">Create from template</button>
        {err && <p class="warn">{err}</p>}
      </form>
      <ImportProject builds={builds} onOpen={onOpen} onChanged={onChanged} />
      <PackHelp />
      {builds.length === 0 && <div class="empty"><p><strong>No builds yet.</strong></p><p class="muted">Type a name above and press "Create from template", or import a project pack.</p></div>}
      {builds.length > 0 && <table class="table">
        <thead><tr><th>Build</th><th>Status</th><th>Type</th><th>Home</th><th>State</th><th>Edited</th></tr></thead>
        <tbody>
          {builds.map((b) => (
            <tr>
              <td><button type="button" class="linkish" onClick={() => onOpen(b.id)}>{b.meta.title.value}</button><div class="muted small">/builds/{b.slug}</div></td>
              <td>{STATUS[b.meta.status]}</td>
              <td>{b.meta.kind}</td>
              <td>{b.meta.featured ? `Stop ${b.meta.homeOrder}` : ""}</td>
              <td>{!b.publishedAt ? "Not published" : b.dirty ? "Unpublished changes" : "Live"}</td>
              <td class="muted">{ago(b.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>}
    </div>
  );
}

/** Meta fields (title, summary, images…) live outside the sections: match a click in the preview against them. */
function findMetaPath(meta: BuildMeta, msg: PickMsg): string | null {
  const slots = walk(buildFields, meta);
  if (msg.image) {
    return slots.find((x) => x.field.kind === "image" && msg.mediaKey && (x.value as ImageValue | undefined)?.key === msg.mediaKey)?.path ?? null;
  }
  const norm = (v: string) => v.replace(/\s+/g, " ").trim().toLowerCase();
  const want = norm(msg.text);
  if (!want) return null;
  const texts = slots.filter((x) => x.field.kind === "text").map((x) => ({ path: x.path, v: norm((x.value as TextValue | undefined)?.value ?? "") })).filter((x) => x.v);
  return texts.find((x) => x.v === want)?.path ?? null;
}

function changedMeta(prev: BuildMeta, next: BuildMeta): { old: string; next: string }[] {
  const before = new Map(walk(buildFields, prev).filter((x) => x.field.kind === "text").map((x) => [x.path, (x.value as TextValue | undefined)?.value ?? ""]));
  const out: { old: string; next: string }[] = [];
  for (const x of walk(buildFields, next)) {
    if (x.field.kind !== "text") continue;
    const v = (x.value as TextValue | undefined)?.value ?? "";
    const o = before.get(x.path);
    if (o !== undefined && o !== v && o.trim()) out.push({ old: o, next: v });
  }
  return out;
}

export function BuildEditor({ build, onBack, onChanged, focusSection }: { build: BuildRec; onBack: () => void; onChanged: () => void; focusSection?: string | null }) {
  const { toast } = useAdmin();
  const [reloadKey, setReloadKey] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(!!build.publishedAt);
  const [dirty, setDirty] = useState(build.dirty);
  const [serverProblems, setServerProblems] = useState<Problem[]>([]);
  const [upgrade, setUpgrade] = useState<null | { from: number; to: number; added: string[]; removed: string[]; migrated: string[] }>(null);
  type Doc = { slug: string; meta: BuildMeta; sections: Section[] };
  const a = useAutosave<Doc>({ slug: build.slug, meta: build.meta, sections: build.sections }, build.updatedAt, async (doc, updatedAt, keepalive) => {
    const r = await api<{ updatedAt: number; problems: Problem[] }>("PATCH", `builds/${build.id}`, { doc, updatedAt }, { keepalive });
    setReloadKey((k) => k + 1);
    setDirty(true);
    return r;
  });
  const doc = a.value;
  const failed = doc.meta.status === "failed";
  const featured = doc.meta.featured;
  const mainFields = pick((k) => !FAILURE_KEYS.includes(k) && !FLOOR_KEYS.includes(k));
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await a.flush(); await fn(); toast(ok); onChanged(); } catch (e) { if (isApiError(e)) { setServerProblems(e.problems ?? []); toast(e.error); } }
  };
  const publish = async () => { setPublishing(true); await run(async () => { await api("POST", `builds/${build.id}/publish`, {}); setPublished(true); setDirty(false); setServerProblems([]); }, "Build is live."); setPublishing(false); };
  const unpublish = () => run(async () => { await api("POST", `builds/${build.id}/unpublish`, {}); setPublished(false); }, "Build taken offline.");
  const del = async () => { if (!confirm(`Delete "${doc.meta.title.value}"? It disappears from the site. Versions are kept.`)) return; await run(() => api("DELETE", `builds/${build.id}`), "Build deleted."); onBack(); };
  const checkUpgrade = async () => setUpgrade(await api("POST", `builds/${build.id}/upgrade`, { apply: false }));
  const applyUpgrade = async () => { await api("POST", `builds/${build.id}/upgrade`, { apply: true }); location.reload(); };
  const reload = async () => { const b = await api<BuildRec>("GET", `builds/${build.id}`); a.reset({ slug: b.slug, meta: b.meta, sections: b.sections }, b.updatedAt); setDirty(true); setReloadKey((k) => k + 1); };
  const live = useRef<LiveSend | null>(null);
  const [focus, setFocus] = useState<FocusReq | null>(null);
  useEffect(() => { if (focusSection) setFocus({ sectionId: focusSection, path: null, n: Date.now() }); }, [focusSection]);
  const docRef = useRef(doc);
  docRef.current = doc;
  const edit = (next: Doc) => {
    for (const c of changedTexts(docRef.current.sections, next.sections)) live.current?.(c.section, c.old, c.next);
    for (const c of changedMeta(docRef.current.meta, next.meta)) live.current?.("", c.old, c.next);
    a.setValue(next);
  };
  const setMeta = (m: Record<string, unknown>) => edit({ ...docRef.current, meta: m as BuildMeta });
  const setSections = (s: Section[]) => edit({ ...docRef.current, sections: s });
  const editor = useRef<HTMLDivElement>(null);
  const onPick = useCallback((m: PickMsg) => {
    const hit = findField(docRef.current.sections, m);
    if (hit?.path) { setFocus(hit); return; }
    const mp = findMetaPath(docRef.current.meta, m);
    if (mp) {
      const el = editor.current?.querySelector<HTMLElement>(`[data-field-path="meta.${CSS.escape(mp)}"]`);
      if (el) {
        // The floor/failure groups only show for some builds; if the field is on screen, scroll to it and focus it.
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
        el.querySelector<HTMLElement>("input, textarea, select, button")?.focus({ preventScroll: true });
        return;
      }
    }
    if (hit) setFocus(hit);
  }, []);
  const problems = a.problems.length ? a.problems : serverProblems;
  return (
    <div class="split">
      <div class="editor" ref={editor} onFocusOut={() => void a.flush()}>
        <header class="ed-head">
          <button type="button" class="linkish" onClick={onBack}>All builds</button>
          <h1>{doc.meta.title.value || "Untitled build"}</h1>
        </header>
        <StatusBar status={a.status} savedAt={a.savedAt} error={a.error} problems={problems} onPublish={publish} publishing={publishing} dirty={dirty || !published}
          extra={<>{published && <button type="button" onClick={unpublish}>Take offline</button>}<button type="button" class="danger" onClick={del}>Delete</button></>} />
        <div class="field">
          <label for="slug">Web address: /builds/<strong>{doc.slug}</strong></label>
          <input id="slug" value={doc.slug} onInput={(e) => a.setValue({ ...doc, slug: (e.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
        </div>
        <FieldsForm fields={mainFields} value={doc.meta as unknown as Record<string, unknown>} onChange={setMeta} path="meta" />
        {featured && (
          <fieldset class="group"><legend>Home floor</legend>
            <p class="muted small">Order and nudges are numbers: no dragging. Positions are scattered automatically; nudge moves this stop.</p>
            <FieldsForm fields={pick((k) => FLOOR_KEYS.includes(k))} value={doc.meta as unknown as Record<string, unknown>} onChange={setMeta} path="meta" />
          </fieldset>
        )}
        {failed && (
          <fieldset class="group"><legend>Failure (shown on Failures and in the selector)</legend>
            <FieldsForm fields={pick((k) => FAILURE_KEYS.includes(k))} value={doc.meta as unknown as Record<string, unknown>} onChange={setMeta} path="meta" />
          </fieldset>
        )}
        <TextPanel sections={panelSections(doc.sections, setSections)} />
        <ImagesPanel sections={panelSections(doc.sections, setSections)} />
        <h2 class="ed-sub">Page sections <span class="muted small">template {build.templateId} v{build.templateVer}</span></h2>
        <SectionsEditor sections={doc.sections} onChange={setSections} focus={focus} />
        <div class="row-actions">
          <button type="button" onClick={checkUpgrade}>Check for a newer template</button>
          <ExportButton getDoc={async () => { await a.flush(); return a.value; }} />
        </div>
        {upgrade && (
          <div class="notice">
            {upgrade.to === upgrade.from && !upgrade.added.length && !upgrade.removed.length ? <p>Already on the latest template (v{upgrade.to}).</p> : (
              <>
                <p>Upgrade v{upgrade.from} to v{upgrade.to}:</p>
                <ul>
                  {upgrade.added.map((m) => <li>Adds section: {m} (with its defaults)</li>)}
                  {upgrade.removed.map((m) => <li class="warn">Removes section: {m}</li>)}
                  {upgrade.migrated.map((m) => <li>Updates section: {m}</li>)}
                </ul>
                <button type="button" class="primary" onClick={applyUpgrade}>Upgrade this build</button>
              </>
            )}
          </div>
        )}
        <Versions ownerType="build" ownerId={build.id} onRestored={reload} refreshKey={reloadKey} />
      </div>
      <Preview route={`/builds/${build.slug}`} reloadKey={reloadKey} onPick={onPick} liveRef={live} />
    </div>
  );
}

interface PendingRow { id: string; title: string; wasFeatured: boolean; featured: boolean; wasOrder: number; order: number }

export function HomePlacement({ builds, onOpen, onChanged }: { builds: BuildRec[]; onOpen: (id: string) => void; onChanged: () => void }) {
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
