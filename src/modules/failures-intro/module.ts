import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "failures-intro",
  name: "Things that broke (intro)",
  version: 2,
  description: "Introduction to the failure case files.",
  island: false,
  pages: ["failures"],
  fields: {
    heading: f.giant("Heading", { max: 30, maxLines: 2, fit: 20 }),
    line: f.body("Line", { max: 160, maxLines: 3, fit: 120 }),
  },
  migrate: (old) => {
    const record = old as { line?: { value?: string } } | undefined;
    return record?.line?.value === "Feed a failed build into the hopper. It prints what went wrong and what I took from it."
      ? { ...record, line: t("The builds that went wrong and what I learned while taking them apart.") } : old;
  },
  defaults: {
    heading: t("Things that broke"),
    line: t("The builds that went wrong and what I learned while taking them apart."),
  },
});
