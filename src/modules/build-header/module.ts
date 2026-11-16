import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "build-header",
  name: "Build title and key facts",
  version: 1,
  description: "Build page: giant title and the facts row (Type, Built, Made with, Links). Values come from the build; labels are editable here.",
  island: false,
  pages: ["build"],
  fields: {
    typeLabel: f.label("Label: Type", { max: 16, maxLines: 1 }),
    builtLabel: f.label("Label: Built", { max: 16, maxLines: 1 }),
    madeWithLabel: f.label("Label: Made with", { max: 16, maxLines: 1 }),
    linksLabel: f.label("Label: Links", { max: 16, maxLines: 1 }),
    hardware: f.label("Kind: hardware", { max: 16, maxLines: 1 }),
    software: f.label("Kind: software", { max: 16, maxLines: 1 }),
  },
  defaults: {
    typeLabel: t("Type"), builtLabel: t("Built"), madeWithLabel: t("Made with"), linksLabel: t("Links"),
    hardware: t("Hardware"), software: t("Software"),
  },
});
