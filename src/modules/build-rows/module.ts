import { defineModule } from "../../core/module";
import { f, t, noImage } from "../../core/fields";

export default defineModule({
  id: "build-rows",
  name: "Question, build, proof, what changed",
  version: 1,
  description: "Build page rows: heading left, content right. Failed builds also show What broke and What I learned (from the build).",
  island: false,
  pages: ["build"],
  fields: {
    questionHeading: f.subheading("Heading 1", { max: 24, maxLines: 2 }),
    question: f.body("The question", { max: 600, maxLines: 10, multiline: true }),
    buildHeading: f.subheading("Heading 2", { max: 24, maxLines: 2 }),
    build: f.body("The build", { max: 1500, maxLines: 30, multiline: true }),
    proofHeading: f.subheading("Heading 3", { max: 24, maxLines: 2 }),
    proof: f.list("Proof (screenshots, photos)", "Proof item", {
      image: f.image("Image", "3 / 2", ["fill", "fit"], "Screenshot or photo"),
      caption: f.label("Caption", { max: 80, maxLines: 2 }),
    }, 0, 8),
    proofLinks: f.list("Proof links (video, code)", "Link", { label: f.label("Link text", { max: 40, maxLines: 1 }), url: f.url("URL") }, 0, 4),
    changedHeading: f.subheading("Heading 4", { max: 24, maxLines: 2 }),
    changed: f.body("What changed", { max: 800, maxLines: 14, multiline: true }),
    brokeHeading: f.subheading("Failed builds: heading 5", { max: 24, maxLines: 2 }),
    learnedHeading: f.subheading("Failed builds: heading 6", { max: 24, maxLines: 2 }),
  },
  defaults: {
    questionHeading: t("The question"),
    question: t("[What problem started this build, in two or three sentences.]"),
    buildHeading: t("The build"),
    build: t("[How it works and the decisions that mattered. Kept short: the proof does the talking.]"),
    proofHeading: t("The proof"),
    proof: [{ image: noImage("fill"), caption: t("") }, { image: noImage("fill"), caption: t("") }],
    proofLinks: [],
    changedHeading: t("What changed"),
    changed: t("[What this build taught me, and what I'd do differently.]"),
    brokeHeading: t("What broke"),
    learnedHeading: t("What I learned"),
  },
});
