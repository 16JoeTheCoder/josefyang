import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "short-version",
  name: "The short version (CV)",
  version: 1,
  description: "Sun band on About: heading, Download CV (PDF) button and the email. The CV file is uploaded in Settings.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.heading("Heading", { max: 30, maxLines: 1, fit: 22 }),
    cvButton: f.button("CV button", 22),
    noCvNote: f.label("Shown when no CV is uploaded", { max: 40, maxLines: 1 }),
  },
  defaults: { heading: t("The short version"), cvButton: t("Download CV (PDF)"), noCvNote: t("CV coming soon.") },
});
