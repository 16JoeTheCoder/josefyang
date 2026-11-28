import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

const state = {
  image: f.image("Capture", "16 / 9", ["fit", "fill"], "Capture, added in admin"),
  title: f.subheading("Title", { max: 40, maxLines: 1, fit: 32 }),
  note: f.body("Note", { max: 140, maxLines: 3, fit: 110 }),
};

export default defineModule({
  id: "showcase-switch",
  name: "Showcase switch",
  version: 2,
  description: "Two matching states (image, title, note) with a button that crossfades between them, a numbered steps list and a footnote.",
  island: true,
  pages: ["build"],
  fields: {
    anchor: f.label("Link anchor (no #, optional)", { max: 30, maxLines: 1 }),
    heading: f.heading("Heading", { max: 44, maxLines: 2, fit: 34 }),
    body: f.body("Body", { max: 200, maxLines: 4, fit: 150 }),
    linkLabel: f.label("Link text", { max: 44, maxLines: 1 }),
    linkUrl: f.url("Link URL"),
    before: f.group("State 1 (before)", state),
    after: f.group("State 2 (after)", state),
    goLabel: f.button("Button: show state 2", 30),
    replayLabel: f.button("Button: back to state 1", 30),
    steps: f.list("Steps", "Step", {
      title: f.subheading("Step title", { max: 28, maxLines: 2, fit: 22 }),
      body: f.label("Step text", { max: 110, maxLines: 3 }),
    }, 0, 5),
    footnote: f.body("Footnote", { max: 220, maxLines: 3, fit: 180 }),
  },
  defaults: {
    anchor: t(""),
    heading: t("[Heading]"),
    body: t("[One or two sentences on what the switch shows.]"),
    linkLabel: t(""),
    linkUrl: "",
    before: { image: noImage("fit"), title: t("[State 1 title]"), note: t("[What state 1 shows.]") },
    after: { image: noImage("fit"), title: t("[State 2 title]"), note: t("[What state 2 shows.]") },
    goLabel: t("Show the switch"),
    replayLabel: t("Replay the switch"),
    steps: [],
    footnote: t(""),
  },
  migrate: (old) => old,
});
