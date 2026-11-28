import type { Unmount } from "../../core/island";

export function mountTimeline(root: HTMLElement): Unmount | void {
  const list = root.querySelector<HTMLOListElement>("[data-timeline-list]");
  const evidence = root.querySelector<HTMLElement>("[data-timeline-evidence]");
  if (!list || !evidence) return;

  const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>("[data-timeline-select]"));
  const rows = Array.from(list.querySelectorAll<HTMLLIElement>("[data-timeline-item]"));
  const panels = Array.from(evidence.querySelectorAll<HTMLElement>("[data-timeline-panel]"));
  if (!buttons.length || buttons.length !== rows.length || rows.length !== panels.length) return;

  let selected = 0;
  let frame = 0;
  const desktop = matchMedia("(min-width: 801px) and (min-height: 600px)");

  const select = (index: number) => {
    if (index === selected) return;
    buttons[selected]!.setAttribute("aria-pressed", "false");
    panels[selected]!.hidden = true;
    buttons[index]!.setAttribute("aria-pressed", "true");
    panels[index]!.hidden = false;
    selected = index;
  };

  const scroll = () => {
    frame = 0;
    if (!desktop.matches || evidence.contains(document.activeElement)) return;
    const bounds = list.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top >= innerHeight * .82) return;
    const marker = innerHeight * .52;
    let index = 0;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i]!.getBoundingClientRect().top > marker) break;
      index = i;
    }
    select(index);
  };
  const queue = () => { if (!frame) frame = requestAnimationFrame(scroll); };

  const click = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-timeline-select]") : null;
    const index = button ? buttons.indexOf(button) : -1;
    if (index >= 0) select(index);
  };
  const key = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case "ArrowUp": next = Math.max(0, index - 1); break;
      case "ArrowDown": next = Math.min(buttons.length - 1, index + 1); break;
      case "Home": next = 0; break;
      case "End": next = buttons.length - 1; break;
      default: return;
    }
    event.preventDefault();
    buttons[next]!.focus();
    select(next);
  };

  root.setAttribute("data-ready", "");
  root.addEventListener("click", click);
  root.addEventListener("keydown", key);
  window.addEventListener("scroll", queue, { passive: true });
  queue();

  return () => {
    cancelAnimationFrame(frame);
    root.removeEventListener("click", click);
    root.removeEventListener("keydown", key);
    window.removeEventListener("scroll", queue);
  };
}
