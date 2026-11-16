# plan.md: josefyang.com build plan

Status: written 16 Nov 2026 by Claude (unattended run). Josef approved building now, so this plan is the working contract, not a proposal waiting on sign-off. Changes go in `decisions.md`; progress in `log.md`.

## 1. Goal in my own words

A personal brand site for Josef Yang, a 17-year-old student engineer in Jakarta who started building engineering projects in October 2026. It is a public, honest record of learning engineering from close to zero: builds, failures and the devlog. The readers are university admissions officers first, then internship recruiters, then curious teachers. They should leave thinking: modern, precise, trustworthy, memorable, and clearly made by a person, not a template.

Brand: Josef the person, not a topic. Bold Swiss type (Archivo) and calm Japanese restraint, real physical depth (a granite floor, objects with real shadows), one sun-orange accent used rarely. Each page has its own ground and one gimmick (Home floor pan, Projects character select, About print rig, Failures hopper, Devlog month numerals). Honest over impressive: placeholders in [square brackets], never invented facts.

## 2. Stack (as locked in architecture §2)

Astro 7 (strict TS, `output: "server"`) on Cloudflare Workers via `@astrojs/cloudflare`, D1 (`DB`), R2 (`MEDIA`), Zero Trust Access in front of `/admin*`, `/preview/*`, `/api/admin/*` plus a Worker-side JWT check, Preact admin island, Zod schemas, GSAP (+ ScrollTrigger) only inside islands, Astro ClientRouter for transitions. Fonts self-hosted (Archivo variable, Zen Kaku Gothic New 400/500) from `@fontsource`. Tests with Vitest (unit, render, API) and Playwright (islands, E2E).

## 3. Modules per page

Every field is defined once with a field descriptor (`core/fields.ts`), which produces the Zod schema, the admin form, the Text/Images panels and the fit check. Text roles fix size: `giant, heading, subheading, body, label, button, pill`. `max` = hard character limit; `maxLines`; `fit` = characters that fit `maxLines` at the role size (renderer steps down up to 2 tokens; beyond that = too long, publish blocked).

Global (settings, not page sections):
- `nav` (settings `site.nav`): logo text, 5 link labels. Links fixed to routes.
- `footer` (settings `site.footer`): lead line (body, 60), email (giant, 40, 1 line), 2 button labels (button, 18), 4 column titles (label, 20), more-links labels, copyright (label, 60), sign-off (label, 80).
- `contacts` (settings): instagram, github, youtube, linkedin URLs + email + priority flags.
- `cv` (settings): CV media id (PDF in R2).

Home `/`:
- `home-hero`: headline (giant, 2 lines, max 60), line (body, 1 line, max 80), portrait image (arch 11:12, Object, B&W by CSS), cappuccino/phone toggles, phone track text (label, 30).
- `featured-floor` (island): labels for counter/skip/view button (button, 18), kind labels. Builds come from data (featured + home_order + optional floor_x/floor_y/nudge). Per stop: floor object image (4:3, Object), kind, name (heading, 2 lines, max 40), summary (body, 3 lines, max 160), skills (pill, 1 line, 22 each, max 5), View project.
- `about-me-grid`: heading (heading, 2 lines, max 50), 6 items: icon (select from icon set), title (subheading, 1 line, 32), text (body, 3 lines, 140).
- `own-tools`: heading, line; Chronos block + Fuse block: image (16:10, Fill/Fit), name (label), headline (heading, 2 lines, 40), text (body, 4 lines, 200), 2 stats (icon + label 32), button label + link.
- `devlog-strip`: heading, line, button label. Entries: latest 5 published devlog rows.

Projects `/projects`:
- `build-selector` (island): heading (giant, 1 line, 20), bench line prefix + link label, open button label, hint text, failed pill label. Builds = all published, by date; failed builds marked.

Build page `/builds/[slug]` (template `build-default` v1, sections):
- `build-header`: title (giant), facts row (Type, Built, Made with, Links) from build meta.
- `build-hero-image`: hero (21:9 desktop / 16:9 mobile, Fill).
- `build-rows`: The question / The build / The proof (gallery list 3:2 Fill/Fit, max 6) / What changed. If failed: What broke / What I learned.
- `build-end`: "Back to the selector" + next build.

Failures `/failures`:
- `failures-intro`: heading (giant, 2 lines, 30), line (body, 3 lines, 160).
- `hopper` (island): feed button label, slip labels (What broke / What it taught me), link label. Tiles = failed builds (1:1 image, greyscale CSS).
- `failure-list`: heading, list of all failures (name, kind, date) from data.

Devlog `/devlog`, `/devlog/[slug]`:
- `devlog-intro`: heading (giant), line, raw-version card (title, text, link label).
- `devlog-feed`: filter "All" label, month notes (e.g. "The month I started building", editable per month in settings `devlog.monthNotes`), "Rough notes on Fuse" label, "Failed" label. Entries from `devlog` table.
- Entry page: title, date, build tag, hero photo (16:10), body paragraphs + images, Fuse note link, build link, prev/next.

About `/about`:
- `about-hero`: heading (giant, 1 line), bio (body, 6 lines, 320), portrait (4:5, Fill).
- `text-band` (black): heading (giant, 3 lines, 50), 3 paragraphs (body, 300 each).
- `print-rig` (island): heading, line, planned layer count (number); milestones from table; figure image (Object).
- `off-the-bench`: heading, 4 items (icon select, title, text).
- `short-version`: heading, CV button label, email shown from contacts.
- `find-me`: heading, note; buttons from contacts.

## 4. D1 schema (migrations)

- `0001_init.sql`: architecture §6.2 verbatim (pages, builds, templates, devlog, milestones, media, media_usage, versions, settings + indexes).
- `0002_devlog_fields.sql`: devlog `slug UNIQUE, title, excerpt, hero_media_id, fuse_url, read_minutes`; builds `title, year, floor_x, floor_y, floor_nudge_x, floor_nudge_y, deleted_at`.
- `0003_health.sql`: `health(id, at, page, section, module, message)`.
- Seed (`seed/`): not a migration. `seed/content.sql` inserts the default template, page drafts from module defaults are created lazily. `seed/dev-placeholders.sql` (local only) inserts clearly bracketed placeholder builds and devlog entries so every layout can be tested. Real content is entered by Josef in the admin.

## 5. Routes and API

Public (SSR + edge cache): `/`, `/projects`, `/builds/[slug]`, `/failures`, `/devlog`, `/devlog/[slug]`, `/about`, `/media/[...key]` (R2 passthrough when `media.josefyang.com` is not used, also local dev), `/cv` (redirect to the current CV).
Protected: `/admin/*` (Preact SPA), `/preview/*` (same pages from drafts), `/api/admin/*`:
`GET/PATCH pages/:id`, `POST pages/:id/publish`, `GET/POST builds`, `GET/PATCH/DELETE builds/:id`, `POST builds/:id/publish`, `POST builds/:id/upgrade`, `GET/POST templates`, `GET/POST devlog`, `GET/PATCH/DELETE devlog/:id`, `GET/POST milestones`, `PATCH/DELETE milestones/:id`, `GET/POST media`, `GET media/:id/usage`, `POST media/:id/replace`, `DELETE media/:id`, `GET/PATCH settings/:key`, `POST settings/:key/publish`, `GET versions`, `POST versions/:id/restore`, `GET health`, `GET analytics` (link-out fallback).

## 6. Admin screens

Left sidebar: Home, Projects, Failures, Devlog page, About (page editors) · Builds · Home placement · Devlog entries · Milestones · Media · Templates · Settings · Health.
- Page editor: section list (Move up/Move down, no drag), form per section built from descriptors, "Text on this page" panel with fit state, "Images on this page" panel, preview iframe (`/preview/<route>`, Desktop/Mobile toggle), status line (Saving…/Saved/Offline, will retry/Changed in another tab), Publish (blocked if any field is too long or an image lacks alt text), version history with restore.
- Builds: list + create from template; edit meta (title, slug, kind, status, featured, dates, skills, links, summary, images) and template sections; publish.
- Home placement: featured builds only, order numbers + Move up/down, optional floor x/y nudge numbers.
- Devlog: list, quick-post (mobile-first), post-pack export (.zip with `post.md` + originals, built in the browser).
- Milestones: date, title, text, published toggle.
- Media: grid, upload (browser resize), usage list, replace everywhere, delete blocked when used, filter unused.
- Settings: contacts, nav/footer copy, CV upload, SEO defaults, analytics token note.

## 7. Hard parts: how

- **Home floor pan**: a tall section (`(n + 0.5) × 100svh`) with a sticky full-viewport stage. Native scroll drives everything: scroll progress maps to a stop index; when the index changes GSAP tweens the floor `transform` to the precomputed stop (expo.out, ~800ms, scale 0.98→1). No wheel hijacking, so trackpad, wheel, touch, scrollbar, zoom and keyboard all work; leaving the last stop simply continues the page. Arrow keys/PageDown on the focused stage scroll to the next stop's offset. "Skip to the rest" jumps past the section. Stop positions: seeded scatter (deterministic PRNG from slug) or admin floor_x/y, plus nudge. Mobile (<820px) and reduced motion render the same cards as a vertical list (no JS).
- **Projects selector**: native horizontal scroll-snap track (robust on touch/trackpad), the centred card is lit via scroll position; arrows, prev/next buttons, Enter/Space open. Lock-in = a short GSAP exit, then `navigate('/builds/slug')` (shareable URL). "Back to the selector" returns to `/projects#slug`, which centres that build. Reduced motion: plain grid.
- **About print rig**: SVG rod-and-clamp rig drawn in code; the figure is the editable Object image clipped bottom-up by `clip-path`. Planned layers N (admin number); printed layers = published milestones. ScrollTrigger reveals layers one per milestone; reduced motion shows the final printed state. Empty image: dashed arch outline.
- **Failures hopper**: pointer-event drag (no HTML5 DnD) of tiles into the hopper's drop zone; every tile is a button ("Feed it in" path for keyboard/tap). On feed: GSAP drop into the hopper, slip slides out, panel updates (`aria-live`). Reduced motion / no JS: list with `<details>` slips.
- **Text auto-fit**: pure function `fitStep(value, field)` → 0 | 1 | 2 | "over", shared by renderer and admin. CSS reads `data-fit` and uses the next smaller token; `text-wrap: balance`; pills and buttons `white-space: nowrap`.
- **Browser image resizing**: admin decodes with `createImageBitmap` (EXIF orientation honoured), draws to OffscreenCanvas, encodes WebP at 480/960/1600/2400 (only widths ≤ original), uploads original + variants in one multipart request; keys are content-hashed.
- **Cache purge + warm**: public pages cached with Cache API keyed by URL; publish deletes affected URLs and fetches them once to warm.
- **Access JWT**: middleware verifies `Cf-Access-Jwt-Assertion` (RS256 via WebCrypto against `https://<team>/cdn-cgi/access/certs`, `aud`, `exp`, email = `ADMIN_EMAIL`). Local dev bypass only when `DEV_ADMIN_BYPASS=1` AND host is localhost. Writes also require JSON content type + same-origin `Origin`.

## 8. Phases and what "done" means

1. Skeleton: Astro + adapter + wrangler.jsonc + migrations + middleware auth + CI workflow; `npm run build` and `astro check` pass; empty site serves locally.
2. Core: fields, registry (build-time checks), boundary, render pipeline, cache, media helpers, tokens.css, fonts, granite tile.
3. Admin shell: sidebar, editor, preview, forms, Text/Images panels, autosave, publish, versions.
4. Plain modules: every page renders without animation, all text editable, empty image states, nav, footer, mobile. Site usable.
5. Media: upload with resizing, library, usage, replace everywhere, fit modes.
6. Builds + templates + devlog: create from template, Failures derivation, bench, devlog pages, post pack.
7. Islands: floor pan → selector → print rig → hopper, each with reduced-motion + keyboard.
8. Transitions: ClientRouter, selector lock-in, crossfades, focus to heading.
9. Analytics (beacon + link-out) + health panel.
10. Hardening: budgets, a11y, 403 test for every admin route, CSP, backups note, final /impeccable audit + polish.

Each phase: typecheck + build + tests pass, commit, push, PR description updated.

## 9. Risks

- Floor pan feel on trackpads: mitigated by never hijacking scroll (native scroll + tween to discrete stops).
- Free-plan 10 ms CPU on cache misses: one D1 batch per page, cheap modules, warm on publish; prerender fallback documented.
- Astro 7 / adapter API drift vs my knowledge: verify against installed package docs, record in decisions.
- Admin scope is large: build the generic descriptor-driven form once so every module is free.
- No real content yet: every slot has a designed empty state, placeholders are bracketed.

## 10. Questions for Josef (non-blocking, decided for now)

See `decisions.md`. The one that matters most: which 4–5 builds are featured on the Home floor first.
