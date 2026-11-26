import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "showcase-intro",
  name: "Showcase intro",
  version: 1,
  description: "Project showcase opening: breadcrumb, giant two-line headline, one intro paragraph and a call-to-action button.",
  island: false,
  pages: ["build"],
  fields: {
    parentLabel: f.label("Breadcrumb: parent label", { max: 24, maxLines: 1 }),
    parentUrl: f.url("Breadcrumb: parent link"),
    currentLabel: f.label("Breadcrumb: this project", { max: 30, maxLines: 1 }),
    headline: f.giant("Headline (two lines)", { max: 40, maxLines: 2, fit: 22 }),
    body: f.body("Intro", { max: 180, maxLines: 4, fit: 140 }),
    cta: f.button("Button label", 32),
    ctaUrl: f.url("Button link (use /builds/slug#anchor for a spot on the page)"),
  },
  defaults: {
    parentLabel: t("Projects"),
    parentUrl: "/projects",
    currentLabel: t("[Project name]"),
    headline: t("[Two-line headline]"),
    body: t("[One or two sentences on what this is.]"),
    cta: t("See it work"),
    ctaUrl: "",
  },
});
