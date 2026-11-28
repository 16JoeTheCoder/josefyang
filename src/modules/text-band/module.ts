import { defineModule } from "../../core/module";
import { f, t } from "../../core/fields";

const OLD_FIRST = "I made full games in Scratch as a kid, then mostly studied. In October 2026 I started building real things: simulators, apps, machines with Greenmech.";
const OLD_REST = [
  "So this site isn't a highlight reel. It's a public record of learning engineering from close to zero, failures included.",
  "I like problems big enough to predict with physics. I'm aiming for an engineering degree abroad.",
];
const NEW = [
  "I made full games in Scratch in middle school. In October 2026 I started building properly: websites, games and my own tools, like Chronos.",
  "Right now I'm learning Python through Harvard's CS50P, as a starting point for my own simulations, and basic electronics with an ESP32. Both are early, and I'll write up what I learn as I go.",
  "So this site isn't a highlight reel. It's a public record of learning engineering from close to zero, failures included.",
];

export default defineModule({
  id: "text-band",
  name: "Black band: I started building",
  version: 2,
  description: "Black band on About: a giant statement left, three honest paragraphs right.",
  island: false,
  pages: ["about"],
  fields: {
    heading: f.giant("Heading", { max: 50, maxLines: 3, fit: 38 }),
    paragraphs: f.list("Paragraphs", "Paragraph", { text: f.body("Paragraph", { max: 300, maxLines: 6 }) }, 1, 4),
  },
  defaults: {
    heading: t("I started building in October 2026."),
    paragraphs: [
      { text: t(NEW[0]!) },
      { text: t(NEW[1]!) },
      { text: t(NEW[2]!) },
    ],
  },
  // v1 → v2: only replaces the untouched v1 paragraphs (which named Greenmech); edited copy stays.
  migrate: (old, from) => {
    if (from >= 2 || !old || typeof old !== "object") return old;
    const o = old as { paragraphs?: { text?: { value?: string } }[] };
    const v = (o.paragraphs ?? []).map((p) => p.text?.value ?? "");
    if (v[0] !== OLD_FIRST) return old;
    // All three still the v1 defaults: take the new set. Otherwise only the Greenmech paragraph changes.
    if (v.length === 3 && v[1] === OLD_REST[0] && v[2] === OLD_REST[1]) return { ...o, paragraphs: NEW.map((p) => ({ text: t(p) })) };
    return { ...o, paragraphs: (o.paragraphs ?? []).map((p, i) => (i === 0 ? { ...p, text: t(NEW[0]!) } : p)) };
  },
});
