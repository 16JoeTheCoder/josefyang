import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";
import { ICON_OPTIONS } from "../../components/icons";

export default defineModule({
  id: "about-me-grid",
  name: "A bit about me",
  version: 1,
  description: "White section: about Josef as a person, a 3 × 2 grid of icon, heading and two lines.",
  island: false,
  pages: ["home"],
  fields: {
    heading: f.heading("Heading", { max: 50, maxLines: 2, fit: 40 }),
    items: f.list("Items", "Item", {
      icon: f.select("Icon", ICON_OPTIONS),
      title: f.subheading("Title", { max: 32, maxLines: 1, fit: 28 }),
      text: f.body("Text", { max: 140, maxLines: 3, fit: 120 }),
    }, 1, 6),
  },
  defaults: {
    heading: t("A bit about me, off the record"),
    items: [
      { icon: "wrench", title: t("I learn by breaking things"), text: t("Most of what I know came from something not working the first time. The failures page is there on purpose.") },
      { icon: "notes", title: t("I build my own systems"), text: t("I plan my days in an app I made and keep my notes in another. If a tool doesn't fit how I think, I build one.") },
      { icon: "globe", title: t("I like problems I can predict"), text: t("Big physical systems you can model and check. That's the part of physics that pulls me in.") },
      { icon: "record", title: t("Jazz on, after dark"), text: t("Not for the instruments. For the calm. Most builds happen late with a record going.") },
      { icon: "cup", title: t("Kopi first"), text: t("Kopi susu in the day, espresso when a build runs late. There's a cup in almost every photo.") },
      { icon: "watch", title: t("Watches, and the pitch"), text: t("I love small machines that must be right every second. And I captain the school football team.") },
    ],
  },
});
