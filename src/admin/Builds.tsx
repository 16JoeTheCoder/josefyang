import { useState } from "preact/hooks";
import { buildFields, type BuildMeta } from "../core/build-fields";
import type { Fields } from "../core/fields";
import type { Section } from "../core/module";
import { api, isApiError } from "./api";
import { useAutosave, type Problem } from "./autosave";
import { FieldsForm } from "./Fields";
import { SectionsEditor, panelSections } from "./PageEditor";
import { ImagesPanel, Preview, StatusBar, TextPanel, Versions } from "./parts";
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
      <table class="table">
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
      </table>
    </div>
  );
}

export function BuildEditor({ build, onBack, onChanged }: { build: BuildRec; onBack: () => void; onChanged: () => void }) {
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
  const reload = async () => { const b = await api<BuildRec>("GET", `builds/${build.id}`); a.reset({ slug: b.slug, meta: b.meta, sections: b.sections }, b.updatedAt); setReloadKey((k) => k + 1); };
  const setMeta = (m: Record<string, unknown>) => a.setValue({ ...doc, meta: m as BuildMeta });
  const problems = a.problems.length ? a.problems : serverProblems;
  return (
    <div class="split">
      <div class="editor" onFocusOut={() => void a.flush()}>
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
        <TextPanel sections={panelSections(doc.sections, (s) => a.setValue({ ...doc, sections: s }))} />
        <ImagesPanel sections={panelSections(doc.sections, (s) => a.setValue({ ...doc, sections: s }))} />
        <h2 class="ed-sub">Page sections <span class="muted small">template {build.templateId} v{build.templateVer}</span></h2>
        <SectionsEditor sections={doc.sections} onChange={(s) => a.setValue({ ...doc, sections: s })} />
        <div class="row-actions">
          <button type="button" onClick={checkUpgrade}>Check for a newer template</button>
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
      <Preview route={`/builds/${build.slug}`} reloadKey={reloadKey} />
    </div>
  );
}

export function HomePlacement({ builds, onOpen, onChanged }: { builds: BuildRec[]; onOpen: (id: string) => void; onChanged: () => void }) {
  const { toast } = useAdmin();
  const featured = builds.filter((b) => b.meta.featured).sort((x, y) => x.meta.homeOrder - y.meta.homeOrder);
  const [busy, setBusy] = useState(false);
  const save = async (list: BuildRec[]) => {
    setBusy(true);
    try {
      for (const [i, b] of list.entries()) {
        if (b.meta.homeOrder === i + 1) continue;
        await api("PATCH", `builds/${b.id}`, { doc: { slug: b.slug, meta: { ...b.meta, homeOrder: i + 1 }, sections: b.sections }, updatedAt: b.updatedAt });
      }
      toast("Order saved to the drafts. Publish each build to make it live.");
      onChanged();
    } catch (e) { toast(isApiError(e) ? e.error : "Could not save"); } finally { setBusy(false); }
  };
  const move = (i: number, d: number) => { const a = [...featured]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x!); void save(a); };
  return (
    <div class="split">
      <div class="editor">
        <h1>Home placement</h1>
        <p class="muted">Featured builds only. Turn "Featured on the Home floor" on in a build to add it. Order by Move up / Move down; nudges are in each build.</p>
        {featured.length === 0 ? <p>No featured builds yet.</p> : (
          <ol class="sections">
            {featured.map((b, i) => (
              <li class="section"><div class="section-bar">
                <button type="button" class="section-toggle" onClick={() => onOpen(b.id)}><span class="num">{i + 1}</span> {b.meta.title.value}{b.dirty ? " (unpublished changes)" : ""}</button>
                <span class="section-actions">
                  <button type="button" class="mini" disabled={busy || i === 0} onClick={() => move(i, -1)}>Move up</button>
                  <button type="button" class="mini" disabled={busy || i === featured.length - 1} onClick={() => move(i, 1)}>Move down</button>
                </span>
              </div></li>
            ))}
          </ol>
        )}
      </div>
      <Preview route="/" reloadKey={featured.reduce((n, b) => n + b.updatedAt, 0) % 100000} />
    </div>
  );
}
