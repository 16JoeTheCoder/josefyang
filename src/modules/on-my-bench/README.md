# On my bench (`on-my-bench`)

Home section after the hero/floor: one stage, four selectors (Websites, Games, Python simulations, ESP32 electronics by default; all editable).

- Without JavaScript: a plain list of four articles (name, text, optional image, optional link). Fully readable.
- With JavaScript: ARIA tabs (arrow/Home/End keys, roving tabindex); one panel visible; images load only for the selected panel or on hover/focus intent.
- No image: a deliberate text-only composition (large text on the section ground). No statuses, progress or dates are shown; the optional "focus" marker is only shown when Josef sets it.
- `skipLabel` is used by the first-screen skip link (RenderSections passes it to the hero/floor); it lands focus on this section's heading.
- Data: none (MODULE_NEEDS `{}`).
