import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

export default defineModule({
  id: "about-hero",
  name: "About: name and bio",
  version: 1,
  description: "Charcoal opening with a name, portrait and short introduction, plus a View CV button when a CV is published.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.giant("Heading", { max: 36, maxLines: 2, fit: 24 }),
    introduction: f.body("What you build", { max: 120, maxLines: 3, fit: 95 }),
    bio: f.body("Bio", { max: 320, maxLines: 7, fit: 260 }),
    cvLabel: f.button("View CV button (only shown once a CV is published)", 18),
    portrait: f.image("Portrait", "4 / 5", ["fill", "fit"], "Portrait, added later"),
    samplesHeading: f.label("Work samples heading", { max: 45, maxLines: 1 }),
  },
  defaults: {
    heading: t("Josef Yang"),
    introduction: t("I build software and hardware to see how ideas hold up in practice."),
    bio: t("I'm Josef Yang, seventeen, at St. Johannes Berchmans School in Jakarta. I take AS Physics, Maths and Computer Science, lead the Greenmech team and captain the school football team."),
    cvLabel: t("View CV"),
    portrait: noImage("fill"),
    samplesHeading: t("From the workbench"),
  },
});
