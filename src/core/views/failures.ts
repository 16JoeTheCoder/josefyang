/** Section views allowed on "failures" pages (modules whose `pages` include "failures"; tests/views.test.ts keeps this in sync).
 * Each route imports only its own group, so it ships only those modules' CSS and scripts. */
import type { Views } from "./types";
export const views: Views = import.meta.glob("../../modules/{failure-list,failures-intro,hopper}/View.astro", { eager: true });
