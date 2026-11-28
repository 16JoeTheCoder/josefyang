import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

const item = (name: string, text: string, linkLabel = "", linkUrl = "") =>
  ({ name: t(name), text: t(text), image: noImage("fill", ""), linkLabel: t(linkLabel), linkUrl });

export default defineModule({
  id: "on-my-bench",
  name: "On my bench",
  version: 1,
  description: "One stage with four selectors for the interests I keep coming back to. Each has a label, a description and an optional published image and link. Readable as a plain list without JavaScript; with no image it uses a text-only composition.",
  island: true,
  pages: ["home"],
  fields: {
    heading: f.heading("Heading", { max: 30, maxLines: 1, fit: 20 }),
    line: f.body("Line under the heading", { max: 120, maxLines: 2, fit: 90 }),
    skipLabel: f.label("Skip link in the first screen (goes to this section)", { max: 34, maxLines: 1 }),
    tabsLabel: f.label("Screen-reader name for the four selectors", { max: 50, maxLines: 1 }),
    focus: f.select("What I'm focusing on right now (optional)", [
      { value: "", label: "Nothing marked" },
      { value: "0", label: "First item" },
      { value: "1", label: "Second item" },
      { value: "2", label: "Third item" },
      { value: "3", label: "Fourth item" },
    ]),
    focusLabel: f.label("Label on the focused item", { max: 28, maxLines: 1 }),
    items: f.list("Interests", "Interest", {
      name: f.subheading("Name", { max: 24, maxLines: 1, fit: 20 }),
      text: f.body("What it is, in my words", { max: 220, maxLines: 5, fit: 180 }),
      image: f.image("Image or screenshot (optional)", "4 / 3", ["fill", "fit"], "No image yet"),
      linkLabel: f.button("Link label (optional)", 28),
      linkUrl: f.url("Link (optional)"),
    }, 4, 4),
  },
  defaults: {
    heading: t("On my bench"),
    line: t("Four things I keep coming back to. Some are finished work, some I'm still learning."),
    skipLabel: t("Skip to what I'm working on"),
    tabsLabel: t("Things I work on"),
    focus: "",
    focusLabel: t("My focus right now"),
    items: [
      item("Websites", "I make websites, this one included. I care about clear type, real content and pages that load fast on a phone.", "See the projects", "/projects"),
      item("Games", "I make games. It started with full games in Scratch in middle school, and I still build them.", "Follow the games", "/games"),
      item("Python simulations", "I'm learning Python with Harvard's CS50P as a starting point. The goal is my own simulations of systems I can model and predict."),
      item("ESP32 electronics", "I'm learning basic electronics with an ESP32, so the software I write can connect to real hardware."),
    ],
  },
});
