import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "featured-floor",
  name: "Featured builds floor",
  version: 1,
  description: "The featured builds workbench. Scroll and arrow controls move the camera between builds. Reduced motion keeps the same controls with immediate changes.",
  island: true,
  pages: ["home"],
  fields: {
    stageLabel: f.label("Screen-reader label for the floor", { max: 60, maxLines: 1 }),
    hardware: f.label("Kind: hardware", { max: 16, maxLines: 1 }),
    software: f.label("Kind: software", { max: 16, maxLines: 1 }),
    viewButton: f.button("Button on each build"),
    skipLabel: f.label("Skip link", { max: 24, maxLines: 1 }),
    keysHint: f.label("Keyboard hint", { max: 60, maxLines: 1 }),
    emptyNote: f.body("Shown when no build is featured yet", { max: 120, maxLines: 2 }),
    prevLabel: f.label("Previous project (screen readers)", { max: 24, maxLines: 1 }),
    nextLabel: f.label("Next project (screen readers)", { max: 24, maxLines: 1 }),
    showWatch: f.toggle("Show the watch on the floor"),
    watchLabel: f.label("Watch description (screen readers)", { max: 60, maxLines: 1 }),
  },
  defaults: {
    stageLabel: t("Featured builds on the floor"),
    hardware: t("Hardware"),
    software: t("Software"),
    viewButton: t("View project"),
    skipLabel: t("Skip to the rest"),
    keysHint: t("Scroll or use the arrow keys to move between builds."),
    emptyNote: t("Featured builds land here once they are published."),
    prevLabel: t("Previous project"),
    nextLabel: t("Next project"),
    showWatch: true,
    watchLabel: t("A wristwatch on the floor, showing the time"),
  },
});

