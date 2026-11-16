import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "failures-intro",
  name: "Things that broke (intro)",
  version: 1,
  description: "Failures page top: giant heading and one line, on the finer granite.",
  island: false,
  pages: ["failures"],
  fields: {
    heading: f.giant("Heading", { max: 30, maxLines: 2, fit: 20 }),
    line: f.body("Line", { max: 160, maxLines: 3, fit: 120 }),
  },
  defaults: {
    heading: t("Things that broke"),
    line: t("Feed a failed build into the hopper. It prints what went wrong and what I took from it."),
  },
});
