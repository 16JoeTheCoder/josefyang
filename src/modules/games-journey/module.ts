import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "games-journey",
  name: "Games journey intro",
  version: 1,
  description: "Opening of the main-site Games page: heading, my words on making games, and a prominent link to the game catalog.",
  island: false,
  pages: ["games"],
  fields: {
    heading: f.giant("Heading", { max: 24, maxLines: 1, fit: 12 }),
    intro: f.body("Intro", { max: 320, maxLines: 6, fit: 260 }),
    browseLabel: f.button("Catalog button", 28),
    browseUrl: f.url("Catalog link (empty = the game site)"),
    browseNote: f.label("Line under the button", { max: 80, maxLines: 2 }),
  },
  defaults: {
    heading: t("Games"),
    intro: t("I've made games since middle school, starting with full games in Scratch. This page is the story of making them. The games themselves live on their own site."),
    browseLabel: t("Browse the games"),
    browseUrl: "",
    browseNote: t("Opens game.josefyang.com"),
  },
});
