import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "devlog-intro",
  name: "Devlog intro",
  version: 1,
  description: "Devlog page top: giant Devlog, line, the 'Want the raw version?' card, and the latest entry featured.",
  island: false,
  pages: ["devlog"],
  fields: {
    heading: f.giant("Heading", { max: 16, maxLines: 1, fit: 10 }),
    line: f.body("Line", { max: 140, maxLines: 3 }),
    rawTitle: f.subheading("Raw card title", { max: 30, maxLines: 1 }),
    rawText: f.body("Raw card text", { max: 140, maxLines: 4 }),
    rawLink: f.label("Raw card link text", { max: 30, maxLines: 1 }),
    latestLabel: f.label("Featured entry label (before the date)", { max: 20, maxLines: 1 }),
    minRead: f.label("Read-time suffix", { max: 12, maxLines: 1 }),
    photoEmpty: f.label("Empty photo label", { max: 30, maxLines: 1 }),
  },
  defaults: {
    heading: t("Devlog"),
    line: t("What I built, what broke, what I'd change. Written up twice a month from my notes."),
    rawTitle: t("Want the raw version?"),
    rawText: t("Every entry starts as a rough note in Fuse, my engineering diary. Messier, more honest, updated daily."),
    rawLink: t("Open fuse.josefyang.com"),
    latestLabel: t("Latest,"),
    minRead: t("min read"),
    photoEmpty: t("Latest entry photo"),
  },
});
