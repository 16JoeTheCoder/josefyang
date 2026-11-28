/** Section views allowed on "about" pages (modules whose `pages` include "about"; tests/views.test.ts keeps this in sync).
 * Each route imports only its own group, so it ships only those modules' CSS and scripts. */
import type { Views } from "./types";
export const views: Views = import.meta.glob("../../modules/{about-hero,about-story,find-me,off-the-bench,print-rig,short-version,text-band}/View.astro", { eager: true });
