# decisions.md

Every decision made mid-build that Josef should know about. Newest at the bottom. Each entry: what, why, alternatives, how to reverse.

## 2026-11-16

### D1. Built unattended without plan sign-off
What: plan.md was written and building started straight away in the same run.
Why: Josef's scheduled task explicitly approved building now and waived the wait.
Reverse: review plan.md; anything you disagree with can be changed phase by phase.

### D2. PRODUCT.md inferred from the brief
What: /impeccable normally interviews you before writing PRODUCT.md. This run had no way to ask, so PRODUCT.md was written only from prompt/ and every inferred line is marked.
Reverse: run `/impeccable init` in a live session and correct it.

### D3. Astro 7 + @astrojs/cloudflare 14 (current versions)
What: Bindings are read with `import { env } from "cloudflare:workers"` (the `Astro.locals.runtime.env` API was removed in Astro 6). Sessions are switched off so no KV namespace is needed.
Reverse: n/a, this is just the current API.

### D4. Module styles live inside View.astro, not style.css
What: Astro scopes `<style>` in each View.astro to that module automatically, which is exactly the "scoped CSS" rule. A separate style.css would need manual scoping.
Reverse: move the block into style.css and import it; nothing else changes.

### D5. Build data lives in the build's JSON, mirrored into columns on publish
What: A build's editable fields (title, kind, status, featured, order, skills, images, failure notes, floor nudge) are stored in `draft_json.meta`. On publish they are copied into the table columns (slug, kind, status, featured, home_order, summary, skills_json, title) for querying. Floor position = seeded scatter + nudge in px (no free x/y fields), so stops can never overlap by accident.
Reverse: add floor_x/floor_y fields to `src/core/build-fields.ts` and use them in `src/modules/featured-floor/scatter.ts`.

### D6. Home floor pan uses native scroll, never hijacks the wheel
What: The floor is a tall section with a sticky full-screen stage. Scroll position picks the stop and GSAP pans the camera there. Trackpads, wheels, touch, scrollbars, zoom and keyboard all behave normally, and leaving the last stop just continues down the page. Below 861px wide or with reduced motion it's a plain vertical list.
Alternatives: wheel hijacking with snapping (feels trapped, breaks trackpads).

### D7. Projects selector: lock-in navigates to /builds/<slug>
What: Enter/Space/button plays a short exit (other builds fade, chosen one scales up), then navigates to the build page through the ClientRouter. The URL hash tracks the current build, so "Back to the selector" (/projects#slug) returns to the same build and every build has a shareable URL. Vertical wheel over the selector moves it sideways until the first/last build, then the page scrolls on.

### D8. Image variants are WebP only (no AVIF yet)
What: Browsers can't reliably encode AVIF from a canvas, so the admin makes WebP at 480/960/1600/2400 px plus keeps the original. Keys are content-hashed, so a replaced image always gets a new URL.
Reverse: add an AVIF encoder (WASM) in `src/admin/resize.ts` when it's worth the extra admin weight.

### D9. Floor objects (cappuccino, phone, watch) are drawn in SVG
What: They are small illustrations, not content photos, so they're code. Their text (phone's "Now playing" and track) is editable, each can be switched off, and the watch shows the real time.

### D10. Admin details
- One admin API router (`src/pages/api/admin/[...path].ts`) instead of a file per route: fewer files, same paths as architecture §13.
- Autosave sends the whole draft of the one item being edited (pages are small) instead of a JSON patch.
- Devlog entries and milestones have a simple draft/published status instead of separate draft and published copies; saving a published entry updates the live site.
- Settings (nav, footer copy, contacts, SEO, CV, devlog month notes) publish together with one button.
- Analytics: the admin links to Cloudflare Web Analytics instead of querying GraphQL (architecture §15 [VERIFY] fallback). The beacon runs with SPA mode so router navigations count.
- Click-to-edit from the preview (data-field-path) is not built yet. The Text and Images panels list every slot instead.

### D11. Facts used and placeholders left
What: Default copy comes from the approved mockups and 01-brief-and-brand.md. Instagram, YouTube and LinkedIn URLs are empty until you add them in Admin > Settings > Contact links (empty links are hidden, never faked). Milestone sort dates for "Middle school" and "IGCSE" in `seed/content.sql` are placeholders for ordering only (they aren't shown); fix them in Admin > About timeline.

### D12. No Cloudflare resources were created
What: Everything was built and tested locally (miniflare D1 + R2 through the Cloudflare Vite plugin). `wrangler.jsonc` has a zero database_id placeholder. Provisioning steps, each with where to run it, are in README.md.

### D13. Local dev admin bypass
What: `DEV_ADMIN_BYPASS=1` in `.dev.vars` lets you open /admin locally without Access. It only works on localhost and only when `CF_ACCESS_AUD` isn't set, so production (which has the secret) can never use it. `.dev.vars` is gitignored.

### D14. Weekly D1 backup (architecture §17.3)
What: `src/worker.ts` wraps Astro's handler and adds a cron (Sunday 02:00 Jakarta) that writes `backups/db-YYYY-MM-DD.sql` to the R2 bucket and keeps the last 8. Tested locally. Restore one: download it from R2 in the dashboard, then in the VS Code terminal at the repo root `npx wrangler d1 execute josefyang-db --remote --file=db-YYYY-MM-DD.sql`.

### D15. Accessibility text and fonts
- Every screen-reader-only label (menu, close, skip link, floor objects) is editable too, in Settings or the module.
- Archivo is subset to Latin (90 KB to 74 KB). Lighthouse on the local production build: Home 99/100/100/100, About 100/100/100/100 after a contrast fix (perf/a11y/best practices/SEO); LCP ~1.9 s, CLS 0.
- Not done: Lighthouse CI in GitHub Actions (CI runs type-check, tests and build only).
