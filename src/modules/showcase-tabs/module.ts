import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

const tab = {
  name: f.pill("Tab name", 22),
  note: f.label("Note", { max: 120, maxLines: 2 }),
  image: f.image("Image", "16 / 9", ["fit", "fill"], "Capture, added in admin"),
};

export default defineModule({
  id: "showcase-tabs",
  name: "Showcase tabs",
  version: 1,
  description: "A row of tab pills that crossfade between 16/9 images with a one-line note. With no JS the first image shows and every note is listed.",
  island: true,
  pages: ["build"],
  fields: {
    heading: f.heading("Heading", { max: 44, maxLines: 2, fit: 34 }),
    body: f.body("Body", { max: 220, maxLines: 4, fit: 170 }),
    tabsLabel: f.label("Screen-reader label for the tabs", { max: 60, maxLines: 1 }),
    tabs: f.list("Tabs", "Tab", tab, 2, 8),
  },
  defaults: {
    heading: t("[Heading]"),
    body: t("[One or two sentences on what the tabs compare.]"),
    tabsLabel: t("Views"),
    tabs: [
      { name: t("[Tab one]"), note: t("[What this tab shows.]"), image: noImage("fit") },
      { name: t("[Tab two]"), note: t("[What this tab shows.]"), image: noImage("fit") },
    ],
  },
});
