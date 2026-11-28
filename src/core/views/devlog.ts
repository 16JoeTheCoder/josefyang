/** Section views allowed on "devlog" pages (modules whose `pages` include "devlog"; tests/views.test.ts keeps this in sync).
 * Each route imports only its own group, so it ships only those modules' CSS and scripts. */
import type { Views } from "./types";
export const views: Views = import.meta.glob("../../modules/{devlog-entry,devlog-feed,devlog-intro}/View.astro", { eager: true });
