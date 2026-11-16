import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

export default defineModule({
  id: "print-rig",
  name: "The print rig (Still printing)",
  version: 1,
  description: "About gimmick: a rod-and-clamp rig printing a figure of Josef, one layer per published milestone. Shows the current print state with reduced motion.",
  island: true,
  pages: ["about"],
  fields: {
    heading: f.heading("Heading", { max: 24, maxLines: 1 }),
    line: f.body("Line", { max: 140, maxLines: 3 }),
    plannedLayers: f.number("Layers in the finished figure", 4, 40),
    figure: f.image("Figure being printed (cut-out)", "3 / 4", ["object", "fill"], "Figure, added later"),
    layersLabel: f.label("Counter suffix (e.g. 'layers printed')", { max: 24, maxLines: 1 }),
  },
  defaults: {
    heading: t("Still printing"),
    line: t("Each milestone prints one layer as you scroll. There aren't many yet, and that's the point."),
    plannedLayers: 12,
    figure: noImage("object"),
    layersLabel: t("layers printed"),
  },
});
