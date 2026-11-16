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
  description: "Soft grey section with the Chronos and Fuse blocks (screenshot, headline, text, stat row, one button each).",
  island: false,
  pages: ["home"],
  fields: {
    heading: f.heading("Heading", { max: 44, maxLines: 2, fit: 36 }),
    line: f.body("Line", { max: 90, maxLines: 1 }),
    first: f.group("First block (Chronos)", block),
    second: f.group("Second block (Fuse, mirrored)", block),
  },
  defaults: {
    heading: t("I run my life on tools I built"),
    line: t("Both are in daily use. Both are open to look at."),
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
      name: t("Fuse"),
      headline: t("My engineering diary, unfiltered"),
      text: t("The rough version of everything: half-finished builds, notes and honest mistakes. A web app that works on any device."),
      image: noImage("fill"),
      stats: [{ icon: "devices", label: t("Desktop, laptop and phone") }, { icon: "globe", label: t("fuse.josefyang.com") }],
      button: t("Open Fuse"),
      url: "https://fuse.josefyang.com",
    },
  },
});
