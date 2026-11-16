import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "featured-floor",
  name: "Featured builds floor",
  version: 1,
  description: "The Home floor: featured builds scattered on granite; scrolling pans the camera from build to build. Vertical list on phones and with reduced motion.",
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
    showWatch: true,
    watchLabel: t("A wristwatch on the floor, showing the time"),
  },
});
