import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "build-selector",
  name: "Pick a build (character select)",
  version: 1,
  description: "Projects page: every published build in a sideways selector on black, lit by a desk lamp. Enter, Space or the button locks in and opens the build.",
  island: true,
  pages: ["projects"],
  fields: {
    heading: f.giant("Heading", { max: 24, maxLines: 1, fit: 14 }),
    benchPrefix: f.label("Bench line (before the build name)", { max: 30, maxLines: 1 }),
    benchLink: f.label("Bench link text", { max: 24, maxLines: 1 }),
    hardware: f.label("Kind: hardware", { max: 16, maxLines: 1 }),
    software: f.label("Kind: software", { max: 16, maxLines: 1 }),
    openButton: f.button("Open button"),
    prevLabel: f.label("Previous button (screen readers)", { max: 24, maxLines: 1 }),
    nextLabel: f.label("Next button (screen readers)", { max: 24, maxLines: 1 }),
    hint: f.label("Hint (before the count)", { max: 80, maxLines: 1 }),
    ofWord: f.label("Word in the count (2 of 8)", { max: 6, maxLines: 1 }),
    emptyNote: f.body("Shown when no build is published", { max: 120, maxLines: 2 }),
  },
  defaults: {
    heading: t("Pick a build"),
    benchPrefix: t("On the bench now:"),
    benchLink: t("Read the devlog"),
    hardware: t("Hardware"),
    software: t("Software"),
    openButton: t("Open this build"),
    prevLabel: t("Previous build"),
    nextLabel: t("Next build"),
    hint: t("Scroll or use the arrow keys to browse. Enter opens."),
    ofWord: t("of"),
    emptyNote: t("The first builds are on their way."),
  },
});
