import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

export default defineModule({
  id: "print-rig",
  name: "About: timeline",
  version: 2,
  description: "Chronological milestones with an optional photo, scan or project link against each matching title.",
  island: true,
  pages: ["about"],
  fields: {
    heading: f.heading("Heading", { max: 24, maxLines: 1 }),
    line: f.body("Line", { max: 140, maxLines: 3 }),
    plannedLayers: f.number("Legacy layer count", 4, 40),
    figure: f.image("Optional miniature portrait", "3 / 4", ["object", "fill"], "Miniature figure"),
    layersLabel: f.label("Legacy layer label", { max: 24, maxLines: 1 }),
    evidenceLink: f.label("Default evidence link label", { max: 35, maxLines: 1 }),
    evidence: f.list("Milestone evidence", "Evidence", {
      milestone: f.label("Enter the exact milestone title", { max: 120, maxLines: 2 }),
      image: f.image("Photo or scan", "16 / 9", ["fill", "fit"], "Milestone photo or scan"),
      url: f.url("Related project or source (optional)"),
      linkLabel: f.label("Link label (optional)", { max: 40, maxLines: 2 }),
    }, 0, 30),
  },
  migrate: (old) => {
    if (!old || typeof old !== "object") return old;
    const data = { ...old } as { heading?: { value?: string }; line?: { value?: string } };
    if (data.heading?.value === "Still printing") data.heading = t("How I got here");
    if (data.line?.value?.startsWith("Each milestone prints one layer")) {
      data.line = t("A short timeline of what I’ve made and learned.");
    }
    return data;
  },
  defaults: {
    heading: t("How I got here"),
    line: t("A short timeline of what I’ve made and learned."),
    plannedLayers: 12,
    figure: noImage("object"),
    layersLabel: t("layers printed"),
    evidenceLink: t("View supporting work"),
    evidence: [],
  },
});
