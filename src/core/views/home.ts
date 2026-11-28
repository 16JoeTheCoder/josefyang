/** Section views allowed on "home" pages (modules whose `pages` include "home"; tests/views.test.ts keeps this in sync).
 * Each route imports only its own group, so it ships only those modules' CSS and scripts. */
import type { Views } from "./types";
export const views: Views = import.meta.glob("../../modules/{about-me-grid,devlog-strip,featured-floor,home-hero,on-my-bench,own-tools}/View.astro", { eager: true });
