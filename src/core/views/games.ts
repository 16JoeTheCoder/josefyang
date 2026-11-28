/** Section views allowed on "games" pages (modules whose `pages` include "games"; tests/views.test.ts keeps this in sync).
 * Each route imports only its own group, so it ships only those modules' CSS and scripts. */
import type { Views } from "./types";
export const views: Views = import.meta.glob("../../modules/{games-evidence,games-journey,games-updates}/View.astro", { eager: true });
