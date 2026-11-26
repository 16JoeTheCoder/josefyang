import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

export default defineModule({
  id: "about-story",
  name: "About: Greenmech story",
  version: 1,
  description: "White section on About, right after the intro: a heading, one paragraph (the task, your role, one decision, what changed) and an optional 3:2 image with a caption.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.heading("Heading", { max: 40, maxLines: 2, fit: 30 }),
    story: f.body("Story (one paragraph)", { max: 520, maxLines: 10, fit: 420 }),
    image: f.image("Image (optional: only if it shows the work)", "3 / 2", ["fill"], "Photo of the team work or prototype"),
    caption: f.label("Image caption", { max: 120, maxLines: 2 }),
  },
  defaults: {
    heading: t("[Heading for the Greenmech story]"),
    story: t("[One paragraph, in your own words: the task the Greenmech team was given, what you were responsible for, one specific decision or test you made, and what changed because of it. Only facts you can stand behind.]"),
    image: noImage("fill"),
    caption: t(""),
  },
});
