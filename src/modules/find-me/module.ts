import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "find-me",
  name: "Find me",
  version: 1,
  description: "About: Instagram and GitHub as large primary buttons, YouTube and LinkedIn as outline buttons. Links come from Settings.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.heading("Heading", { max: 24, maxLines: 1 }),
    note: f.label("Note under the buttons", { max: 80, maxLines: 2 }),
  },
  defaults: { heading: t("Find me"), note: t("YouTube is rougher: raw build footage, talked over.") },
});
