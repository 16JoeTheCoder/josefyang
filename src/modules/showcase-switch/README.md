# Showcase switch (`showcase-switch`)

Two matching states (image, title, note) with a button that crossfades between them, a short numbered steps list and a footnote. With no JS both states are shown stacked.

- Pages: "build"
- Island: Yes: `island.ts` (GSAP crossfade, aria-live note, plain swap with reduced motion)
- Fields and defaults: `module.ts`. Render: `View.astro` (scoped styles, tokens only).
