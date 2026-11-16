import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "devlog-feed",
  name: "Devlog entries by month",
  version: 1,
  description: "Filter chips by build, then entries grouped by month with a giant sticky month numeral. Each card pairs the polished entry with its rough Fuse note.",
  island: false,
  pages: ["devlog"],
  fields: {
    allChip: f.pill("Filter: all"),
    failuresChip: f.pill("Filter: failures"),
    filterLabel: f.label("Filter group label (screen readers)", { max: 40, maxLines: 1 }),
    roughNotes: f.label("Link to the Fuse note", { max: 30, maxLines: 1 }),
    photoEmpty: f.label("Empty photo label", { max: 30, maxLines: 1 }),
    emptyNote: f.body("Shown when there are no entries", { max: 120, maxLines: 2 }),
  },
  defaults: {
    allChip: t("All"),
    failuresChip: t("Failures"),
    filterLabel: t("Filter entries by build"),
    roughNotes: t("Rough notes on Fuse"),
    photoEmpty: t("Photo"),
    emptyNote: t("The first entries are being written up."),
  },
});
