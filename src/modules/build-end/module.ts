import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "build-end",
  name: "Back to the selector / next build",
  version: 1,
  description: "Build page end: Back to the selector (returns to this build in the selector) and a link to the next build.",
  island: false,
  pages: ["build"],
  fields: { back: f.button("Back button", 24), nextLabel: f.label("Next build label", { max: 20, maxLines: 1 }) },
  defaults: { back: t("Back to the selector"), nextLabel: t("Next build:") },
});
