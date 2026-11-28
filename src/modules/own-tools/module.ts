import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";
import { ICON_OPTIONS } from "../../components/icons";

const block = {
  name: f.subheading("Name", { max: 24, maxLines: 1 }),
  headline: f.heading("Headline", { max: 44, maxLines: 2, fit: 34 }),
  text: f.body("Text", { max: 220, maxLines: 4, fit: 180 }),
  image: f.image("Screenshot", "16 / 10", ["fill", "fit"], "Screenshot, added in admin"),
  stats: f.list("Stat row", "Stat", { icon: f.select("Icon", ICON_OPTIONS), label: f.label("Label", { max: 34, maxLines: 2 }) }, 0, 3),
  button: f.button("Button label"),
  url: f.url("Button link"),
};

export default defineModule({
  id: "own-tools",
  name: "I run my life on tools I built",
  version: 1,
  description: "Show tools with a screenshot, a description and a link.",
  island: false,
  pages: ["home"],
  fields: {
    heading: f.heading("Heading", { max: 44, maxLines: 2, fit: 36 }),
    line: f.body("Line", { max: 90, maxLines: 1 }),
    first: f.group("First block (Chronos)", block),
    second: f.group("Optional second tool", block),
  },
  defaults: {
    heading: t("I run my life on tools I built"),
    line: t("Tools I use in my own work."),
    first: {
      name: t("Chronos"),
      headline: t("My day, planned to the block"),
      text: t("A Windows desktop app for my schedule, tasks and focus timer. A phone version is next."),
      image: noImage("fill"),
      stats: [{ icon: "monitor", label: t("Windows desktop") }, { icon: "phone-soon", label: t("Phone app coming soon") }],
      button: t("View project"),
      url: "/builds/chronos",
    },
    second: {
      name: t(""),
      headline: t(""),
      text: t(""),
      image: noImage("fill"),
      stats: [],
      button: t("View project"),
      url: "",
    },
  },
});
