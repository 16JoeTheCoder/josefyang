/** Admin → Games: the hub's list, one game's editor, and the hub page copy. Same patterns as Builds.tsx. */
import { useCallback, useEffect, useState } from "preact/hooks";
import { gameFields, hubFields, type GameFields, type GameStatus } from "../core/game-fields";
import type { Fields } from "../core/fields";
import { api, isApiError } from "./api";
import { useAutosave, type Problem } from "./autosave";
import { FieldsForm } from "./Fields";
import { Preview, StatusBar } from "./parts";
import { ago, useAdmin } from "./state";

export interface GameRec { id: string; slug: string; game: GameFields; sort: number; updatedAt: number; publishedAt: number | null; dirty: boolean }
const STATUS: Record<GameStatus, string> = { development: "In development", playable: "Playable", released: "Released" };

export function GamesAdmin({ kind, id, go }: { kind: string; id?: string; go: (to: string) => void }) {
  const [games, setGames] = useState<GameRec[] | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { setGames(await api<GameRec[]>("GET", "games")); setErr(""); } catch (e) { setErr(isApiError(e) ? e.error : "Could not load games"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (kind === "gamehub") return <HubEditor />;
  if (err) return <div class="page-pad"><h1>Games</h1><p class="warn">{err}</p></div>;
  if (!games) return <div class="page-pad"><p>Loading…</p></div>;
  if (kind === "game") {
    const g = games.find((x) => x.id === id);
    return g ? <GameEditor key={g.id} game={g} onBack={() => go("games")} onChanged={load} /> : <p class="page-pad">Game not found</p>;
  }
  return <GamesList games={games} onOpen={(i) => go(`game/${i}`)} onHub={() => go("gamehub")} onChanged={load} />;
}

function GamesList({ games, onOpen, onHub, onChanged }: { games: GameRec[]; onOpen: (id: string) => void; onHub: () => void; onChanged: () => Promise<void> }) {
  const { toast } = useAdmin();
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const create = async (e: Event) => {
    e.preventDefault();
    try {
      const r = await api<{ id: string }>("POST", "games", { name: name.trim() });
      setName(""); setErr("");
      await onChanged();
      onOpen(r.id);
    } catch (x) { setErr(isApiError(x) ? x.error : "Could not create"); }
  };
  const move = async (i: number, d: number) => {
    const a = games.map((g) => g.id);
    const [x] = a.splice(i, 1);
    a.splice(i + d, 0, x!);
    setBusy(true);
    try { await api("POST", "games/order", { ids: a }); toast("Order saved. It is live straight away."); await onChanged(); }
    catch (e) { toast(isApiError(e) ? e.error : "Could not save the order"); } finally { setBusy(false); }
  };
  return (
    <div class="split">
      <div class="editor">
        <h1>Games</h1>
        <p class="muted">Each game is its own app on its own address. This list is what the hub at game.josefyang.com shows, in this order.</p>
        <form class="create" onSubmit={create}>
          <label for="ng">New game name</label>
          <input id="ng" value={name} maxLength={32} required onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          <button type="submit" class="primary">Create game</button>
          {err && <p class="warn">{err}</p>}
        </form>
        <p><button type="button" onClick={onHub}>Edit the hub text</button></p>
        {games.length === 0 ? <div class="empty"><p><strong>No games yet.</strong></p><p class="muted">Add your first game with the form above.</p></div> : (
          <ol class="sections">
            {games.map((g, i) => (
              <li class="section"><div class="section-bar">
                <button type="button" class="section-toggle" onClick={() => onOpen(g.id)}>
                  <span class="num">{i + 1}</span> {g.game.name.value}
                  <span class="muted small"> {STATUS[g.game.status]} · {!g.publishedAt ? "Not published" : g.dirty ? "Unpublished changes" : "Live"} · {ago(g.updatedAt)}</span>
                </button>
                <span class="section-actions">
                  <button type="button" class="mini" disabled={busy || i === 0} onClick={() => move(i, -1)}>Move up</button>
                  <button type="button" class="mini" disabled={busy || i === games.length - 1} onClick={() => move(i, 1)}>Move down</button>
                </span>
              </div></li>
            ))}
          </ol>
        )}
      </div>
      <Preview route="/hub" reloadKey={games.reduce((n, g) => n + g.updatedAt, 0) % 100000} />
    </div>
  );
}

function GameEditor({ game, onBack, onChanged }: { game: GameRec; onBack: () => void; onChanged: () => void }) {
  const { toast } = useAdmin();
  const [reloadKey, setReloadKey] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(!!game.publishedAt);
  const [dirty, setDirty] = useState(game.dirty);
  const [serverProblems, setServerProblems] = useState<Problem[]>([]);
  type Doc = { slug: string; game: GameFields };
  const a = useAutosave<Doc>({ slug: game.slug, game: game.game }, game.updatedAt, async (doc, updatedAt, keepalive) => {
    const r = await api<{ updatedAt: number; problems: Problem[] }>("PATCH", `games/${game.id}`, { doc, updatedAt }, { keepalive });
    setReloadKey((k) => k + 1);
    setDirty(true);
    return r;
  });
  const doc = a.value;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await a.flush(); await fn(); toast(ok); onChanged(); } catch (e) { if (isApiError(e)) { setServerProblems(e.problems ?? []); toast(e.error); } }
  };
  const publish = async () => { setPublishing(true); await run(async () => { await api("POST", `games/${game.id}/publish`, {}); setPublished(true); setDirty(false); setServerProblems([]); }, "Game is live on the hub."); setPublishing(false); };
  const unpublish = () => run(async () => { await api("POST", `games/${game.id}/unpublish`, {}); setPublished(false); }, "Game taken off the hub.");
  const del = async () => { if (!confirm(`Delete "${doc.game.name.value}"? It disappears from the hub.`)) return; await run(() => api("DELETE", `games/${game.id}`), "Game deleted."); onBack(); };
  const problems = a.problems.length ? a.problems : serverProblems;
  return (
    <div class="split">
      <div class="editor" onFocusOut={() => void a.flush().catch(() => {})}>
        <header class="ed-head">
          <button type="button" class="linkish" onClick={onBack}>All games</button>
          <h1>{doc.game.name.value || "Untitled game"}</h1>
        </header>
        <StatusBar status={a.status} savedAt={a.savedAt} error={a.error} problems={problems} onPublish={publish} publishing={publishing} dirty={dirty || !published}
          extra={<>{published && <button type="button" onClick={unpublish}>Take offline</button>}<button type="button" class="danger" onClick={del}>Delete</button></>} />
        <div class="field">
          <label for="gslug">Hub address: /<strong>{doc.slug}</strong> (also the <code>game</code> value for its devlog posts)</label>
          <input id="gslug" value={doc.slug} onInput={(e) => a.setValue({ ...doc, slug: (e.target as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
        </div>
        <FieldsForm fields={gameFields as Fields} value={doc.game as unknown as Record<string, unknown>} onChange={(g) => a.setValue({ ...doc, game: g as unknown as GameFields })} path="game" />
      </div>
      <Preview route={`/hub/${doc.slug}`} reloadKey={reloadKey} />
    </div>
  );
}

function HubEditor() {
  const { toast } = useAdmin();
  const [init, setInit] = useState<{ value: Record<string, unknown>; updatedAt: number; dirty: boolean } | null>(null);
  useEffect(() => { void api<{ value: Record<string, unknown>; updatedAt: number; dirty: boolean }>("GET", "games/hub").then(setInit); }, []);
  if (!init) return <div class="page-pad"><p>Loading…</p></div>;
  return <HubForm init={init} toast={toast} />;
}

function HubForm({ init, toast }: { init: { value: Record<string, unknown>; updatedAt: number; dirty: boolean }; toast: (m: string) => void }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [dirty, setDirty] = useState(init.dirty);
  const [serverProblems, setServerProblems] = useState<Problem[]>([]);
  const a = useAutosave<Record<string, unknown>>(init.value, init.updatedAt, async (value, updatedAt, keepalive) => {
    const r = await api<{ updatedAt: number; problems: Problem[] }>("PATCH", "games/hub", { value, updatedAt }, { keepalive });
    setReloadKey((k) => k + 1);
    setDirty(true);
    return r;
  });
  const publish = async () => {
    setPublishing(true);
    try { await a.flush(); await api("POST", "games/hub/publish", {}); setDirty(false); setServerProblems([]); toast("Hub text is live."); }
    catch (e) { if (isApiError(e)) { setServerProblems(e.problems ?? []); toast(e.error); } } finally { setPublishing(false); }
  };
  const problems = a.problems.length ? a.problems : serverProblems;
  return (
    <div class="split">
      <div class="editor" onFocusOut={() => void a.flush().catch(() => {})}>
        <h1>Game hub text</h1>
        <p class="muted">Every line on the hub and on each game page that is not about one game: headings, install notes, labels.</p>
        <StatusBar status={a.status} savedAt={a.savedAt} error={a.error} problems={problems} onPublish={publish} publishing={publishing} dirty={dirty} />
        <FieldsForm fields={hubFields as Fields} value={a.value} onChange={a.setValue} path="hub" />
      </div>
      <Preview route="/hub" reloadKey={reloadKey} />
    </div>
  );
}
