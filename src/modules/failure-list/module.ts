import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "failure-list",
  name: "Every failure",
  version: 1,
  description: "Failures page: the full typographic list of failed builds (name, kind, date).",
  island: false,
  pages: ["failures"],
  fields: {
    heading: f.heading("Heading", { max: 30, maxLines: 1 }),
    hardware: f.label("Kind: hardware", { max: 16, maxLines: 1 }),
    software: f.label("Kind: software", { max: 16, maxLines: 1 }),
  },
  defaults: { heading: t("Every failure"), hardware: t("Hardware"), software: t("Software") },
});
