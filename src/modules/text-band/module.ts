import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "text-band",
  name: "Black band: I started building",
  version: 1,
  description: "Black band on About: a giant statement left, three honest paragraphs right.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.giant("Heading", { max: 50, maxLines: 3, fit: 38 }),
    paragraphs: f.list("Paragraphs", "Paragraph", { text: f.body("Paragraph", { max: 300, maxLines: 6 }) }, 1, 4),
  },
  defaults: {
    heading: t("I started building in October 2026."),
    paragraphs: [
      { text: t("I made full games in Scratch as a kid, then mostly studied. In October 2026 I started building real things: simulators, apps, machines with Greenmech.") },
      { text: t("So this site isn't a highlight reel. It's a public record of learning engineering from close to zero, failures included.") },
      { text: t("I like problems big enough to predict with physics. I'm aiming for an engineering degree abroad.") },
    ],
  },
});
