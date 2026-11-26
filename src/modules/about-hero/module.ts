import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

export default defineModule({
  id: "about-hero",
  name: "About: name and bio",
  version: 1,
  description: "Sun-orange top of About: giant heading, bio paragraph and a 4:5 portrait, plus a View CV button when a CV is published.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.giant("Heading", { max: 12, maxLines: 1, fit: 7 }),
    bio: f.body("Bio", { max: 320, maxLines: 7, fit: 260 }),
    cvLabel: f.button("View CV button (only shown once a CV is published)", 18),
    portrait: f.image("Portrait", "4 / 5", ["fill", "fit"], "Portrait, added later"),
  },
  defaults: {
    heading: t("About"),
    bio: t("I'm Josef Yang, seventeen, at St. Johannes Berchmans School in Jakarta. I take AS Physics, Maths and Computer Science, lead the Greenmech team and captain the school football team."),
    cvLabel: t("View CV"),
    portrait: noImage("fill"),
  },
});
