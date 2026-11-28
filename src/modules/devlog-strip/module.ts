import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "devlog-strip",
  name: "From the devlog",
  version: 2,
  description: "The latest ten entries with a sticky desktop reading rail and an archive link.",
  island: true,
  pages: ["home"],
  fields: {
    heading: f.heading("Heading", { max: 34, maxLines: 1, fit: 22 }),
    line: f.body("Line", { max: 90, maxLines: 2 }),
    button: f.button("Button label"),
    inLabel: f.label("Word between date and build (e.g. 'in')", { max: 6, maxLines: 1 }),
    photoEmpty: f.label("Empty photo label", { max: 30, maxLines: 1 }),
    emptyNote: f.body("Shown when there are no entries yet", { max: 120, maxLines: 2 }),
  },
  migrate: (old) => {
    const record = old as { emptyNote?: { value?: string } } | undefined;
    return record?.emptyNote?.value === "No entries are written up yet. The raw notes are in Fuse." ? { ...record, emptyNote: t("The first entry is still being written.") } : old;
  },
  defaults: {
    heading: t("From the devlog"),
    line: t("Notes on what I'm building and testing."),
    button: t("View the devlog"),
    inLabel: t("in"),
    photoEmpty: t("Photo"),
    emptyNote: t("The first entry is still being written."),
  },
});
