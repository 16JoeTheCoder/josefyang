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

## 2026-11-25 (plan v2: Chronos, workshop hero, blog, game hub, admin)

### D15. Projects arrive as code modules + a project pack, never as a special-case route
What: Chronos is 6 reusable `showcase-*` modules + 2 Chronos-only modules, filled by `packs/chronos/` (project.json + media). The Chronos handoff's `slug === "chronos"` route patch and its ~40 raw colours were not used. Import in Admin → Builds; always lands as a draft. `tests/packs-valid.test.ts` fails CI if a committed pack would not import.
Reverse: n/a (the pack is plain data; edit it in admin after import).

### D16. Workshop hero replaces the granite hero on Home
What: `home-hero` v2: name + line on a new warm `--desk` paper ground, laptop seen from above, lid opens on a scroll threshold (fixed 1.05s tween, native scroll, hysteresis), screen loops name → line → "Scroll to projects", pause button, offscreen/hidden-tab pause. Floor uses the same ground and is the `#featured` target. Portrait and phone left Home (About keeps the portrait). Cup is SVG from above (the top-down camera made a 3D cup unnecessary). A4 pages: 6 admin slots, blank ruled paper until scans arrive. v1 → v2 migrate keeps edited copy.
Reverse: set the Home page's hero section back to v1 content from Version history; restore the old View from git.

### D17. Global brand tokens vs repo tokens
What: `~/.claude/CLAUDE.md` names ink #0D0E10 / paper #F3F2EE / fire #FF5B1F; this repo's approved tokens are #000 / #f1f1ef / #f26b1d. Kept the repo tokens (approved brief, whole site built on them); the new `--desk` sits between paper and granite. Josef to decide whether to migrate the site to the global tokens (one-file change in tokens.css + contrast check).

### D18. Blog + game hub architecture
What: Devlog upgraded in place (migration 0005; Tiptap JSON blocks, strict whitelist, server-rendered). game.josefyang.com is this same Worker with host routing (`GAME_HOST`), managed in the same admin; each game is its own app on its own subdomain and reads `/api/public/v1/posts`. Hub uses a dark ground (site tokens only) to separate games from the portfolio. See docs/GAME-CONTRACT.md.

### D19. Admin editing model
What: click anything in the preview to jump to its field (matched by section + text/image, no per-field markup in views); typing updates the preview instantly before autosave; "+ Add a section" lists modules allowed on that page; Remove is a two-click confirm (no dialogs); drag handle reorders (sections collapse while dragging; transforms only), Move up/down kept for keyboard. This reverses brief rule "no drag-and-drop" at Josef's request (25 Nov).

## 2026-11-28 (Phase 1: portfolio, content and mobile performance)

### D20. Main /games is the portfolio journey; the catalog moved to internal /hub routes
What: `josefyang.com/games` now renders a Games journey (intro, game-making evidence, ≤ 6 game-related Devlog updates, "Browse the games"). `/game`, `/game/`, `/games/` 301 to `/games`; `/games/<slug>` 301 to the catalog detail. The catalog pages moved from `/games` to `/hub` so the game host can rewrite `/` → `/hub` without ever reaching the journey. One pure router (`src/lib/game-host.ts`) decides everything.
Why: the brief wants a portfolio journey on main, canonical there, with no hub/journey rewrite loop.
Alternatives: keep `/games` as the catalog and add `/games/journey` (breaks the requested canonical).
Reverse: route `/games` back through `routeRequest` to the catalog and move `src/pages/hub` back to `src/pages/games`.

### D21. Admin and previews answer only on the main host (or localhost)
What: `/admin*`, `/preview*`, `/api/admin*` return 404 on any other host, before the Access check. localhost is the explicit dev lane. Previews also send `X-Robots-Tag: noindex, nofollow` and `no-store`.
Reverse: remove the `privateHostAllowed` check in `src/middleware.ts`.

### D22. Finite HTML freshness: 60 s edge TTL, bounded purge, no warming
What: cached public HTML lives 60 s (`s-maxage=60`, was 7 days). Publishing deletes at most 40 affected paths in the local data centre and warms nothing. Cache keys keep only query parameters that change the HTML (none today). Measured locally: miss ~34 ms vs hit ~10 ms TTFB; a change without purge appeared at t+63 s; a publish appeared at t+0 (tests/e2e/freshness.sh).
Why: `cache.delete` is per data centre, so only a TTL bounds staleness globally; warming every page on every publish was unbounded.
Reverse: change `EDITORIAL_TTL` in `src/core/cache.ts`.

### D23. Bounded reads from the saved layout
What: each module declares what it reads (`MODULE_NEEDS` in `src/core/db.ts`). Published pages read only that: builds as a meta-only projection (no sections), the build page reads its own row, Devlog lists use lean columns with per-page limits (Home 10, Games 6), RSS reads 50 full rows. Unknown or custom modules fall back to the old full read. Previews keep the full read. Migration 0008 adds an index so LIMITs stop early. Measured (scaled fixture, 120 builds, 600 posts): Home 4.07 MB → ~57 KB read.
Still unbounded: `/devlog` archive, `/failures` hopper (`SELECT *`), entry prev/next list, `/projects` cards.

### D24. Per-route CSS
What: each route imports only its own module views (`src/core/views/<page>.ts`), so it ships only those modules' CSS. Shared section CSS dropped from 107 KB raw on every route to 5–28 KB per route. A section whose module is not allowed on that page now logs "not available on this page" instead of rendering (the admin only offers allowed modules). `tests/views.test.ts` keeps the groups in sync with each module's `pages`.

### D25. Home: capped floor, first-screen skip, On my bench, opt-in layout upgrade
What: floor camera travel capped at 1.5 extra viewport heights (6 stops: 435svh → 250svh); touch, reduced motion and screens under 640 px tall scroll normally with explicit controls. "Skip to what I'm working on" sits under the hero line and lands focus on the On my bench heading. On my bench is a new module (Websites, Games, Python simulations, ESP32 electronics; no statuses). The Home layout upgrade is a button in the editor (Use the new Home layout): draft only, idempotent, hides "A bit about me" and "I run my life on tools I built" (kept, so the floor still uses the tool screenshots), publishing stays a separate step.
Hero fit: the floor's hero headline ignored the fit steps; it now steps down, and the fit budget is 20 characters, so "BuiltByJosef Portfolio" publishes one step smaller without changing the words.
Reverse: Version history on the Home page restores the previous layout.

### D26. About and Chronos copy
What: About now opens with the first-person story (turned 17 in October 2026, felt late, started learning tools, found he enjoys building) and treats CS50P and ESP32 as learning. Greenmech is removed from defaults until it can be verified; migrations only replace copy that still equals the old defaults. Added "History and geopolitics" to Off the bench. "I'm on the student council" comes from the Phase 1 handoff topic list. Josef: please confirm that wording. Chronos: placeholders ([year], [start] to [end], [stack]) are cleared and left out; the intro shows a real screenshot in the first screen plus What it does / What I built; the one-timer switch is the documented decision.

### D27. Kept the repo palette over the global ink/paper/fire tokens
What: the global instructions name ink/paper/fire, but `prompt/01-brief-and-brand.md` explicitly rejects that system for this site (see D17). New modules use repo tokens only.
