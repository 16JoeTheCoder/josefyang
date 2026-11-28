import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";
import { ICON_OPTIONS } from "../../components/icons";

export default defineModule({
  id: "off-the-bench",
  name: "Off the bench",
  version: 1,
  description: "White band on About: personal tastes, each an icon, a word and one line.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.heading("Heading", { max: 40, maxLines: 1, fit: 24 }),
    items: f.list("Items", "Item", {
      icon: f.select("Icon", ICON_OPTIONS),
      subheading: f.subheading("Subheading", { max: 30, maxLines: 1 }),
      text: f.body("Text", { max: 160, maxLines: 3 }),
    }, 1, 6),
  },
  defaults: {
    heading: t("Off the bench"),
    items: [
      { icon: "record", subheading: t("Jazz"), text: t("Not the instruments. The calm it puts in the room while I build.") },
      { icon: "cup", subheading: t("Coffee"), text: t("Kopi susu by day. Espresso when a build runs late.") },
      { icon: "watch", subheading: t("Watches"), text: t("Small machines that have to be right every second.") },
      { icon: "ball", subheading: t("Football"), text: t("Captain of the school team.") },
      { icon: "globe", subheading: t("History and geopolitics"), text: t("How countries got to where they are, and why the map keeps changing.") },
    ],
  },
});
