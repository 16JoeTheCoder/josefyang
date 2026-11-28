import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "games-updates",
  name: "Games: updates",
  version: 1,
  description: "Up to six published, due, main-site Devlog entries tied to a game, newest first, plus a link to the full Devlog. Honest empty state.",
  island: false,
  pages: ["games"],
  fields: {
    heading: f.heading("Heading", { max: 40, maxLines: 1, fit: 28 }),
    line: f.body("Line", { max: 120, maxLines: 2 }),
    emptyNote: f.body("Shown when there are no game updates", { max: 140, maxLines: 2 }),
    allLabel: f.button("Link to the Devlog", 24),
    gameLabel: f.label("Word before a game name (e.g. 'Game:')", { max: 12, maxLines: 1 }),
  },
  defaults: {
    heading: t("Updates from making them"),
    line: t("Devlog entries about the games, newest first."),
    emptyNote: t("No game updates yet. They will appear here when I write them up."),
    allLabel: t("View the devlog"),
    gameLabel: t("Game:"),
  },
});
