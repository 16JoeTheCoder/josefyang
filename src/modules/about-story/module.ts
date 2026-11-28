import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

const NEW_HEADING = "Why I started building";
const NEW_STORY = "When I turned 17 in October 2026, I felt late. People my age already seemed to be making an impact, and I wasn't. So I started learning tools and skills I could actually use to contribute. Somewhere along the way I noticed I was building things, and enjoying it. The projects on this site are what came out of that, including the parts that broke.";

export default defineModule({
  id: "about-story",
  name: "About: my story",
  version: 2,
  description: "Right after the intro on About: why I started building, in my own words, an optional link to the work and an optional 3:2 image with a caption.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.heading("Heading", { max: 40, maxLines: 2, fit: 30 }),
    story: f.body("Story (one paragraph)", { max: 520, maxLines: 10, fit: 420 }),
    image: f.image("Image (optional: only if it shows the work)", "3 / 2", ["fill"], "Photo of the team work or prototype"),
    caption: f.label("Image caption", { max: 120, maxLines: 2 }),
    linkLabel: f.button("Link label (optional)", 28),
    linkUrl: f.url("Link (optional)"),
  },
  defaults: {
    heading: t(NEW_HEADING),
    story: t(NEW_STORY),
    image: noImage("fill"),
    caption: t(""),
    linkLabel: t("See what I've built"),
    linkUrl: "/projects",
  },
  // v1 → v2: the unfilled Greenmech placeholder becomes the approved story; anything Josef wrote is kept.
  migrate: (old, from) => {
    if (from >= 2 || !old || typeof old !== "object") return old;
    const o = { ...(old as Record<string, unknown>) };
    const placeholder = (k: string) => /^\[.*\]$/s.test(((o[k] as { value?: string } | undefined)?.value ?? "").trim());
    if (placeholder("heading") && placeholder("story")) { o.heading = t(NEW_HEADING); o.story = t(NEW_STORY); o.linkLabel = t("See what I've built"); o.linkUrl = "/projects"; }
    return o;
  },
});
