/** Section views allowed on "projects" pages (modules whose `pages` include "projects"; tests/views.test.ts keeps this in sync).
 * Each route imports only its own group, so it ships only those modules' CSS and scripts. */
import type { Views } from "./types";
export const views: Views = import.meta.glob("../../modules/{build-selector}/View.astro", { eager: true });
