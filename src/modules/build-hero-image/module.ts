import { defineModule } from "../../core/module";
import { f, noImage } from "../../core/fields";

export default defineModule({
  id: "build-hero-image",
  name: "Build hero image",
  version: 1,
  description: "Build page: one wide hero image (21:9 on desktop, 16:9 on phones).",
  island: false,
  pages: ["build"],
  fields: { image: f.image("Hero image", "21 / 9", ["fill", "fit"], "Hero image, added later") },
  defaults: { image: noImage("fill") },
});
