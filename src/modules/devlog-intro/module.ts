import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "devlog-intro",
  name: "Devlog intro",
  version: 1,
  description: "Devlog opening with the latest entry, an archive jump, and an optional current work update.",
  island: false,
  pages: ["devlog"],
  fields: {
    heading: f.giant("Heading", { max: 16, maxLines: 1, fit: 10 }),
    line: f.body("Line", { max: 140, maxLines: 3 }),
    noEntries: f.body("Shown when there are no entries", { max: 100, maxLines: 2 }),
    nowLabel: f.label("Now line label", { max: 12, maxLines: 1 }),
    nowDate: f.date("Now: date of the update"),
    nowText: f.body("Now: what I'm working on (short; line is hidden until date and text are both filled)", { max: 140, maxLines: 2 }),
    archiveLink: f.label("Archive jump text", { max: 30, maxLines: 1 }),
    readLabel: f.label("Read latest entry action", { max: 30, maxLines: 1 }),
    latestLabel: f.label("Featured entry label (before the date)", { max: 20, maxLines: 1 }),
    minRead: f.label("Read-time suffix", { max: 12, maxLines: 1 }),
    photoEmpty: f.label("Empty photo label", { max: 30, maxLines: 1 }),
  },
  defaults: {
    heading: t("Devlog"),
    line: t("Notes on what I'm building and testing."),
    noEntries: t("The first entry is still being written."),
    nowLabel: t("Now"),
    nowDate: "",
    nowText: t(""),
    archiveLink: t("Browse the archive"),
    readLabel: t("Read the entry"),
    latestLabel: t("Latest,"),
    minRead: t("min read"),
    photoEmpty: t("Latest entry photo"),
  },
});
