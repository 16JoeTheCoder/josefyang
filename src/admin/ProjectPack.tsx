/** Project packs in the admin: import a <slug>.zip as a draft build, export a build as one. Format: docs/PROJECT-PACK.md. */
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { useState } from "preact/hooks";
import type { Section } from "../core/module";
import { checkEntries, checkPack, docFromPack, extOf, isJunkEntry, packFromDoc, type PackCheck, type UploadedMedia } from "../core/pack";
import docText from "../../docs/PROJECT-PACK.md?raw";
import { api, isApiError } from "./api";
import type { BuildRec } from "./Builds";
import { uploadFile } from "./Library";
import { useAdmin } from "./state";

const MIME: Record<string, string> = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", avif: "image/avif", mp4: "video/mp4" };

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const downloadPackDoc = () => download(new Blob([docText], { type: "text/markdown" }), "PROJECT-PACK.md");

/** Export: same format as import, so export then import round-trips. */
export async function exportProject(doc: { slug: string; meta: unknown; sections: Section[] }) {
  const { project, files } = packFromDoc(doc);
  const out: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = { "project.json": strToU8(JSON.stringify(project, null, 2)) };
  for (const f of files) {
    const res = await fetch(f.url);
    if (!res.ok) throw new Error(`Could not fetch ${f.url} (${res.status})`);
    out[f.name] = [new Uint8Array(await res.arrayBuffer()), { level: 0 }];
  }
  download(new Blob([zipSync(out) as BlobPart], { type: "application/zip" }), `${doc.slug}.zip`);
}

interface Loaded { name: string; check: PackCheck; files: Record<string, Uint8Array>; existing: BuildRec | null }
type Step = { file: string; state: "wait" | "busy" | "done" | "fail"; note?: string };

function readZip(data: Uint8Array): { entries: { name: string; size: number }[]; files: Record<string, Uint8Array> } {
  const entries: { name: string; size: number }[] = [];
  // First pass lists sizes without unpacking anything (so a huge zip is refused before it uses memory).
  unzipSync(data, { filter: (f) => { entries.push({ name: f.name, size: f.originalSize }); return false; } });
  const problems = checkEntries(entries);
  if (problems.length) return { entries, files: {} };
  return { entries, files: unzipSync(data, { filter: (f) => !isJunkEntry(f.name) }) };
}

export function ImportProject({ builds, onOpen, onChanged }: { builds: BuildRec[]; onOpen: (id: string) => void; onChanged: () => Promise<void> }) {
  const { toast, refreshMedia } = useAdmin();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [errs, setErrs] = useState<string[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const load = async (file: File | undefined) => {
    setLoaded(null); setErrs([]); setSteps([]);
    if (!file) return;
    try {
      if (file.size > 90 * 1024 * 1024) return setErrs(["That zip is over 90 MB. A pack can hold up to 80 MB."]);
      const { entries, files } = readZip(new Uint8Array(await file.arrayBuffer()));
      const pre = checkEntries(entries);
      let json: unknown = null;
      if (files["project.json"]) {
        try { json = JSON.parse(strFromU8(files["project.json"])); } catch { pre.push("project.json is not valid JSON."); }
      }
      const check = checkPack(entries, json);
      const all = [...new Set([...pre, ...check.problems])];
      if (all.length || !check.pack) return setErrs(all.length ? all : ["This does not look like a project pack."]);
      setLoaded({ name: file.name, check, files, existing: builds.find((b) => b.slug === check.pack!.slug) ?? null });
    } catch {
      setErrs(["That file could not be opened as a zip."]);
    }
  };

  const run = async () => {
    if (!loaded?.check.pack) return;
    const { pack } = loaded.check;
    const used = [...new Set(Object.keys(loaded.files).filter((n) => n !== "project.json"))].filter((n) => JSON.stringify(pack).includes(`"${n}"`));
    setBusy(true);
    setSteps(used.map((file) => ({ file, state: "wait" as const })));
    const set = (file: string, state: Step["state"], note?: string) => setSteps((s) => s.map((x) => (x.file === file ? { ...x, state, note } : x)));
    const map: Record<string, UploadedMedia> = {};
    let createdId: string | null = null;
    try {
      for (const name of used) {
        set(name, "busy");
        try {
          const f = new File([loaded.files[name]! as BlobPart], name.split("/").pop()!, { type: MIME[extOf(name)] ?? "" });
          const { item, warning } = await uploadFile(f);
          map[name] = { mediaId: item.id, key: item.key, original: item.original, widths: item.widths, w: item.w, h: item.h, transparent: item.transparent };
          set(name, "done", warning);
        } catch (x) {
          const msg = x instanceof Error ? x.message : isApiError(x) ? x.error : "Upload failed";
          set(name, "fail", msg);
          throw new Error(`${name}: ${msg}`);
        }
      }
      const doc = docFromPack(pack, map);
      if (doc.problems.length) throw new Error(doc.problems[0]);
      let id = loaded.existing?.id;
      if (!id) {
        const title = ((pack.meta.title as { value?: string } | undefined)?.value || pack.slug).slice(0, 40);
        const r = await api<{ id: string }>("POST", "builds", { title, templateId: "build-default" });
        id = createdId = r.id;
      }
      const cur = await api<BuildRec>("GET", `builds/${id}`);
      const r = await api<{ problems: { label: string; message: string }[] }>("PATCH", `builds/${id}`, { doc: { slug: doc.slug, meta: doc.meta, sections: doc.sections }, updatedAt: cur.updatedAt });
      await refreshMedia();
      await onChanged();
      toast(`${loaded.existing ? "Updated the draft of" : "Imported"} "${pack.slug}" as a draft.${r.problems.length ? ` ${r.problems.length} thing${r.problems.length === 1 ? "" : "s"} to fix before publishing.` : ""}`);
      setLoaded(null);
      onOpen(id);
    } catch (x) {
      if (createdId) await api("DELETE", `builds/${createdId}`).catch(() => undefined);
      setErrs([x instanceof Error ? x.message : isApiError(x) ? x.error : "Import failed"]);
      await refreshMedia().catch(() => undefined);
    } finally { setBusy(false); }
  };

  const c = loaded?.check;
  return (
    <section class="import" aria-labelledby="imp-h">
      <h2 id="imp-h">Import project (.zip)</h2>
      <label class={`drop ${over ? "over-drop" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void load(e.dataTransfer?.files[0]); }}>
        <span>Drop a project pack here, or choose a file</span>
        <input type="file" accept=".zip,application/zip" disabled={busy} onChange={(e) => { const i = e.target as HTMLInputElement; void load(i.files?.[0]); i.value = ""; }} />
      </label>
      {errs.length > 0 && (
        <div class="notice" role="alert">
          <p class="warn">This pack cannot be imported yet:</p>
          <ul>{errs.map((m) => <li>{m}</li>)}</ul>
        </div>
      )}
      {loaded && c?.summary && (
        <div class="notice import-summary" data-testid="import-summary">
          <p><strong>{loaded.name}</strong></p>
          <p>{loaded.existing
            ? <>A build at /builds/{c.summary.slug} already exists ("{loaded.existing.meta.title.value}"). Importing replaces its <strong>draft</strong> and keeps the same build. The live page does not change until you publish.</>
            : <>This creates a <strong>new draft build</strong> at /builds/{c.summary.slug}. Nothing goes live until you publish it.</>}</p>
          <ul>
            <li>{c.summary.sections} section{c.summary.sections === 1 ? "" : "s"}</li>
            <li>{c.summary.images} image{c.summary.images === 1 ? "" : "s"} and {c.summary.videos} video{c.summary.videos === 1 ? "" : "s"}</li>
            {c.warnings.map((w) => <li class="muted">{w}</li>)}
          </ul>
          {steps.length > 0 && (
            <ul class="import-progress" aria-live="polite">
              {steps.map((s) => <li><span>{s.state === "done" ? "Done" : s.state === "busy" ? "Uploading" : s.state === "fail" ? "Failed" : "Waiting"}</span><span>{s.file}</span>{s.note && <span class="muted small">{s.note}</span>}</li>)}
            </ul>
          )}
          <div class="row-actions">
            <button type="button" class="primary" disabled={busy} onClick={run}>{busy ? "Importing…" : loaded.existing ? "Update the draft" : "Create the draft"}</button>
            <button type="button" disabled={busy} onClick={() => { setLoaded(null); setSteps([]); }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function PackHelp() {
  return <p class="muted small"><button type="button" class="linkish" onClick={downloadPackDoc}>How to make a project pack</button> (downloads PROJECT-PACK.md)</p>;
}

export function ExportButton({ getDoc }: { getDoc: () => Promise<{ slug: string; meta: unknown; sections: Section[] }> }) {
  const { toast } = useAdmin();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true);
      try { await exportProject(await getDoc()); } catch (x) { toast(x instanceof Error ? x.message : "Export failed"); } finally { setBusy(false); }
    }}>{busy ? "Exporting…" : "Export project (.zip)"}</button>
  );
}
