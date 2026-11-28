/** Section views allowed on "build" pages (modules whose `pages` include "build"; tests/views.test.ts keeps this in sync).
 * Each route imports only its own group, so it ships only those modules' CSS and scripts. */
import type { Views } from "./types";
export const views: Views = import.meta.glob("../../modules/{build-end,build-header,build-hero-image,build-rows,chronos-runway,chronos-theme-studio,showcase-end,showcase-figures,showcase-intro,showcase-media,showcase-switch,showcase-tabs}/View.astro", { eager: true });
