/** Click-to-play for components/Video.astro. Nothing loads or plays before the click. */
import type { Unmount } from "../../core/island";

export function mountVideo(root: HTMLElement): Unmount | void {
  const video = root.querySelector<HTMLVideoElement>("[data-video]");
  const play = root.querySelector<HTMLAnchorElement>("[data-play]");
  const poster = root.querySelector<HTMLElement>(".video-poster");
  const status = root.querySelector<HTMLElement>("[data-video-status]");
  if (!video || !play) return;
  const onClick = async (e: Event) => {
    e.preventDefault();
    play.setAttribute("aria-disabled", "true");
    video.src = video.dataset.src!;
    video.hidden = false;
    if (poster) poster.style.visibility = "hidden";
    try {
      await video.play();
      play.hidden = true;
      video.focus();
    } catch {
      video.hidden = true;
      if (poster) poster.style.visibility = "";
      if (status) status.textContent = status.dataset.fail ?? "";
    } finally {
      play.removeAttribute("aria-disabled");
    }
  };
  play.addEventListener("click", onClick);
  return () => { play.removeEventListener("click", onClick); video.pause(); };
}
