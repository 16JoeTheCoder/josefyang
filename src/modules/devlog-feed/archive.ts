import type { Unmount } from "../../core/island";

type ValueField = Element & { value: string };

const filters = ["q", "project", "type", "category", "tag"] as const;
const normalize = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase().trim();

export function mountArchive(root: HTMLElement): Unmount | void {
  const form = root.querySelector<HTMLFormElement>("[data-archive-controls]");
  const count = root.querySelector<HTMLElement>("[data-result-count]");
  const empty = root.querySelector<HTMLElement>("[data-empty-results]");
  const rail = root.querySelector<HTMLElement>(".archive-months");
  if (!form || !count || !empty || !rail) return;
  const q = form.querySelector<HTMLInputElement>("input[name=q]");
  const project = form.querySelector<ValueField>("select[name=project]");
  const type = form.querySelector<ValueField>("select[name=type]");
  const category = form.querySelector<ValueField>("select[name=category]");
  const tag = form.querySelector<ValueField>("select[name=tag]");
  if (!q || !project || !type || !category || !tag) return;
  const fields = { q, project, type, category, tag };
  const featured = document.querySelector<HTMLElement>("[data-devlog-featured]");
  const leadLinks = [...(featured?.querySelectorAll<HTMLAnchorElement>("[data-devlog-lead-link]") ?? [])];
  const months = [...root.querySelectorAll<HTMLElement>("[data-archive-month]")].map((month) => ({
    month,
    nav: rail.querySelector<HTMLElement>(`[data-month-link="${CSS.escape(month.dataset.archiveMonth ?? "")}"]`),
    rows: [...month.querySelectorAll<HTMLElement>("[data-archive-row]")].map((row) => ({
      row,
      text: normalize(row.dataset.search ?? ""),
      links: [...row.querySelectorAll<HTMLAnchorElement>("[data-archive-entry-link]")],
    })),
  }));
  const listeners = new AbortController();
  let frame = 0;
  const { signal } = listeners;

  function loadFilters() {
    const params = new URLSearchParams(window.location.search);
    filters.forEach((key) => { fields[key].value = params.get(key) ?? ""; });
  }

  function updateRail() {
    const visible = months.filter(({ month }) => !month.hidden);
    let active = visible[0]?.month;
    for (const { month } of visible) {
      if (month.getBoundingClientRect().top <= 180) active = month;
      else break;
    }
    for (const { month, nav } of months) {
      const anchor = nav?.querySelector("a");
      if (month === active) anchor?.setAttribute("aria-current", "location");
      else anchor?.removeAttribute("aria-current");
    }
    frame = 0;
  }

  function updateLinks(links: HTMLAnchorElement[], archiveParams: URLSearchParams) {
    for (const link of links) {
      const destination = new URL(link.href);
      for (const key of filters) destination.searchParams.delete(key);
      for (const [key, value] of archiveParams) destination.searchParams.set(key, value);
      link.href = destination.href;
    }
  }

  function update(syncUrl = false) {
    const terms = normalize(fields.q.value).split(/\s+/).filter(Boolean);
    const project = fields.project.value;
    const type = fields.type.value;
    const archiveParams = new URLSearchParams();
    for (const key of filters) if (fields[key].value.trim()) archiveParams.set(key, fields[key].value.trim());
    const hasFilter = archiveParams.size > 0;
    let shown = 0;
    for (const { month, nav, rows } of months) {
      let monthCount = 0;
      for (const { row, text, links } of rows) {
        const activeLead = featured && row.hasAttribute("data-lead-candidate") && location.hash !== `#${row.id}`;
        const matchesProject = !project || (project === "~failed" ? row.dataset.failed === "1" : row.dataset.project === project);
        const matchesCategory = !category!.value || (row.dataset.categories ?? "").split(" ").includes(category!.value);
        const matchesTag = !tag!.value || (row.dataset.tags ?? "").split(" ").includes(tag!.value);
        const matches = (!activeLead || hasFilter) && matchesProject && (!type || row.dataset.type === type) && matchesCategory && matchesTag && terms.every((term) => text.includes(term));
        row.hidden = !matches;
        if (matches) {
          monthCount++;
          updateLinks(links, archiveParams);
        }
      }
      month.hidden = !monthCount;
      if (nav) nav.hidden = !monthCount;
      shown += monthCount;
    }
    updateLinks(leadLinks, archiveParams);
    rail!.hidden = shown === 0;
    empty!.hidden = shown > 0 || (!hasFilter && Boolean(featured));
    count!.textContent = `${shown} ${shown === 1 ? root.dataset.singular : root.dataset.plural}`;
    if (syncUrl) {
      const url = new URL(location.href);
      for (const key of filters) url.searchParams.delete(key);
      for (const [key, value] of archiveParams) url.searchParams.set(key, value);
      try { history.replaceState(history.state, "", url); } catch { /* file previews can disallow rewriting a query */ }
    }
    updateRail();
  }

  function restore() {
    loadFilters();
    update();
    const id = location.hash.slice(1);
    if (!id.startsWith("log-entry-")) return;
    const entry = document.getElementById(id);
    if (entry && !entry.hidden) requestAnimationFrame(() => { entry.scrollIntoView({ block: "start" }); });
    else requestAnimationFrame(() => { root.scrollIntoView({ block: "start" }); });
  }

  form.addEventListener("input", () => update(true), { signal });
  form.addEventListener("change", () => update(true), { signal });
  form.addEventListener("submit", (event) => { event.preventDefault(); update(true); }, { signal });
  form.addEventListener("reset", (event) => {
    event.preventDefault();
    for (const key of filters) fields[key].value = "";
    update(true);
  }, { signal });
  window.addEventListener("popstate", restore, { signal });
  window.addEventListener("scroll", () => {
    if (!frame) frame = requestAnimationFrame(updateRail);
  }, { signal, passive: true });

  restore();
  form.hidden = false;
  return () => { listeners.abort(); if (frame) cancelAnimationFrame(frame); };
}
