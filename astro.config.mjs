// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import preact from "@astrojs/preact";

export default defineConfig({
  site: "https://josefyang.com",
  output: "server",
  adapter: cloudflare({ imageService: "passthrough" }),
  integrations: [preact()],
  session: false,
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  build: { inlineStylesheets: "auto" },
  devToolbar: { enabled: false },
  // New value on every build: part of the edge cache key (src/core/cache.ts).
  vite: { define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) } },
});
