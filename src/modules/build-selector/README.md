# Pick a build (character select) (`build-selector`)

Projects page: every published build in a sideways selector on black, lit by a desk lamp. Enter, Space or the button locks in and opens the build.

- Pages: "projects"
- Island: Yes: `island.ts` (mounted with `onPage`, reduced-motion fallback in CSS)
- Fields and defaults: `module.ts`. Render: `View.astro` (scoped styles, tokens only).
- Counts: 0 builds = status line (`emptyNote`) + link to About (`emptyLink`); 1 build = title, summary and a direct link before the image (heading from `plainHeading`), no selector; 2+ = the selector at 861px and up. At 860px and below, with reduced motion, or without JavaScript (a `<noscript>` rule) it is a text-first list: title, summary, kind and year, link.
