/** Theme studio: flips data-mode / data-accent (colours come from palettes.ts rules) and points the download at the matching file. */
import type { Unmount } from "../../core/island";
import { themeFile, type Accent, type Mode } from "./palettes";

export function mountStudio(root: HTMLElement): Unmount | void {
  const controls = root.querySelector<HTMLElement>("[data-controls]");
  const download = root.querySelector<HTMLAnchorElement>("[data-download]");
  const name = root.querySelector<HTMLElement>("[data-name]");
  const side = root.querySelector<HTMLElement>(".cts-controls");
  if (!controls || !download || !name) return;
  const names = JSON.parse(name.dataset.names ?? "{}") as Record<string, string>;
  controls.hidden = false;
  side?.classList.add("is-live");

  const update = () => {
    const mode = controls.querySelector<HTMLInputElement>("input[name$='-mode']:checked")!.value as Mode;
    const accent = controls.querySelector<HTMLInputElement>("input[name$='-accent']:checked")!.value as Accent;
    root.dataset.mode = mode;
    root.dataset.accent = accent;
    download.href = themeFile(mode, accent);
    name.textContent = names[`${mode}-${accent}`] ?? "";
  };
  controls.addEventListener("change", update);
  update();
  return () => controls.removeEventListener("change", update);
}
