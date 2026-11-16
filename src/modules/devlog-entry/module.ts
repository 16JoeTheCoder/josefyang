import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "devlog-entry",
  name: "Devlog entry layout",
  version: 1,
  description: "One devlog entry: title, date, build tag, hero photo, body paragraphs and images, Fuse note, build link, previous and next. The entry itself is edited under Devlog entries.",
  island: false,
  pages: ["devlog"],
  fields: {
    back: f.label("Back link", { max: 30, maxLines: 1 }),
    fuseLink: f.label("Link to the rough note", { max: 40, maxLines: 1 }),
    buildLink: f.label("Link to the build page", { max: 40, maxLines: 1 }),
    previous: f.label("Previous entry label", { max: 20, maxLines: 1 }),
    next: f.label("Next entry label", { max: 20, maxLines: 1 }),
    minRead: f.label("Read-time suffix", { max: 12, maxLines: 1 }),
    photoEmpty: f.label("Empty photo label", { max: 30, maxLines: 1 }),
    navLabel: f.label("Previous/next navigation name (screen readers)", { max: 30, maxLines: 1 }),
  },
  defaults: {
    back: t("All devlog entries"),
    fuseLink: t("Read the rough notes on Fuse"),
    buildLink: t("Open the build page"),
    previous: t("Previous entry"),
    next: t("Next entry"),
    minRead: t("min read"),
    photoEmpty: t("Entry photo"),
    navLabel: t("More entries"),
  },
});
