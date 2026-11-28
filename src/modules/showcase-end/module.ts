import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

export default defineModule({
  id: "showcase-end",
  name: "Showcase end",
  version: 2,
  description: "Dark closing band: one heading, two link buttons and a link to the next published project.",
  island: false,
  pages: ["build"],
  fields: {
    heading: f.heading("Heading", { max: 36, maxLines: 2, fit: 24 }),
    primaryLabel: f.button("First button label", 30),
    primaryUrl: f.url("First button link"),
    secondaryLabel: f.button("Second button label", 30),
    secondaryUrl: f.url("Second button link"),
    nextLabel: f.label("Words before the next project's name", { max: 24, maxLines: 1 }),
  },
  defaults: {
    heading: t("Explore the build."),
    primaryLabel: t("[Source code]"),
    primaryUrl: "",
    secondaryLabel: t("Back to projects"),
    secondaryUrl: "/projects",
    nextLabel: t("Next project:"),
  },
  migrate: (old) => old,
});
