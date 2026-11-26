/**
 * Showcase switch: crossfades between two states (GSAP). Both states are visible stacked without JS;
 * once mounted they share one cell. The note is announced through a status region.
 * Reduced motion swaps instantly.
 */
import { reducedMotion, type Unmount } from "../../core/island";
import { showPanel, warmImages } from "../../components/showcase/fade";

export function mountSwitch(root: HTMLElement): Unmount | void {
  const stage = root.querySelector<HTMLElement>("[data-stage]");
  const panels = [...root.querySelectorAll<HTMLElement>("[data-state]")];
  const actions = root.querySelector<HTMLElement>("[data-actions]");
  const go = root.querySelector<HTMLButtonElement>("[data-go]");
  const replay = root.querySelector<HTMLButtonElement>("[data-replay]");
  const status = root.querySelector<HTMLElement>("[data-status]");
  if (!stage || panels.length !== 2 || !actions || !go || !replay) return;

  stage.dataset.ready = "true";
  actions.hidden = false;
  showPanel(panels, 0, true);
  warmImages(stage);

  const to = (i: 0 | 1) => {
    showPanel(panels, i, reducedMotion());
    go.hidden = i === 1;
    replay.hidden = i === 0;
    (i === 1 ? replay : go).focus({ preventScroll: true });
    if (status) status.textContent = panels[i]!.querySelector(".ss-note")?.textContent ?? "";
  };
  const onGo = () => to(1);
  const onReplay = () => to(0);
  go.addEventListener("click", onGo);
  replay.addEventListener("click", onReplay);
  return () => {
    go.removeEventListener("click", onGo);
    replay.removeEventListener("click", onReplay);
  };
}
