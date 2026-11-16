/** The admin shell (architecture §12.1): sidebar, editor, live preview. Hash routes keep it one Astro page. */
import { useCallback, useEffect, useState } from "preact/hooks";
import { api } from "./api";
import { BuildEditor, BuildsList, HomePlacement, type BuildRec, type TemplateRow } from "./Builds";
import { DevlogEditor, DevlogList, type Entry } from "./Devlog";
import { Library, Picker } from "./Library";
import { Health, Milestones, Settings, Templates, type MilestoneRow } from "./Misc";
import { PageEditor, type PageRec } from "./PageEditor";
import { Ctx, type MediaItem } from "./state";
import "./admin.css";

interface Boot {
  pages: PageRec[]; builds: BuildRec[]; settings: Record<string, { value: unknown; updatedAt: number; dirty: boolean }>;
  devlog: Entry[]; milestones: MilestoneRow[]; templates: TemplateRow[]; media: MediaItem[];
}

const useHash = () => {
  const [h, setH] = useState(location.hash.slice(1) || "page/home");
  useEffect(() => { const f = () => setH(location.hash.slice(1) || "page/home"); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return [h, (to: string) => { location.hash = to; }] as const;
};

const NAV: [string, string][] = [
  ["page/home", "Home"], ["page/projects", "Projects"], ["page/failures", "Failures"], ["page/devlog", "Devlog page"], ["page/entry", "Devlog entry layout"], ["page/about", "About"],
  ["builds", "Builds"], ["placement", "Home placement"], ["devlog", "Bench and devlog"], ["milestones", "About timeline"],
  ["media", "Media"], ["templates", "Templates"], ["settings", "Settings"], ["health", "Analytics and health"],
];

export default function App() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [err, setErr] = useState("");
  const [route, go] = useHash();
  const [picker, setPicker] = useState<null | ((m: MediaItem | null) => void)>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(false);

  const load = useCallback(async () => {
    try { setBoot(await api<Boot>("GET", "bootstrap")); } catch (e) { setErr((e as { error?: string }).error ?? "Could not load the admin"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => setNavOpen(false), [route]);

  const toast = useCallback((m: string) => { setToasts((t) => [...t, m]); setTimeout(() => setToasts((t) => t.slice(1)), 5000); }, []);
  const refreshMedia = useCallback(async () => { const media = await api<MediaItem[]>("GET", "media"); setBoot((b) => (b ? { ...b, media } : b)); }, []);
  const pickMedia = useCallback(() => new Promise<MediaItem | null>((resolve) => setPicker(() => (m: MediaItem | null) => { setPicker(null); resolve(m); })), []);

  if (err) return <div class="page-pad"><h1>Admin</h1><p class="warn">{err}</p></div>;
  if (!boot) return <div class="page-pad"><p>Loading…</p></div>;

  const [kind, id] = route.split("/");
  let screen;
  if (kind === "page") {
    const page = boot.pages.find((p) => p.id === id);
    screen = page ? <PageEditor key={page.id} page={page} onPublished={load} /> : <p>Unknown page</p>;
  } else if (kind === "builds") screen = <BuildsList builds={boot.builds} templates={boot.templates} onOpen={(i) => go(`build/${i}`)} onChanged={load} />;
  else if (kind === "build") {
    const b = boot.builds.find((x) => x.id === id);
    screen = b ? <BuildEditor key={b.id} build={b} onBack={() => go("builds")} onChanged={load} /> : <p class="page-pad">Build not found</p>;
  } else if (kind === "placement") screen = <HomePlacement builds={boot.builds} onOpen={(i) => go(`build/${i}`)} onChanged={load} />;
  else if (kind === "devlog") screen = <DevlogList entries={boot.devlog} builds={boot.builds} onOpen={(i) => go(`entry/${i}`)} onChanged={load} />;
  else if (kind === "entry") {
    const e = boot.devlog.find((x) => x.id === id);
    screen = e ? <DevlogEditor key={e.id} entry={e} builds={boot.builds} onBack={() => go("devlog")} onChanged={load} /> : <p class="page-pad">Entry not found</p>;
  } else if (kind === "milestones") screen = <Milestones rows={boot.milestones} onChanged={load} />;
  else if (kind === "media") screen = <Library />;
  else if (kind === "templates") screen = <Templates rows={boot.templates} onChanged={load} />;
  else if (kind === "settings") screen = <Settings data={boot.settings} onChanged={load} />;
  else screen = <Health />;

  const unpublished = boot.pages.filter((p) => p.dirty).length + boot.builds.filter((b) => b.dirty).length;
  return (
    <Ctx.Provider value={{ media: boot.media, refreshMedia, pickMedia, toast }}>
      <div class="admin">
        <aside class={`side ${navOpen ? "open" : ""}`}>
          <div class="side-head">
            <a href="/" class="brand"><span class="mark" aria-hidden="true" />josefyang admin</a>
            <button type="button" class="side-toggle" aria-expanded={navOpen} onClick={() => setNavOpen(!navOpen)}>Menu</button>
          </div>
          <nav aria-label="Admin">
            <ul>{NAV.map(([to, label]) => (
              <li><a href={`#${to}`} aria-current={route === to || (to === "builds" && kind === "build") || (to === "devlog" && kind === "entry") ? "page" : undefined}>{label}</a></li>
            ))}</ul>
          </nav>
          {unpublished > 0 && <p class="side-note">{unpublished} item{unpublished === 1 ? "" : "s"} with unpublished changes</p>}
        </aside>
        <main class="main">{screen}</main>
        {picker && <Picker onClose={picker} />}
        <div class="toasts" aria-live="polite">{toasts.map((t) => <p class="toast">{t}</p>)}</div>
      </div>
    </Ctx.Provider>
  );
}

