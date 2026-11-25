# Chronos theme studio (`chronos-theme-studio`)

Surface and accent picker with a palette preview and a Download theme JSON button. The six importable theme files live in `public/chronos/themes/`; palette colours for the preview are in `palettes.ts`. With no JS the six files are listed as links.

- Pages: "build"
- Island: Yes: `island.ts` (updates data attributes and the download link)
- Fields and defaults: `module.ts`. Render: `View.astro` (scoped styles, tokens only).
