/** "Ready to publish": everything across the site that still needs attention, each with a link to the editor that fixes it. */
import { useEffect } from "preact/hooks";
import { api } from "./api";

export interface CheckItem { id: string; kind: "fix" | "todo"; area: string; title: string; detail: string; href: string }

export function Checklist({ items, onRefresh }: { items: CheckItem[] | null; onRefresh: () => void }) {
  useEffect(() => { onRefresh(); }, []);
  if (!items) return <div class="page-pad"><h1>Ready to publish</h1><p class="muted">Checking every page, build, game and post…</p></div>;
  const fix = items.filter((i) => i.kind === "fix");
  const todo = items.filter((i) => i.kind === "todo");
  const group = (title: string, hint: string, list: CheckItem[]) => list.length > 0 && (
    <section class="check-group" aria-label={title}>
      <h2>{title} <span class="count-chip">{list.length}</span></h2>
      <p class="muted small">{hint}</p>
      <ul class="check-list">
        {list.map((i) => (
          <li class="check-row">
            <span class="check-area">{i.area}</span>
            <span class="check-main"><strong>{i.title}</strong><span class="muted small">{i.detail}</span></span>
            <a class="check-go" href={i.href}>Fix it</a>
          </li>
        ))}
      </ul>
    </section>
  );
  return (
    <div class="page-pad narrow-ish">
      <h1>Ready to publish</h1>
      <p class="muted">A site-wide check of pages, builds, settings, games and posts. Each row opens the place that fixes it.</p>
      {items.length === 0 && <div class="empty"><p><strong>Everything is ready.</strong></p><p class="muted">No placeholders, no missing alt text, no empty image slots, nothing waiting to go live.</p></div>}
      {group("Fix these", "Visitors will notice these on the live site.", fix)}
      {group("Waiting to go live", "Drafts, unpublished changes and scheduled posts.", todo)}
    </div>
  );
}

export const loadChecklist = () => api<{ items: CheckItem[] }>("GET", "checklist").then((r) => r.items, () => null);
