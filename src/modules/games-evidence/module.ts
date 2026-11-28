import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

export default defineModule({
  id: "games-evidence",
  name: "Games: how I make them",
  version: 1,
  description: "Evidence of game-making: up to four short items, each with an optional image and link. Only real work goes here.",
  island: false,
  pages: ["games"],
  fields: {
    heading: f.heading("Heading", { max: 40, maxLines: 2, fit: 30 }),
    items: f.list("Evidence", "Item", {
      title: f.subheading("Title", { max: 40, maxLines: 2, fit: 32 }),
      text: f.body("What happened", { max: 240, maxLines: 5, fit: 200 }),
      image: f.image("Image (optional)", "16 / 10", ["fill", "fit"], "No image yet"),
      linkLabel: f.button("Link label (optional)", 28),
      linkUrl: f.url("Link (optional)"),
    }, 0, 4),
  },
  defaults: {
    heading: t("Where it started"),
    items: [
      { title: t("Full games in Scratch"), text: t("In middle school I built complete games in Scratch. It was the first time I made something other people could play."), image: noImage("fill", ""), linkLabel: t(""), linkUrl: "" },
    ],
  },
});
