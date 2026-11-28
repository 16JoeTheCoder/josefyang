import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "devlog-entry",
  name: "Devlog entry layout",
  version: 1,
  description: "One devlog entry: title, date, build tag, hero photo, body paragraphs and images, build link, previous and next. The entry itself is edited under Devlog entries.",
  island: false,
  pages: ["devlog"],
  fields: {
    noteLabel: f.label("Note label", { max: 16, maxLines: 1 }),
    articleLabel: f.label("Article label", { max: 16, maxLines: 1 }),
    back: f.label("Back link", { max: 30, maxLines: 1 }),
    buildLink: f.label("Link to the build page", { max: 40, maxLines: 1 }),
    previous: f.label("Previous entry label", { max: 20, maxLines: 1 }),
    next: f.label("Next entry label", { max: 20, maxLines: 1 }),
    minRead: f.label("Read-time suffix", { max: 12, maxLines: 1 }),
    photoEmpty: f.label("Empty photo label", { max: 30, maxLines: 1 }),
    navLabel: f.label("Previous/next navigation name (screen readers)", { max: 30, maxLines: 1 }),
  },
  defaults: {
    noteLabel: t("Note"),
    articleLabel: t("Article"),
    back: t("All devlog entries"),
    buildLink: t("Open the build page"),
    previous: t("Previous entry"),
    next: t("Next entry"),
    minRead: t("min read"),
    photoEmpty: t("Entry photo"),
    navLabel: t("More entries"),
  },
});
