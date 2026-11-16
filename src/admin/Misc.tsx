/** Milestones, templates, settings, health. */
import { useEffect, useState } from "preact/hooks";
import type { Fields } from "../core/fields";
import { settingsFields, type SettingsKey } from "../core/settings";
import { api, isApiError } from "./api";
import { useAutosave, type Problem } from "./autosave";
import type { TemplateRow } from "./Builds";
import { FieldsForm } from "./Fields";
import { Preview, StatusBar, Versions } from "./parts";
import { useAdmin } from "./state";

/* ---------- milestones ---------- */

export interface MilestoneRow { id: string; date: string; label: string; title: string; body: string | null; status: string }

/** One editable milestone row. Lives outside Milestones so typing never remounts it. */
function MilestoneForm({ m, onSave, onDelete }: { m: MilestoneRow; onSave: (v: MilestoneRow) => void; onDelete: (id: string) => void }) {
  const [v, setV] = useState<MilestoneRow>(m);
  const set = (p: Partial<MilestoneRow>) => setV({ ...v, ...p });
  return (
    <form class="ms-row" onSubmit={(e) => { e.preventDefault(); onSave(v); if (!m.id) setV(m); }}>
      <label>Date (sorts)<input value={v.date} placeholder="YYYY-MM" required onInput={(e) => set({ date: (e.target as HTMLInputElement).value })} /></label>
      <label>Label<input value={v.label} maxLength={20} placeholder="IGCSE" onInput={(e) => set({ label: (e.target as HTMLInputElement).value })} /></label>
      <label>Title<input value={v.title} maxLength={60} required onInput={(e) => set({ title: (e.target as HTMLInputElement).value })} /></label>
      <label>Line<input value={v.body ?? ""} maxLength={160} onInput={(e) => set({ body: (e.target as HTMLInputElement).value })} /></label>
      <label class="switch"><input type="checkbox" checked={v.status === "published"} onChange={(e) => set({ status: (e.target as HTMLInputElement).checked ? "published" : "draft" })} /><span>Published</span></label>
      <span><button type="submit" class="primary">{m.id ? "Save" : "Add"}</button>{m.id && <button type="button" class="danger" onClick={() => onDelete(m.id)}>Delete</button>}</span>
    </form>
  );
}

export function Milestones({ rows, onChanged }: { rows: MilestoneRow[]; onChanged: () => void }) {
  const { toast } = useAdmin();
  const blank: MilestoneRow = { id: "", date: "", label: "", title: "", body: "", status: "published" };
  const save = async (m: MilestoneRow) => {
    const payload = { date: m.date, label: m.label, title: m.title, body: m.body ?? "", status: m.status };
    try {
      if (m.id) await api("PATCH", `milestones/${m.id}`, payload); else await api("POST", "milestones", payload);
      toast("Saved. The print rig sorts by date and prints one layer per published milestone.");
      onChanged();
    } catch (x) { toast(isApiError(x) ? x.error : "Save failed"); }
  };
  const del = async (id: string) => { if (confirm("Delete this milestone?")) { await api("DELETE", `milestones/${id}`); onChanged(); } };
  return (
    <div class="split">
      <div class="editor">
        <h1>About timeline</h1>
        <p class="muted">Milestones, auto-sorted by date. Each published one is one printed layer on About.</p>
        {rows.map((m) => <MilestoneForm key={m.id} m={m} onSave={save} onDelete={del} />)}
        <h2 class="ed-sub">Add a milestone</h2>
        <MilestoneForm key={`new-${rows.length}`} m={blank} onSave={save} onDelete={del} />
      </div>
      <Preview route="/about" reloadKey={rows.length} />
    </div>
  );
}

/* ---------- templates ---------- */

export function Templates({ rows, onChanged }: { rows: TemplateRow[]; onChanged: () => void }) {
  const { toast } = useAdmin();
  const [errors, setErrors] = useState<string[]>([]);
  const onFile = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    setErrors([]);
    try {
      const json = JSON.parse(await f.text());
      const r = await api<{ id: string; version: number }>("POST", "templates", json);
      toast(`Imported ${r.id} v${r.version}. Existing builds stay on their version until you upgrade them one at a time.`);
      onChanged();
    } catch (x) {
      if (isApiError(x)) setErrors(x.errors?.length ? x.errors : [x.error]);
      else setErrors(["That file isn't valid JSON."]);
    }
    (e.target as HTMLInputElement).value = "";
  };
  const download = (t: TemplateRow) => {
    const blob = new Blob([JSON.stringify({ id: t.id, name: t.name, sections: JSON.parse(t.sections_json) }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${t.id}-v${t.version}.json`;
    a.click();
  };
  return (
    <div class="page-pad">
      <h1>Templates</h1>
      <p class="muted">A template is the list of sections a new build page starts with. New layouts are designed in code; here you import, view and export them.</p>
      <label class="upload"><input type="file" accept="application/json,.json" onChange={onFile} /><span>Import a template JSON file</span></label>
      {errors.length > 0 && <ul class="problems">{errors.map((x) => <li>{x}</li>)}</ul>}
      <table class="table">
        <thead><tr><th>Template</th><th>Version</th><th>Sections</th><th>Used by</th><th></th></tr></thead>
        <tbody>{rows.map((t) => (
          <tr>
            <td>{t.name}<div class="muted small">{t.id}</div></td><td>v{t.version}</td>
            <td class="small">{(JSON.parse(t.sections_json) as { moduleId: string }[]).map((s) => s.moduleId).join(", ")}</td>
            <td>{t.used} build{t.used === 1 ? "" : "s"}</td>
            <td><button type="button" class="mini" onClick={() => download(t)}>Export</button></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/* ---------- settings ---------- */

const SETTING_TITLES: Record<SettingsKey, string> = { contacts: "Contact links", site: "Navigation and footer text", seo: "Search and social defaults", devlog: "Devlog month notes", cv: "CV" };
type SettingsData = Record<string, { value: unknown; updatedAt: number; dirty: boolean }>;

function SettingBlock({ k, data, onSaved }: { k: SettingsKey; data: SettingsData[string]; onSaved: (p: Problem[]) => void }) {
  const a = useAutosave<Record<string, unknown>>(data.value as Record<string, unknown>, data.updatedAt, async (value, updatedAt, keepalive) => {
    const r = await api<{ updatedAt: number; problems: Problem[] }>("PATCH", `settings/${k}`, { value, updatedAt }, { keepalive });
    onSaved(r.problems);
    return r;
  });
  const { toast } = useAdmin();
  const onCv = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append("file", f);
    try { const r = await api<{ fileKey: string }>("POST", "cv", fd); a.setValue({ ...a.value, fileKey: r.fileKey }); toast("CV uploaded. Publish settings to make it live."); }
    catch (x) { toast(isApiError(x) ? x.error : "Upload failed"); }
  };
  return (
    <details class="panel" open={k === "contacts"} onFocusOut={() => void a.flush()}>
      <summary>{SETTING_TITLES[k]} <span class="muted small">{a.status === "saving" ? "Saving…" : a.status === "saved" ? "Saved" : a.error}</span></summary>
      {k === "cv" ? (
        <div class="fields">
          <p>{a.value.fileKey ? <>Current CV: <a href={`/media/${String(a.value.fileKey)}`} target="_blank" rel="noopener">open the PDF</a></> : "No CV uploaded yet."}</p>
          <label class="upload"><input type="file" accept="application/pdf" onChange={onCv} /><span>Upload CV (PDF)</span></label>
          {Boolean(a.value.fileKey) && <button type="button" class="mini danger" onClick={() => a.setValue({ ...a.value, fileKey: "" })}>Remove CV</button>}
        </div>
      ) : <FieldsForm fields={settingsFields[k] as Fields} value={a.value} onChange={a.setValue} path={k} />}
    </details>
  );
}

export function Settings({ data, onChanged }: { data: SettingsData; onChanged: () => void }) {
  const { toast } = useAdmin();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const [rk, setRk] = useState(0);
  const publish = async () => {
    setBusy(true);
    try { await new Promise((r) => setTimeout(r, 2200)); await api("POST", "settings/publish", {}); toast("Settings are live on every page."); onChanged(); }
    catch (x) { if (isApiError(x)) { setProblems(x.problems ?? []); toast(x.error); } } finally { setBusy(false); }
  };
  const anyDirty = Object.values(data).some((d) => d.dirty);
  return (
    <div class="split">
      <div class="editor">
        <h1>Settings</h1>
        <StatusBar status="idle" savedAt={0} error="" problems={problems} onPublish={publish} publishing={busy} dirty={anyDirty} />
        {(Object.keys(settingsFields) as SettingsKey[]).map((k) => <SettingBlock k={k} data={data[k]!} onSaved={(p) => { setProblems(p); setRk((x) => x + 1); }} />)}
        <Versions ownerType="settings" ownerId="all" onRestored={() => location.reload()} refreshKey={rk} />
      </div>
      <Preview route="/" reloadKey={rk} />
    </div>
  );
}

/* ---------- health + analytics ---------- */

const CHECK_NAMES: Record<string, string> = { d1Tables: "Database", r2: "Image storage (R2)", accessConfigured: "Admin login (Access secrets)", analytics: "Web Analytics token", cache: "Edge cache" };

export function Health() {
  const [data, setData] = useState<null | { errors: { id: number; at: number; page: string; section: string; module: string; message: string }[]; checks: Record<string, unknown> }>(null);
  const [an, setAn] = useState<null | { message: string; dashboard: string }>(null);
  const load = () => { void api<typeof data>("GET", "health").then(setData); void api<typeof an>("GET", "analytics").then(setAn); };
  useEffect(load, []);
  const clear = async () => { await api("DELETE", "health"); load(); };
  return (
    <div class="page-pad">
      <h1>Analytics and health</h1>
      {an && <div class="notice"><p>{an.message}</p><a href={an.dashboard} target="_blank" rel="noopener">Open Cloudflare Web Analytics</a></div>}
      <h2 class="ed-sub">System checks</h2>
      {data && <ul class="checks">{Object.entries(data.checks).map(([k, v]) => <li><span>{CHECK_NAMES[k] ?? k}</span><strong class={v ? "ok" : "bad"}>{typeof v === "number" ? `${v} tables` : v ? "OK" : "Not set up"}</strong></li>)}</ul>}
      <h2 class="ed-sub">Broken sections <button type="button" class="mini" onClick={clear}>Clear</button></h2>
      {data && (data.errors.length === 0 ? <p class="muted">Nothing broken. Every section rendered.</p> : (
        <table class="table"><thead><tr><th>When</th><th>Page</th><th>Section</th><th>Problem</th></tr></thead>
          <tbody>{data.errors.map((e) => <tr><td class="small">{new Date(e.at).toLocaleString()}</td><td>{e.page}</td><td>{e.section} ({e.module})</td><td class="small">{e.message}</td></tr>)}</tbody></table>
      ))}
    </div>
  );
}
