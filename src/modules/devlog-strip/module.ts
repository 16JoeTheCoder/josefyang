import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "devlog-strip",
  name: "From the devlog",
  version: 1,
  description: "White section: heading, line, View the devlog button and a horizontal row of the latest 5 entries.",
  island: false,
  pages: ["home"],
  fields: {
    heading: f.heading("Heading", { max: 34, maxLines: 1, fit: 22 }),
    line: f.body("Line", { max: 90, maxLines: 2 }),
    button: f.button("Button label"),
    inLabel: f.label("Word between date and build (e.g. 'in')", { max: 6, maxLines: 1 }),
    photoEmpty: f.label("Empty photo label", { max: 30, maxLines: 1 }),
    emptyNote: f.body("Shown when there are no entries yet", { max: 120, maxLines: 2 }),
    emptyLink: f.label("Fuse link while there are no entries (needs the Fuse URL in Settings)", { max: 30, maxLines: 1 }),
  },
  defaults: {
    heading: t("From the devlog"),
    line: t("Notes on what I'm building and testing."),
    button: t("View the devlog"),
    inLabel: t("in"),
    photoEmpty: t("Photo"),
    emptyNote: t("No entries are written up yet. The raw notes are in Fuse."),
    emptyLink: t("Open Fuse"),
  },
});
