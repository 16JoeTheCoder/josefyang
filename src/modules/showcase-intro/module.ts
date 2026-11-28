import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

export default defineModule({
  id: "showcase-intro",
  name: "Showcase intro",
  version: 2,
  description: "Project showcase opening: breadcrumb, giant two-line headline, one intro paragraph, a button, one real screenshot in the first screen, then What it does / What I built. Empty fields are left out.",
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
    shot: f.image("First-screen screenshot (real, from the project)", "16 / 10", ["fill", "fit"], "Screenshot, added later"),
    doesHeading: f.subheading("Heading: what it does", { max: 28, maxLines: 1 }),
    does: f.body("What it does", { max: 260, maxLines: 5, fit: 220 }),
    builtHeading: f.subheading("Heading: what I built", { max: 28, maxLines: 1 }),
    built: f.body("What I built", { max: 260, maxLines: 5, fit: 220 }),
  },
  defaults: {
    parentLabel: t("Projects"),
    parentUrl: "/projects",
    currentLabel: t("[Project name]"),
    headline: t("[Two-line headline]"),
    body: t("[One or two sentences on what this is.]"),
    cta: t("See it work"),
    ctaUrl: "",
    shot: noImage("fit", ""),
    doesHeading: t("What it does"),
    does: t(""),
    builtHeading: t("What I built"),
    built: t(""),
  },
  // v1 → v2 adds optional fields only; existing content is untouched (defaults fill the gaps).
  migrate: (old) => old,
});
