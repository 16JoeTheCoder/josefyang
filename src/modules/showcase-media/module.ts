import { defineModule } from "../../core/module";
import { f, t, noImage, noVideo } from "../../core/fields";

export default defineModule({
  id: "showcase-media",
  name: "Showcase media",
  version: 1,
  description: "Heading, body and link above a 16/9 poster with an optional short video (click to play) and a caption.",
  island: true,
  pages: ["build"],
  fields: {
    heading: f.heading("Heading", { max: 44, maxLines: 2, fit: 34 }),
    body: f.body("Body", { max: 320, maxLines: 6, fit: 260 }),
    linkLabel: f.label("Link text", { max: 44, maxLines: 1 }),
    linkUrl: f.url("Link URL"),
    poster: f.image("Poster image", "16 / 9", ["fit", "fill"], "Poster image, added in admin"),
    video: f.video("Video (optional, short MP4)", "Short clip, added in admin"),
    playLabel: f.button("Play button label", 30),
    failLabel: f.label("Message if the clip cannot play", { max: 90, maxLines: 2 }),
    caption: f.label("Caption", { max: 100, maxLines: 2 }),
  },
  defaults: {
    heading: t("[Heading]"),
    body: t("[A short paragraph about what the media shows.]"),
    linkLabel: t(""),
    linkUrl: "",
    poster: noImage("fit"),
    video: noVideo(),
    playLabel: t("Play the demo"),
    failLabel: t("The recording could not play here."),
    caption: t(""),
  },
});
