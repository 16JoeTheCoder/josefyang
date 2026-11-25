import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

const item = {
  image: f.image("Wide capture", "16 / 3", ["fit", "fill"], "Wide capture, added in admin"),
  title: f.subheading("Title", { max: 36, maxLines: 2, fit: 28 }),
  body: f.body("Sentence", { max: 160, maxLines: 3, fit: 120 }),
};

export default defineModule({
  id: "showcase-figures",
  name: "Showcase figures",
  version: 1,
  description: "Heading and body above up to four wide figures, each with an image, a title and a sentence.",
  island: false,
  pages: ["build"],
  fields: {
    heading: f.heading("Heading", { max: 44, maxLines: 2, fit: 34 }),
    body: f.body("Body", { max: 200, maxLines: 4, fit: 150 }),
    items: f.list("Figures", "Figure", item, 1, 4),
  },
  defaults: {
    heading: t("[Heading]"),
    body: t("[One sentence introducing the figures.]"),
    items: [
      { image: noImage("fit"), title: t("[Figure title]"), body: t("[One sentence on what the figure shows.]") },
      { image: noImage("fit"), title: t("[Figure title]"), body: t("[One sentence on what the figure shows.]") },
    ],
  },
});
