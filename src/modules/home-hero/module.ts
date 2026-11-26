import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

const OLD_HEADLINE = "Josef Yang builds hardware and software";
const OLD_LINE = "Student engineer. Jakarta. Building since October 2026.";

export default defineModule({
  id: "home-hero",
  name: "Home hero (workshop desk)",
  version: 2,
  description: "Name and one line on the workshop desk. Scrolling lifts them away and opens the laptop; its screen replays name, line and the way to the projects, then the featured floor takes over. Still, open laptop on phones and with reduced motion.",
  island: true,
  pages: ["home"],
  fields: {
    headline: f.giant("Your name", { max: 30, maxLines: 2, fit: 14 }),
    line: f.body("One line about you", { max: 110, maxLines: 2, fit: 90 }),
    projectsLink: f.button("Link down to the projects", 24),
    pauseLabel: f.button("Pause button", 20),
    playLabel: f.button("Play button", 20),
    pages: f.list("Working pages on the desk (A4 scans)", "Page", {
      scan: f.image("A4 scan", "210 / 297", ["fill"], "A4 working page"),
    }, 0, 6),
    showCoffee: f.toggle("Show the cappuccino"),
  },
  defaults: {
    headline: t("Josef Yang"),
    line: t("I build software and electronics, usually with a coffee nearby. Nice to meet you."),
    projectsLink: t("Scroll to projects"),
    pauseLabel: t("Pause animation"),
    playLabel: t("Play animation"),
    pages: Array.from({ length: 6 }, () => ({ scan: noImage("fill", "") })),
    showCoffee: true,
  },
  migrate: (old, from) => {
    if (from >= 2 || !old || typeof old !== "object") return old;
    const o = old as Record<string, { value?: string } | unknown>;
    const out: Record<string, unknown> = { ...o };
    // Only replace copy that was never edited; Josef's own words stay.
    if ((o.headline as { value?: string })?.value === OLD_HEADLINE) out.headline = t("Josef Yang");
    if ((o.line as { value?: string })?.value === OLD_LINE) out.line = t("I build software and electronics, usually with a coffee nearby. Nice to meet you.");
    return out;
  },
});
