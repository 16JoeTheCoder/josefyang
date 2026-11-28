/** Studio navigation and hash routes for the admin workspaces. */
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { api } from "./api";
import { Checklist, loadChecklist, type CheckItem } from "./Checklist";
import { BuildEditor, BuildsList, HomePlacement, type BuildRec, type TemplateRow } from "./Builds";
import { DevlogEditor, DevlogList, type Entry } from "./Devlog";
import { GamesAdmin } from "./Games";
import { Library, Picker } from "./Library";
import { Health, Milestones, Settings, Templates, type MilestoneRow } from "./Misc";
import { PageEditor, type PageRec } from "./PageEditor";
import { Ctx, type MediaItem } from "./state";
import "./admin.css";

interface Boot {
  pages: PageRec[]; builds: BuildRec[]; settings: Record<string, { value: unknown; updatedAt: number; dirty: boolean }>;
  devlog: Entry[]; milestones: MilestoneRow[]; templates: TemplateRow[]; media: MediaItem[];
}

const hashRoute = () => location.hash.slice(1) || "page/home";

const NAV_GROUPS: { title: string; items: [string, string][] }[] = [
  { title: "Site pages", items: [["page/home", "Home"], ["page/projects", "Projects"], ["page/failures", "Failures"], ["page/devlog", "Devlog page"], ["page/entry", "Devlog entry layout"], ["page/about", "About"], ["page/games", "Games journey"], ["milestones", "About timeline"]] },
  { title: "Projects", items: [["builds", "Builds"], ["placement", "Home placement"], ["templates", "Templates"]] },
  { title: "Writing", items: [["devlog", "Blog"]] },
  { title: "Games", items: [["games", "Games"], ["gamehub", "Game hub text"]] },
  { title: "Library & settings", items: [["media", "Media"], ["settings", "Settings"], ["health", "Analytics and health"]] },
];

export default function App() {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [err, setErr] = useState("");
  const [route, setRoute] = useState(hashRoute);
  const activeRoute = useRef(route);
  const [picker, setPicker] = useState<null | { done: (m: MediaItem | null) => void; kind: "image" | "video" }>(null);
  const [toasts, setToasts] = useState<string[]>([]);
  const [navOpen, setNavOpen] = useState(false);
  const navigationPending = useRef(false);
  const navButton = useRef<HTMLButtonElement>(null);
  const [checks, setChecks] = useState<CheckItem[] | null>(null);
  const refreshChecks = useCallback(async () => { const items = await loadChecklist(); if (items) setChecks(items); }, []);

  const load = useCallback(async () => {
    void refreshChecks();
    try { setBoot(await api<Boot>("GET", "bootstrap")); } catch (e) { setErr((e as { error?: string }).error ?? "Could not load the admin"); }
  }, [refreshChecks]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => setNavOpen(false), [route]);

  const toast = useCallback((m: string) => { setToasts((t) => [...t.slice(-2), m]); setTimeout(() => setToasts((t) => t.slice(1)), 5000); }, []);
  const refreshMedia = useCallback(async () => { const media = await api<MediaItem[]>("GET", "media"); setBoot((b) => (b ? { ...b, media } : b)); }, []);
  const pickMedia = useCallback((opts?: { kind?: "image" | "video" }) => new Promise<MediaItem | null>((resolve) => setPicker({ kind: opts?.kind ?? "image", done: (m: MediaItem | null) => { setPicker(null); resolve(m); } })), []);

  const go = useCallback(async (next: string, fromHistory = false) => {
    if (navigationPending.current) return;
    if (next === activeRoute.current) { setNavOpen(false); return; }
    navigationPending.current = true;
    try {
      const waits: Promise<void>[] = [];
      window.dispatchEvent(new CustomEvent("jy-before-admin-route", { detail: { waitUntil: (task: Promise<void>) => waits.push(task) } }));
      await Promise.all(waits);
      if (!fromHistory) history.pushState(null, "", "#" + next);
      activeRoute.current = next;
      setRoute(next);
      setNavOpen(false);
    } catch {
      if (fromHistory) history.replaceState(null, "", "#" + activeRoute.current);
      toast("Could not save the current changes. Resolve the save error before leaving.");
    } finally {
      navigationPending.current = false;
    }
  }, [toast]);
  useEffect(() => {
    const onHashChange = () => { void go(hashRoute(), true); };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [go]);
  useEffect(() => {
    if (!navOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setNavOpen(false); navButton.current?.focus(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [navOpen]);
  if (err) return <div class="page-pad"><h1>Admin</h1><p class="warn">{err}</p></div>;
  if (!boot) return <div class="page-pad"><p>Loading…</p></div>;

  const [routePath = "", query = ""] = route.split("?");
  const focusSection = new URLSearchParams(query).get("s");
  const [kind, id] = routePath.split("/");
  let screen;
  if (kind === "page") {
    const page = boot.pages.find((p) => p.id === id);
    screen = page ? <PageEditor key={page.id} page={page} onPublished={load} focusSection={focusSection} entryPreviewId={boot.devlog[0]?.id} onOpenDevlog={() => void go("devlog")} /> : <p>Unknown page</p>;
  } else if (kind === "builds") screen = <BuildsList builds={boot.builds} templates={boot.templates} onOpen={(i) => go(`build/${i}`)} onChanged={load} />;
  else if (kind === "build") {
    const b = boot.builds.find((x) => x.id === id);
    screen = b ? <BuildEditor key={b.id} build={b} onBack={() => go("builds")} onChanged={load} focusSection={focusSection} /> : <p class="page-pad">Build not found</p>;
  } else if (kind === "placement") screen = <HomePlacement builds={boot.builds} onOpen={(i) => go(`build/${i}`)} onChanged={load} />;
  else if (kind === "devlog") screen = <DevlogList entries={boot.devlog} builds={boot.builds} onOpen={(i) => go(`entry/${i}`)} onChanged={load} />;
  else if (kind === "entry") {
    const e = boot.devlog.find((x) => x.id === id);
    screen = e ? <DevlogEditor key={e.id} entry={e} builds={boot.builds} onBack={() => go("devlog")} onChanged={load} /> : <p class="page-pad">Entry not found</p>;
  } else if (kind === "games" || kind === "game" || kind === "gamehub") screen = <GamesAdmin kind={kind} id={id} go={go} />;
  else if (kind === "checklist") screen = <Checklist items={checks} onRefresh={refreshChecks} />;
  else if (kind === "milestones") screen = <Milestones rows={boot.milestones} onChanged={load} />;
  else if (kind === "media") screen = <Library />;
  else if (kind === "templates") screen = <Templates rows={boot.templates} onChanged={load} />;
  else if (kind === "settings") screen = <Settings data={boot.settings} onChanged={load} />;
  else screen = <Health />;

  const unpublished = boot.pages.filter((p) => p.dirty).length + boot.builds.filter((b) => b.dirty).length;
  return (
    <Ctx.Provider value={{ media: boot.media, refreshMedia, pickMedia, toast }}>
      <div class="admin admin-shell">
        <header class="admin-top">
          <a href="/" class="brand"><span class="mark" aria-hidden="true" />Josef Yang<span class="admin-word">Studio</span></a>
          <button ref={navButton} type="button" class="admin-menu" aria-expanded={navOpen} aria-controls="admin-navigation" onClick={() => setNavOpen(!navOpen)}>Site menu</button>
          <nav class="admin-shortcuts" aria-label="Workspaces">
            <a href="#page/home" aria-current={kind === "page" ? "page" : undefined} onClick={(event) => { event.preventDefault(); void go("page/home"); }}>Pages</a>
            <a href="#builds" aria-current={kind === "builds" || kind === "build" ? "page" : undefined} onClick={(event) => { event.preventDefault(); void go("builds"); }}>Projects</a>
            <a href="#devlog" aria-current={kind === "devlog" || kind === "entry" ? "page" : undefined} onClick={(event) => { event.preventDefault(); void go("devlog"); }}>Devlog</a>
            <a href="#media" aria-current={kind === "media" ? "page" : undefined} onClick={(event) => { event.preventDefault(); void go("media"); }}>Media</a>
          </nav>
          <a class="admin-check" href="#checklist" aria-current={kind === "checklist" ? "page" : undefined} onClick={(event) => { event.preventDefault(); void go("checklist"); }}>
            Publish checklist{checks && checks.length > 0 && <span class="nav-badge" aria-label={checks.length + " to look at"}>{checks.length}</span>}
          </a>
        </header>
        {navOpen && <>
          <button type="button" class="admin-menu-scrim" aria-label="Close site menu" onClick={() => { setNavOpen(false); navButton.current?.focus(); }} />
          <aside class="admin-navigation" id="admin-navigation">
            <nav aria-label="Site settings and sections">
              {NAV_GROUPS.map((group) => <section class="nav-group" aria-label={group.title} key={group.title}>
                <h3>{group.title}</h3>
                <ul>{group.items.map(([to, label]) => <li key={to}><a href={"#" + to} aria-current={routePath === to ? "page" : undefined} onClick={(event) => { event.preventDefault(); void go(to); }}>{label}</a></li>)}</ul>
              </section>)}
            </nav>
            {unpublished > 0 && <p class="side-note">{unpublished} item{unpublished === 1 ? "" : "s"} with unpublished changes</p>}
          </aside>
        </>}
        <main class="main">{screen}</main>
        {picker && <Picker kind={picker.kind} onClose={picker.done} />}
        <div class="toasts" aria-live="polite">{toasts.map((t) => <p class={`toast ${/could not|failed|fix |too long|offline|error/i.test(t) ? "toast-warn" : ""}`}>{t}</p>)}</div>
      </div>
    </Ctx.Provider>
  );
}
