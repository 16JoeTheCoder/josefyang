import type { Unmount } from "../../core/island";

export function mountHopper(root: HTMLElement): Unmount | void {
  const drawer = root.querySelector<HTMLElement>("[data-drawer]");
  const toggle = root.querySelector<HTMLButtonElement>("[data-drawer-toggle]");
  const list = drawer?.querySelector<HTMLOListElement>("ol");
  const label = root.querySelector<HTMLElement>("[data-drawer-label]");
  const stack = root.querySelector<HTMLElement>("[data-case-stack]");
  const announcement = root.querySelector<HTMLElement>("[data-case-announcement]");
  const links = [...root.querySelectorAll<HTMLAnchorElement>("[data-case-link]")];
  const reports = [...root.querySelectorAll<HTMLElement>("[data-case-report]")];
  if (!drawer || !toggle || !label || !stack || !reports.length) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const compact = matchMedia("(max-width: 810px)");
  const controller = new AbortController();
  const { signal } = controller;
  let active: HTMLElement | undefined;
  let animations: Animation[] = [];
  let revision = 0;

  function closeMotion() {
    animations.forEach((animation) => animation.cancel());
    animations = [];
    reports.forEach((report) => {
      report.hidden = report !== active;
      report.inert = report !== active;
      report.removeAttribute("data-leaving");
      report.toggleAttribute("data-shown", report === active);
    });
  }

  function revealActiveFile() {
    const link = links.find((item) => item.dataset.caseLink === active?.id);
    if (!link || !list || drawer?.inert) return;
    const bounds = list.getBoundingClientRect();
    const file = link.getBoundingClientRect();
    if (file.top < bounds.top) list.scrollTop -= bounds.top - file.top;
    else if (file.bottom > bounds.bottom) list.scrollTop += file.bottom - bounds.bottom + 8;
  }

  function select(report: HTMLElement, animate = true) {
    if (report === active) return;
    const request = ++revision;
    closeMotion();
    const previous = active;
    active = report;
    reports.forEach((item) => {
      item.hidden = item !== report;
      item.inert = item !== report;
      item.toggleAttribute("data-shown", item === report);
    });
    links.forEach((link) => {
      if (link.dataset.caseLink === report.id) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
    revealActiveFile();
    if (announcement && animate) announcement.textContent = report.querySelector("h2")?.textContent ?? "";

    if (!previous || !animate || reduce.matches || !report.animate) return;
    previous.hidden = false;
    previous.setAttribute("data-leaving", "");
    animations = [
      previous.animate(
        [{ opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
         { opacity: 0, transform: "translate3d(-28px, 7px, 0) scale(.98)" }],
        { duration: 170, easing: "cubic-bezier(.3, .7, .35, 1)" },
      ),
      report.animate(
        [{ opacity: 0, transform: compact.matches ? "translate3d(0, -15px, 0)" : "translate3d(-36px, 8px, 0) rotate(-1deg)" },
         { opacity: 1, transform: "translate3d(0, 0, 0) rotate(0)" }],
        { duration: 320, easing: "cubic-bezier(.16, 1, .3, 1)" },
      ),
    ];
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (revision === request) closeMotion();
    });
  }

  function syncHash(animate = true) {
    const report = reports.find((item) => "#" + item.id === location.hash);
    if (report || !location.hash || !active) select(report ?? reports[0]!, animate);
  }

  function toggleDrawer() {
    const closed = drawer!.toggleAttribute("data-closed");
    drawer!.inert = closed;
    toggle!.setAttribute("aria-expanded", String(!closed));
    label!.textContent = (closed ? toggle!.dataset.openLabel : toggle!.dataset.closeLabel) ?? "";
    if (!closed) revealActiveFile();
  }

  stack.setAttribute("data-ready", "");
  syncHash(false);
  toggle.hidden = false;
  toggle.addEventListener("click", toggleDrawer, { signal });
  window.addEventListener("hashchange", () => syncHash(), { signal });
  links.forEach((link, index) => {
    link.addEventListener("click", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const report = reports.find((item) => item.id === link.dataset.caseLink);
      if (!report) return;
      event.preventDefault();
      if (location.hash !== "#" + report.id) history.pushState(history.state, "", "#" + report.id);
      select(report);
      if (compact.matches || event.detail === 0) {
        report.focus({ preventScroll: true });
        report.scrollIntoView({ block: "nearest", behavior: reduce.matches ? "instant" : "smooth" });
      }
    }, { signal });
    link.addEventListener("keydown", (event) => {
      const next = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1
        : event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      links[Math.max(0, Math.min(links.length - 1, next))]?.focus();
    }, { signal });
  });

  return () => {
    controller.abort();
    revision++;
    closeMotion();
  };
}
