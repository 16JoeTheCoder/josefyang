import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

export default defineModule({
  id: "home-hero",
  name: "Home hero",
  version: 1,
  description: "Granite floor hero: headline, line, social pills, B&W portrait cut-out, cappuccino and phone on the floor.",
  island: false,
  pages: ["home"],
  fields: {
    headline: f.giant("Headline", { max: 60, maxLines: 2, fit: 42 }),
    line: f.body("Line under the headline", { max: 80, maxLines: 1, fit: 64 }),
    portrait: f.image("Portrait cut-out (colour original, shown B&W)", "11 / 12", ["object", "fill"], "Portrait cut-out, black and white"),
    showCoffee: f.toggle("Show the cappuccino"),
    showPhone: f.toggle("Show the phone playing jazz"),
    phoneTitle: f.label("Phone: title", { max: 16, maxLines: 1 }),
    phoneTrack: f.label("Phone: track", { max: 30, maxLines: 1 }),
  },
  defaults: {
    headline: t("Josef Yang builds hardware and software"),
    line: t("Student engineer. Jakarta. Building since October 2026."),
    portrait: noImage("object"),
    showCoffee: true,
    showPhone: true,
    phoneTitle: t("Now playing"),
    phoneTrack: t("[Jazz track]"),
  },
});
