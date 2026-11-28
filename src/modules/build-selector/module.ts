import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "build-selector",
  name: "Pick a build (character select)",
  version: 2,
  description: "Responsive project gallery. Wheel, swipe or arrows browse the builds. Selection scrolls to an inline overview with the full case study link.",
  island: true,
  pages: ["projects"],
  fields: {
    heading: f.giant("Heading", { max: 24, maxLines: 1, fit: 14 }),
    plainHeading: f.giant("Heading when zero or one build is published", { max: 24, maxLines: 1, fit: 14 }),
    benchPrefix: f.label("Bench line (before the build name)", { max: 30, maxLines: 1 }),
    benchLink: f.label("Bench link text", { max: 24, maxLines: 1 }),
    hardware: f.label("Kind: hardware", { max: 16, maxLines: 1 }),
    software: f.label("Kind: software", { max: 16, maxLines: 1 }),
    selectButton: f.button("Select button", 24),
    openButton: f.button("Case study link"),
    returnButton: f.button("Return to the project gallery", 24),
    prevLabel: f.label("Previous button (screen readers)", { max: 24, maxLines: 1 }),
    nextLabel: f.label("Next button (screen readers)", { max: 24, maxLines: 1 }),
    hint: f.label("Hint (before the count)", { max: 80, maxLines: 1 }),
    ofWord: f.label("Word in the count (2 of 8)", { max: 6, maxLines: 1 }),
    emptyNote: f.body("Shown when no build is published", { max: 120, maxLines: 2 }),
    emptyLink: f.button("Link shown when no build is published (goes to About)", 22),
  },
  migrate: (old) => {
    if (!old || typeof old !== "object") return old;
    const content = old as { hint?: { value?: string } };
    return content.hint?.value === "Scroll or use the arrow keys to browse. Enter opens."
      ? { ...content, hint: t("Scroll, swipe or use the arrow keys. Enter opens the overview.") }
      : old;
  },
  defaults: {
    heading: t("Pick a build"),
    plainHeading: t("Projects"),
    benchPrefix: t("On the bench now:"),
    benchLink: t("Read the devlog"),
    hardware: t("Hardware"),
    software: t("Software"),
    selectButton: t("Project overview"),
    openButton: t("Open this build"),
    returnButton: t("Back to projects"),
    prevLabel: t("Previous build"),
    nextLabel: t("Next build"),
    hint: t("Scroll, swipe or use the arrow keys. Enter opens the overview."),
    ofWord: t("of"),
    emptyNote: t("No builds are published yet. The first ones are on their way."),
    emptyLink: t("Read about me"),
  },
});
