import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

const OLD_INTRO = "I build software and hardware to see how ideas hold up in practice.";
const OLD_BIO = "I'm Josef Yang, seventeen, at St. Johannes Berchmans School in Jakarta. I take AS Physics, Maths and Computer Science, lead the Greenmech team and captain the school football team.";
const NEW_INTRO = "I make websites and games, and I'm learning Python and electronics.";
const NEW_BIO = "I'm Josef Yang. I turned 17 in October 2026 and study at St. Johannes Berchmans School in Jakarta, taking AS Physics, Maths and Computer Science. I'm on the student council and captain the school football team.";

export default defineModule({
  id: "about-hero",
  name: "About: name and bio",
  version: 2,
  description: "Charcoal opening with a name, portrait and short introduction, plus a View CV button when a CV is published.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.giant("Heading", { max: 36, maxLines: 2, fit: 24 }),
    introduction: f.body("What you build", { max: 120, maxLines: 3, fit: 95 }),
    bio: f.body("Bio", { max: 320, maxLines: 7, fit: 260 }),
    cvLabel: f.button("View CV button (only shown once a CV is published)", 18),
    portrait: f.image("Portrait", "4 / 5", ["fill", "fit"], "Portrait, added later"),
    samplesHeading: f.label("Work samples heading", { max: 45, maxLines: 1 }),
  },
  defaults: {
    heading: t("Josef Yang"),
    introduction: t(NEW_INTRO),
    bio: t(NEW_BIO),
    cvLabel: t("View CV"),
    portrait: noImage("fill"),
    samplesHeading: t("From the workbench"),
  },
  // v1 → v2: only untouched v1 defaults change (Greenmech claim removed until it can be verified). Josef's own words stay.
  migrate: (old, from) => {
    if (from >= 2 || !old || typeof old !== "object") return old;
    const o = { ...(old as Record<string, unknown>) };
    const val = (k: string) => (o[k] as { value?: string } | undefined)?.value;
    if (val("introduction") === OLD_INTRO) o.introduction = t(NEW_INTRO);
    if (val("bio") === OLD_BIO) o.bio = t(NEW_BIO);
    return o;
  },
});
