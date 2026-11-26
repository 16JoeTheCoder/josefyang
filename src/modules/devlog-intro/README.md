# Devlog intro (`devlog-intro`)

Devlog page top: giant Devlog, line, the 'Want the raw version?' card, and the latest entry featured.

- Pages: "devlog"
- Island: No: zero JavaScript
- Fields and defaults: `module.ts`. Render: `View.astro` (scoped styles, tokens only).
- Optional dated "Now" line: `nowDate` + `nowText`; rendered only when both are filled. The Fuse card becomes the next step (`rawEmptyText`) while the feed is empty.
