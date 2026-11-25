import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "devlog-intro",
  name: "Devlog intro",
  version: 1,
  description: "Devlog page top: giant Devlog, line, an optional dated Now line, the 'Want the raw version?' card (the next step while the feed is empty), and the latest entry featured.",
  island: false,
  pages: ["devlog"],
  fields: {
    heading: f.giant("Heading", { max: 16, maxLines: 1, fit: 10 }),
    line: f.body("Line", { max: 140, maxLines: 3 }),
    nowLabel: f.label("Now line label", { max: 12, maxLines: 1 }),
    nowDate: f.date("Now: date of the update"),
    nowText: f.body("Now: what I'm working on (short; line is hidden until date and text are both filled)", { max: 140, maxLines: 2 }),
    rawTitle: f.subheading("Raw card title", { max: 30, maxLines: 1 }),
    rawText: f.body("Raw card text", { max: 140, maxLines: 4 }),
    rawEmptyText: f.body("Raw card text while there are no entries yet", { max: 140, maxLines: 4 }),
    rawLink: f.label("Raw card link text", { max: 30, maxLines: 1 }),
    latestLabel: f.label("Featured entry label (before the date)", { max: 20, maxLines: 1 }),
    minRead: f.label("Read-time suffix", { max: 12, maxLines: 1 }),
    photoEmpty: f.label("Empty photo label", { max: 30, maxLines: 1 }),
  },
  defaults: {
    heading: t("Devlog"),
    line: t("Notes on what I'm building and testing."),
    nowLabel: t("Now"),
    nowDate: "",
    nowText: t(""),
    rawTitle: t("Want the raw version?"),
    rawText: t("Every entry starts as a rough note in Fuse, my engineering diary. Messier, more honest, updated daily."),
    rawEmptyText: t("No entries are written up yet. The raw notes are in Fuse, my engineering diary."),
    rawLink: t("Open fuse.josefyang.com"),
    latestLabel: t("Latest,"),
    minRead: t("min read"),
    photoEmpty: t("Latest entry photo"),
  },
});
