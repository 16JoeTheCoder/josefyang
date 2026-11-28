/**
 * Showcase tabs: tablist with roving tabindex and arrow/Home/End keys, crossfade between panels.
 * Hidden panels load their image only when a tab is hovered or focused.
 * Without JS the first panel and the notes list are shown. Reduced motion swaps instantly.
 */
import { reducedMotion, type Unmount } from "../../core/island";
import { showPanel, warmOnIntent } from "../../components/showcase/fade";

export function mountTabs(root: HTMLElement): Unmount | void {
  const bar = root.querySelector<HTMLElement>("[data-bar]");
  const stage = root.querySelector<HTMLElement>("[data-stage]");
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const panels = [...root.querySelectorAll<HTMLElement>("[data-panel]")];
  if (!bar || !stage || tabs.length < 2 || tabs.length !== panels.length) return;

  bar.hidden = false;
  stage.dataset.ready = "true";
  const unwarm = warmOnIntent(tabs, (tab) => panels[tabs.indexOf(tab as HTMLButtonElement)]);

  const select = (i: number, focus: boolean) => {
    tabs.forEach((t, k) => { t.setAttribute("aria-selected", String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    showPanel(panels, i, reducedMotion());
    if (focus) tabs[i]!.focus();
  };
  const onClick = (e: Event) => select(tabs.indexOf(e.currentTarget as HTMLButtonElement), false);
  const onKey = (e: KeyboardEvent) => {
    const cur = tabs.indexOf(e.currentTarget as HTMLButtonElement);
    const n = tabs.length;
    const next = e.key === "ArrowRight" ? (cur + 1) % n : e.key === "ArrowLeft" ? (cur - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    select(next, true);
  };
  tabs.forEach((t) => { t.addEventListener("click", onClick); t.addEventListener("keydown", onKey); });
  return () => { unwarm(); tabs.forEach((t) => { t.removeEventListener("click", onClick); t.removeEventListener("keydown", onKey); }); };
}
