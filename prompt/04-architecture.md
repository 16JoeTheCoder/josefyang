# josefyang.com: Architecture Specification

Version 1.1 · 16 Nov 2026 · Owner: Josef Yang · Status: APPROVED, ready to build

> **Read §0 (Amendments v1.1) first. Where §0 conflicts with a later section, §0 wins.**

This is the single reference for how josefyang.com is built, hosted, edited and kept alive. It covers the public site (Home, Projects, Failures, About), the admin view, the content model, the Cloudflare setup and the rules every future module must follow. Visual design lives in the separate design system docs; this file is about structure.

Tags used: **[LOCKED]** = decided by Josef. **[PROPOSED]** = Claude's recommendation, pending approval. **[VERIFY]** = a fact to check against current Cloudflare docs before building.

---

## 0. Amendments v1.1 (approved 16 Nov 2026, after v1.0)

1. **Everything is approved.** Tags marked [PROPOSED] below are now accepted unless this section changes them. [VERIFY] items still need checking against current Cloudflare docs.
2. **Pages and routes.** Add `/devlog` (list, month-grouped, filter by build) and `/devlog/[slug]` (entry). Add `devlog` to the pages table ids and give `devlog` rows a `slug`, `title`, `excerpt`, `hero_media_id`, `fuse_url` (link to the rough note on Fuse) and `read_minutes`. Add migration `0002_devlog_fields.sql`. Nav order: Projects, Failures, Devlog, About, Get in touch.
3. **Home** is not "all white" any more (§9.7 note is outdated): Home = granite hero + **floor stage** (featured builds scattered on a 2D floor; scroll pans the camera to the next build in any direction; counter "n / total"; "Skip to the rest") + white sections + black footer. The floor stage is an island (`featured-floor` module) and the heaviest piece of motion on the site; isolate it, give it a reduced-motion vertical fallback and a mobile vertical fallback. Full-screen preferred, not required: pick the most robust implementation.
4. **Home modules** (replace the §4 module list where it differs): `home-hero`, `featured-floor`, `about-me-grid`, `own-tools` (Chronos + Fuse blocks), `devlog-strip` (latest 5, horizontal photo row + View the devlog), `footer`. Remove `four-steps`, `tools-cards`, `contact-band` (contact now lives in the footer).
5. **Floor data.** Featured builds get `floor_x`, `floor_y` (optional; else seeded scatter computed at render) and `floor_nudge` fields. Admin "Home placement" sets order + optional nudge in numbers. No dragging.
6. **Footer module** on every page: black, giant mailto email, two buttons, 4-column link menu, copyright line. Links come from Settings.
7. **Socials** stored in `settings.contacts`: instagram, github, youtube, linkedin (+ priority flag). Editable in admin Settings; rendered on Home hero (Instagram, GitHub), About "Find me" (all four), footer (all four).
8. **Text editing rule replaces §5.4:** no size picker. Each text field's role fixes its size; the module sets `maxLines` + `max` characters; the renderer steps down at most two type-scale tokens to fit (CSS only: container query units, `text-wrap: balance`); if still too long, the admin blocks publish for that field and shows the overflow in orange in the preview. Pills and buttons never wrap. `f.text` is stored as `{ value }` (no size). Full rule: `05-text-and-image-spec.md`. §12.2 "Text on this page" panel stays, minus the size dropdown, plus a fit indicator (fits / shrunk 1 step / too long).
9. **Images extend §10:** every slot has a fixed ratio and a fit mode: **Fill** (focal point + zoom), **Fit** (whole image on a matte), **Object** (transparent cut-out with real shadow and white hover outline). `f.image` stores `{ mediaId, focal, zoom, mode, alt }`. Per-slot minimum sizes and formats: `05-text-and-image-spec.md`. No AI "expand".
10. **Grounds and tokens** (update §16 contrast list): white, granite (+ grain), black, sun orange, section grey. Stone and wood grounds are retired.
11. **Projects selector:** includes failed builds marked "Failed". Lock-in must keep a shareable URL per build.
12. **Process files.** The repo keeps `plan.md`, `log.md` and `decisions.md` at the root (this replaces `decision.md` in §4). See `06-process.md`.
13. **Fuse and Chronos** are external projects. Fuse lives at `fuse.josefyang.com` (separate Worker/repo). Home and Devlog link out to it. Do not rebuild Fuse here.
14. **Open questions from §21, resolved:** repo = `16JoeTheCoder/josefyang`; Home devlog strip shows latest 5; CV = one PDF uploaded in Settings; `media.josefyang.com` = yes; add a `giant` type token for page titles and the footer email.

---

## 1. Goals and non-negotiables

1. **Free forever on Cloudflare.** Every piece runs on the Cloudflare free tier. [LOCKED]
2. **Solo site, no public login.** Only Josef logs in, at `/admin`, through Cloudflare Zero Trust Access (already set up). [LOCKED]
3. **Modular and compartmentalised.** Every section is a self-contained module. One module breaking must never break the page or the site. [LOCKED]
4. **Admin is an editor, not a builder.** No drag-and-drop. Precise, typed settings with a live preview. New layouts and sections are designed in Claude Code, not in the admin. [LOCKED]
5. **Edit without touching code.** All text and all images on every page are editable from the admin. [LOCKED]
6. **Animated, still fast.** Motion lives only in the islands that need it (Projects selector, About print rig, Failures hopper, hover and transitions); everything else ships zero JS. [LOCKED]
7. **No silent breakage.** Every save is validated, versioned and restorable. [PROPOSED]

---

## 2. Stack [LOCKED]

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | Josef's existing language; type errors caught before deploy |
| Framework | Astro | Zero JS by default; interactive parts are isolated "islands" |
| Runtime / host | Cloudflare Workers (Astro Cloudflare adapter) with static assets | One deployable unit; free tier |
| Page transitions | Astro ClientRouter | Smooth page changes in every browser |
| Motion | GSAP (+ ScrollTrigger) | Only inside the islands that need it |
| Admin UI | Preact island under `/admin` | React-compatible, ~3–4 KB |
| Validation | Zod | One schema per module drives form, API check and render |
| Database | Cloudflare D1 (SQLite) | Content, versions, settings |
| File storage | Cloudflare R2 | Images and downloadable files (CV) |
| Auth | Cloudflare Zero Trust Access | Protects `/admin` and write API routes |
| Analytics | Cloudflare Web Analytics | Free, cookieless |
| Source control | GitHub `16JoeTheCoder/josefyang` [PROPOSED name] | Auto-deploy on push |

---

## 3. Cloudflare topology

```
                    josefyang.com (Cloudflare DNS, proxied)
                                  │
                     ┌────────────┴─────────────┐
                     │  Worker: josefyang-site   │
                     │  (Astro SSR + static)     │
                     └──┬─────────┬──────────┬───┘
                        │         │          │
               static assets    D1          R2
              (JS, CSS, fonts) josefyang-db josefyang-media
                        │
         Zero Trust Access app: josefyang.com/admin*  +  /api/admin/*

  Subdomains (separate Workers, separate repos):
  cirata.josefyang.com, greenmech.josefyang.com, …  → link out only
```

### 3.1 Resources to create

| Resource | Name | Binding in code |
|---|---|---|
| Worker | `josefyang-site` | n/a |
| D1 database | `josefyang-db` | `DB` |
| R2 bucket | `josefyang-media` | `MEDIA` |
| R2 public access | custom domain `media.josefyang.com` | n/a |
| Access application | "josefyang admin", paths `/admin*` and `/api/admin/*` | n/a |
| Web Analytics site | josefyang.com | beacon token in settings |
| Secrets | `CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ANALYTICS_TOKEN`, `CF_ACCOUNT_ID` | `env.*` |

Josef's Cloudflare agent can create all of these through the API.

### 3.2 Free-tier budget [VERIFY all numbers on Cloudflare's pricing pages before building]

| Service | Free limit (as understood) | Expected use | Headroom |
|---|---|---|---|
| Workers requests | 100,000 / day | low thousands | large |
| Workers CPU | **10 ms per request** | SSR render must stay under this | **tight, see §8.3** |
| Static asset requests | free, unlimited | all JS/CSS/fonts | n/a |
| D1 rows read | 5,000,000 / day | low | large |
| D1 rows written | 100,000 / day | hundreds (autosave) | large |
| D1 storage | 5 GB | < 50 MB | large |
| R2 storage | 10 GB / month | < 2 GB | large |
| R2 Class A ops (writes) | 1,000,000 / month | uploads only | large |
| R2 Class B ops (reads) | 10,000,000 / month | cached at edge | large |
| R2 egress | free | n/a | n/a |
| Zero Trust Access | free up to 50 users | 1 | n/a |
| Web Analytics | free | n/a | n/a |
| Workers Builds (CI) | limited build minutes / month | a few builds / week | check |

**Not available free, so not used:** Cloudflare Images transformations (on-the-fly resizing). Resizing happens in the browser at upload time (§10).

---

## 4. Repository structure [PROPOSED]

```
josefyang/
├── decision.md              ← every decision made mid-build (required)
├── log.md                   ← running log that keeps the AI on track (required)
├── astro.config.mjs
├── wrangler.jsonc           ← bindings: DB, MEDIA, vars
├── package.json
├── tsconfig.json            ← strict: true
├── migrations/              ← D1 SQL migrations, numbered
│   ├── 0001_init.sql
│   └── …
├── src/
│   ├── modules/             ← EVERY page section lives here (the drop-in folders)
│   │   ├── home-hero/
│   │   ├── featured-builds/
│   │   ├── four-steps/
│   │   ├── tools-cards/
│   │   ├── devlog-strip/
│   │   ├── contact-band/
│   │   ├── hero-name/
│   │   ├── text-block/
│   │   ├── off-the-bench/
│   │   ├── build-selector/
│   │   ├── build-page/
│   │   ├── print-rig/
│   │   ├── hopper/
│   │   ├── bench-devlog/
│   │   └── footer/
│   ├── core/
│   │   ├── registry.ts      ← auto-discovers modules via import.meta.glob
│   │   ├── fields.ts        ← the field-type library (text, image, …)
│   │   ├── render.astro     ← renders a page's section list with isolation
│   │   ├── boundary.astro   ← per-section error boundary
│   │   ├── db.ts            ← typed D1 queries
│   │   ├── media.ts         ← R2 URL + srcset helpers
│   │   ├── auth.ts          ← Access JWT verification
│   │   └── cache.ts         ← edge cache read/write/purge
│   ├── pages/
│   │   ├── index.astro               ← Home
│   │   ├── projects/index.astro      ← Projects (selector)
│   │   ├── builds/[slug].astro       ← one build page
│   │   ├── failures.astro
│   │   ├── about.astro
│   │   ├── admin/[...path].astro     ← mounts the Preact admin
│   │   └── api/
│   │       ├── public/…              ← read-only endpoints (if any)
│   │       └── admin/…               ← all write endpoints (Access-protected)
│   ├── admin/               ← Preact admin app (components, stores, forms)
│   ├── styles/
│   │   ├── tokens.css       ← colours, type scale, spacing (from the design system)
│   │   └── base.css
│   └── lib/                 ← shared utilities (dates, slugify, etc.)
├── templates/               ← exported/importable template JSON files
├── public/fonts/            ← self-hosted, subset Archivo + Zen Kaku Gothic New
└── tests/
```

---

## 5. The module contract (the heart of the system) [PROPOSED]

Every section of every page is a **module**: one folder in `src/modules/`. Adding a section = Claude Code adds a folder, Josef pushes, it deploys. Nothing else in the codebase changes.

### 5.1 Folder anatomy

```
src/modules/off-the-bench/
├── module.ts        ← id, name, version, schema, defaults, island flag
├── View.astro       ← the render (pure: content in → HTML out)
├── island.ts        ← OPTIONAL client JS (GSAP etc.), loaded only if present
├── style.css        ← scoped to this module
└── README.md        ← what it is, which page(s) use it
```

### 5.2 `module.ts` shape

```ts
import { z } from "zod";
import { f } from "../../core/fields";

export const schema = z.object({
  heading: f.text({ role: "heading", max: 40 }),
  items: f.list(
    z.object({
      icon: f.image({ alt: true }),
      subheading: f.text({ role: "subheading", max: 30 }),
      text: f.text({ role: "body", max: 160 }),
    }),
    { min: 1, max: 6 }
  ),
});

export default {
  id: "off-the-bench",
  name: "Off the bench",
  version: 1,
  schema,
  defaults: {
    heading: { value: "Off the bench", size: "xl" },
    items: [],
  },
  island: false,          // true = island.ts is shipped
  pages: ["about"],       // where it is allowed
};
```

### 5.3 Field-type library (`core/fields.ts`)

These are the only field types. The admin builds every form from them automatically, so a new module needs zero admin code.

| Field | Stored as | Admin control | Notes |
|---|---|---|---|
| `f.text({ role, max })` | `{ value: string, size: SizeToken }` | Plain text box + size picker | No bold/italic/colour formatting (see §5.4) |
| `f.longText({ max })` | `{ value: string, size }` | Multi-line plain text box + size | Line breaks kept; paragraphs split on blank lines |
| `f.image({ alt })` | `{ mediaId, focal: {x,y}, alt }` | Image slot (library / upload / focal point) | Alt text required |
| `f.link()` | `{ label, href }` | Two text boxes | External links open in a new tab automatically |
| `f.number({ min, max, step })` | number | Number input | e.g. Home order |
| `f.select(options)` | string | Dropdown | e.g. hardware / software |
| `f.toggle()` | boolean | Switch | e.g. featured |
| `f.date()` | ISO date | Date picker | |
| `f.ref("builds")` | id | Searchable picker | Points to a build, milestone, etc. |
| `f.list(item, {min,max})` | array | Repeating group with Add, Remove, Move up/down | No dragging |
| `f.colour()` | token name | Swatch picker limited to the palette | Never free hex |

### 5.4 Text editing rule [LOCKED by Josef]

Text is edited as **pure text plus a size**, nothing else. Every text field shows up in the admin as:

```
[Heading]     Off the bench                    Size: XL ▾
[Subheading]  Jazz                             Size: M  ▾
[Text]        Not the instruments. The calm…   Size: S  ▾
```

- **Role** (Heading / Subheading / Text) is fixed by the module, so it's always clear what you're editing.
- **Size** is chosen from the design system's type-scale tokens only (`xs, s, m, l, xl, xxl`), never a free pixel value. [PROPOSED] Free sizes would break the Swiss type system the first time a heading gets 3 px bigger by accident; tokens keep every page on the same scale.
- **Default size** comes from the module, so most of the time you never touch it.
- **No formatting**: no bold, italic, colour or font picker. Type style comes from the role.

### 5.5 Hard rules for every module

1. **No hard-coded content.** Every visible string and every image must be a schema field. This includes CSS background images and images drawn inside a canvas or animation (e.g. the print rig). If a module hard-codes one, it vanishes from the admin's text and image panels.
2a. **Empty image state.** [LOCKED by Josef: no images yet, all added later in admin] Every image slot renders a designed empty state (neutral tile #F4F4F2 + outline icon + label) until an image exists, and every slot has a fixed aspect ratio, so adding or swapping an image never shifts the layout.
2. **Pure render.** `View.astro` gets validated content and returns HTML. No database calls, no fetches.
3. **Scoped CSS.** Styles only target the module's own root class. No global selectors.
4. **Tokens only.** Colours, sizes and spacing come from `tokens.css`. No raw hex values.
5. **Island lifecycle.** If `island.ts` exists it must export `mount(root)` and `unmount()`. It runs on `astro:page-load` and cleans up on `astro:before-swap` (§9).
6. **Reduced motion.** Every island checks `prefers-reduced-motion` and provides the static fallback.
7. **Versioned schema.** Changing a schema in a breaking way bumps `version` and adds a `migrate(old) → new` function.
8. **Budget.** Island JS ≤ 40 KB gzipped each, GSAP loaded once and shared (≈ 25–30 KB gz core + ScrollTrigger). [PROPOSED]

### 5.6 Registry

`core/registry.ts` uses `import.meta.glob("../modules/*/module.ts", { eager: true })` to find every module at build time. It fails the build (not the live site) if two modules share an id, or a module's defaults don't pass its own schema.

---

## 6. Content model (D1) [PROPOSED]

### 6.1 Concepts

- **Page**: one of the fixed routes (home, projects, failures, about) with an ordered list of **sections**.
- **Section**: one module instance: module id + module version + content JSON.
- **Build**: a project. Featured builds also appear on Home.
- **Template**: a reusable list of sections (with defaults) used to create build pages. Different groups of builds can use different templates.
- **Media**: one uploaded file in R2, with its variants.
- **Draft / published**: every editable row has a draft copy and a published copy.

### 6.2 Tables

```sql
-- 0001_init.sql

CREATE TABLE pages (
  id            TEXT PRIMARY KEY,           -- 'home' | 'projects' | 'failures' | 'about'
  draft_json    TEXT NOT NULL,              -- [{ sectionId, moduleId, moduleVersion, content }]
  published_json TEXT,
  updated_at    INTEGER NOT NULL,
  published_at  INTEGER
);

CREATE TABLE builds (
  id            TEXT PRIMARY KEY,           -- uuid
  slug          TEXT UNIQUE NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('hardware','software')),
  status        TEXT NOT NULL CHECK (status IN ('bench','in_progress','finished','failed')),
  featured      INTEGER NOT NULL DEFAULT 0,
  case_file     INTEGER NOT NULL DEFAULT 0,
  template_id   TEXT NOT NULL REFERENCES templates(id),
  template_ver  INTEGER NOT NULL,
  home_order    INTEGER,                    -- position among featured builds on Home
  summary       TEXT,                       -- short description (Home + selector)
  skills_json   TEXT NOT NULL DEFAULT '[]', -- skills learnt/used, shown as tag pills
  draft_json    TEXT NOT NULL,              -- section list, same shape as pages
  published_json TEXT,
  started_on    TEXT,
  finished_on   TEXT,
  updated_at    INTEGER NOT NULL,
  published_at  INTEGER
);

CREATE TABLE templates (
  id            TEXT NOT NULL,
  version       INTEGER NOT NULL,
  name          TEXT NOT NULL,
  sections_json TEXT NOT NULL,              -- [{ moduleId, moduleVersion, defaults }]
  created_at    INTEGER NOT NULL,
  PRIMARY KEY (id, version)
);

CREATE TABLE devlog (
  id            TEXT PRIMARY KEY,
  build_id      TEXT REFERENCES builds(id),
  body          TEXT NOT NULL,
  media_ids     TEXT NOT NULL DEFAULT '[]',
  status        TEXT NOT NULL DEFAULT 'draft',
  created_at    INTEGER NOT NULL,
  published_at  INTEGER
);

CREATE TABLE milestones (                   -- About timeline / print layers
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,              -- sorts automatically
  title         TEXT NOT NULL,
  body          TEXT,
  status        TEXT NOT NULL DEFAULT 'draft'
);

CREATE TABLE media (
  id            TEXT PRIMARY KEY,
  original_key  TEXT NOT NULL,              -- R2 key of the original
  variants_json TEXT NOT NULL,              -- [{ w, format, key }]
  width         INTEGER, height INTEGER,
  alt_default   TEXT,
  bytes         INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE media_usage (                  -- powers "where is this used" + "replace everywhere"
  media_id      TEXT NOT NULL REFERENCES media(id),
  owner_type    TEXT NOT NULL,              -- 'page' | 'build' | 'devlog' | 'settings'
  owner_id      TEXT NOT NULL,
  field_path    TEXT NOT NULL,              -- e.g. 'sections[3].content.items[0].icon'
  PRIMARY KEY (media_id, owner_type, owner_id, field_path)
);

CREATE TABLE versions (                     -- restore points
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_type    TEXT NOT NULL,
  owner_id      TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  reason        TEXT NOT NULL,              -- 'publish' | 'interval' | 'restore' | 'replace-everywhere'
  created_at    INTEGER NOT NULL
);

CREATE TABLE settings (
  key           TEXT PRIMARY KEY,           -- 'portrait', 'bio', 'contacts', 'seo', 'cv'
  draft_json    TEXT NOT NULL,
  published_json TEXT,
  updated_at    INTEGER NOT NULL
);

CREATE INDEX idx_builds_status ON builds(status);
CREATE INDEX idx_builds_featured ON builds(featured);
CREATE INDEX idx_usage_owner ON media_usage(owner_type, owner_id);
CREATE INDEX idx_versions_owner ON versions(owner_type, owner_id, created_at);
```

### 6.3 Why JSON columns

Sections differ per module, so their content is stored as validated JSON. Zod is the gatekeeper: nothing reaches `draft_json` without passing the module schema, and nothing renders from `published_json` without passing it again.

### 6.4 Derived pages

- **Home featured** = published builds with `featured = 1`, ordered by `home_order`; each shows image/object with real shadow, name, summary, skill tags, View project.
- **Projects** = all published builds (featured or not), ordered by date, including failed builds marked "Failed" [LOCKED].
- **Failures** = builds with `status = 'failed'`, which unlocks the "What broke" and "What I learned" fields.
- **On the bench** = the single build with `status = 'bench'` (admin enforces one at a time) + its devlog.
- **About timeline** = published milestones sorted by date; each is one print layer.

---

## 7. Routes

| Route | Type | Source |
|---|---|---|
| `/` | SSR + edge cache | `pages.home` + featured builds + latest devlog |
| `/projects` | SSR + edge cache | builds + bench + devlog |
| `/builds/[slug]` | SSR + edge cache | one build |
| `/failures` | SSR + edge cache | failed builds |
| `/about` | SSR + edge cache | `pages.about` + milestones |
| `/admin/*` | Access-protected, Preact | admin app |
| `/api/admin/*` | Access-protected JSON | all writes and drafts |
| `/preview/*` | Access-protected | same pages rendered from `draft_json` |
| `media.josefyang.com/*` | R2 custom domain | images, CV |

Subdomain apps (cirata, greenmech, etc.) are separate Workers. Build pages link out to them.

---

## 8. Rendering, caching, performance

### 8.1 Render flow (public)

1. Request hits the Worker.
2. Check the edge cache (Cache API) for this URL → hit: return immediately (almost no CPU).
3. Miss: read `published_json` from D1 → validate each section → render each module inside its boundary → store in cache → return.

### 8.2 Publish flow

Publish copies `draft_json` → `published_json`, writes a `versions` row, then purges the cache for every affected URL (e.g. publishing a featured build purges `/`, `/projects`, `/builds/<slug>`).

### 8.3 The 10 ms CPU risk on the free plan [VERIFY]

The free Workers plan limits CPU time per request (understood as 10 ms). A cache **miss** renders a full page, which may exceed it on heavy pages.

Mitigations, in order:
1. Keep renders cheap: pure modules, one D1 query per page, no heavy work at request time.
2. Edge cache with long TTL; misses only happen right after a publish.
3. **Warm the cache on publish**: after purge, the admin requests each affected URL itself so visitors never hit a miss.
4. **Fallback if still too slow**: switch public pages to static prerender, with Publish triggering a rebuild via a deploy hook. Costs build minutes and ~1–2 min publish delay, but zero runtime CPU.

### 8.4 Performance levers [LOCKED]

- HTML rendered at the edge and cached.
- JS per island only; text-only pages ship 0 KB JS (apart from the ClientRouter).
- Home hover (white outline + lift) is pure CSS, no JS.
- Images: AVIF + WebP variants at 480 / 960 / 1600 / 2400 px with `srcset` and correct `sizes`; `loading="lazy"` except the first visible image (`fetchpriority="high"`).
- Fonts self-hosted, subset to used characters, `font-display: swap`, display weight preloaded.
- Prefetch on hover for internal links.
- Projects selector, About rig and Failures hopper islands load only on their own pages.

### 8.5 Performance budget [PROPOSED]

| Metric | Target |
|---|---|
| LCP (mobile, 4G) | < 2.0 s |
| CLS | < 0.05 |
| INP | < 200 ms |
| JS on a text page | < 15 KB gz |
| JS on the heaviest page (Projects selector or About rig) | < 80 KB gz |
| Total page weight (first load) | < 1.2 MB |

---

## 9. ClientRouter lifecycle rules [LOCKED router; rules PROPOSED]

The router swaps pages without a full reload, so scripts do **not** re-run by themselves. This is the number-one source of router bugs.

1. Every island mounts on `document.addEventListener("astro:page-load", …)`.
2. Every island cleans up on `astro:before-swap`: kill GSAP timelines, ScrollTriggers, observers, listeners.
3. A tiny core helper `onPage(mount, unmount)` wraps both, so modules can't forget.
4. `transition:persist` only for things that must survive navigation (nothing by default).
5. Analytics page views fire on router navigation, not just first load.
6. Test back/forward with scroll restore on every page.
7. Any exit animation (e.g. the Projects selector locking into a build) runs first, then calls `navigate()`. (The earlier software dive / hardware scanner sweep on Home are superseded by the all-white Home.)
8. Reduced motion: transitions become a 150 ms crossfade.

---

## 10. Media pipeline [PROPOSED]

Because on-the-fly resizing isn't free, resizing happens **in the admin, in the browser**, at upload time.

1. Josef picks or drops a file in the admin.
2. The browser decodes it, applies EXIF rotation, then generates AVIF + WebP at 480/960/1600/2400 px (canvas + encoder in a Web Worker), plus keeps the original.
3. The admin uploads all variants straight to R2 through `/api/admin/media` (streamed, size-checked).
4. A `media` row records the keys, dimensions and default alt text.
5. Images are served from `media.josefyang.com` with long immutable cache headers (keys are content-hashed, so a replaced image gets a new URL and never shows stale).

Rules: max upload 20 MB; JPEG/PNG/WebP/AVIF/HEIC accepted (HEIC decode [VERIFY] browser support, else convert on phone); alt text required before publish; deleting media that's still in `media_usage` is blocked.

---

## 11. Isolation and failure handling [PROPOSED]

- Each section renders inside `boundary.astro`. If its content fails Zod validation or its render throws, the boundary renders nothing (or a neutral spacer), logs the error, and the rest of the page renders normally.
- Each island's `mount()` is wrapped in try/catch; a crashing island leaves its static HTML in place.
- Failures are written to a `health` log (Workers logs + a small D1 table) and shown in the admin's Health panel with page, section and error.
- The build fails, before deploying, if any module's defaults or any stored template fails validation, so bad code never reaches production.

---

## 12. Admin view

### 12.1 Layout

```
┌──────────────┬───────────────────────────────┬──────────────────────────┐
│ Sidebar      │ Editor (form)                 │ Live preview (real site) │
│              │                               │                          │
│ Home         │ Page: About                   │  ┌────────────────────┐  │
│ Projects     │ ─ Sections ─────────────────  │  │  Off the bench     │  │
│ Builds       │ 1 Hero bio         [↑][↓]     │  │  ◉ Jazz            │  │
│ Bench/devlog │ 2 Print rig        [↑][↓]     │  │  Not the instru…   │  │
│ Failures     │ 3 Off the bench ▸  [↑][↓]     │  └────────────────────┘  │
│ About        │                               │                          │
│ Templates    │ [Text on this page]           │  Desktop | Mobile        │
│ Media        │ [Images on this page]         │                          │
│ Settings     │                               │  Draft • Saved 2s ago    │
│ Analytics    │                               │  [Publish]               │
│ Health       │                               │                          │
└──────────────┴───────────────────────────────┴──────────────────────────┘
```

- The preview is the real page rendered from drafts at `/preview/...`, inside an iframe, with a desktop/mobile width toggle.
- Clicking any text or image in the preview highlights and scrolls to its field in the editor (the preview gets `data-field-path` attributes in preview mode only).
- No drag-and-drop anywhere. Order uses Move up / Move down buttons or a number.

### 12.2 "Text on this page" panel [LOCKED by Josef]

A flat list of every text slot on the current page, in page order, grouped by section:

```
Off the bench
  [Heading]     Off the bench                          XL ▾
  [Subheading]  Jazz                                   M  ▾
  [Text]        Not the instruments. The calm it pu…   S  ▾
  [Subheading]  Coffee                                 M  ▾
  [Text]        Kopi susu by day. Espresso when a b…   S  ▾
```

- Edit text in place, choose size from tokens, and the preview updates as you type.
- Character limit shown when close (from the schema's `max`).
- Built automatically from schemas: every `f.text` / `f.longText` field appears here.

### 12.3 "Images on this page" panel [LOCKED by Josef]

A list of every image slot on the current page: section, field name, thumbnail, alt text.

- **Replace in this slot**: pick from library or upload → preview swaps instantly (draft).
- **Replace everywhere** [LOCKED]: on any media item, "Replace everywhere this image is used". It lists every usage from `media_usage`, lets you untick any, then swaps them all in one transaction, writing a `versions` row for each affected page/build (undoable).
- **Focal point**: click the point that must stay visible; desktop and mobile crops respect it.
- **Alt text**: edited inline; required.

### 12.4 The nine admin areas [PROPOSED]

1. **Builds**: create from a template; title, slug, hardware/software, status, short description, skills learnt/used (tags), Question / Build / Proof / What changed, media, live link, repo link, dates, featured, case file, draft/published.
2. **Home placement**: featured builds only [LOCKED]. Order set by number or Move up/down, live preview. Each featured build: image/object, name, short description, skill tags, View project.
3. **Templates**: import a JSON file, view versions and "used by" count, preview, upgrade builds to a new version one at a time with a diff of what changes.
4. **Bench + devlog**: choose the one bench build; quick-post entries (text + photos). The only area designed mobile-first. **Export post pack**: a .zip with `post.md` (frontmatter: build, date, status + body) and the original images, ready to drop into Claude Design for Instagram. [LOCKED: export; format PROPOSED]
5. **Failures**: setting a build to failed reveals "What broke" and "What I learned"; it appears on Failures and in the Projects selector marked "Failed" automatically.
6. **About timeline**: milestones (date, title, short text), auto-sorted by date.
7. **Media library**: grid of all media; usage list; replace everywhere; blocked deletion of used media; filter unused.
8. **Settings**: portrait, bio, contact links, SEO/social defaults, CV file.
9. **Analytics + health**: page and build views, referrers, countries, 7/30-day ranges; broken-section flags; version history with restore; list of unpublished changes.

Cut [PROPOSED]: user management, comments, scheduled publishing, in-admin design or layout editing.

### 12.5 Autosave [PROPOSED]

- Saves the draft ~2 s after typing stops, on field blur, and when leaving the page (`visibilitychange` + `sendBeacon`).
- Sends only the changed fields (a JSON patch), not the whole page.
- Status line: "Saving…" → "Saved 2s ago" → "Offline, will retry".
- Offline: changes queue in memory and retry with backoff; a warning shows if the tab is closed with unsaved changes.
- Versions snapshot only on publish, restore, replace-everywhere, or at most every 10 minutes of active editing, never per keystroke.
- **Two open tabs**: each save sends the `updated_at` it last saw; if the server copy is newer, the save is rejected and the admin shows "Changed in another tab. Reload?" instead of overwriting.
- Estimated load: a few hundred D1 writes on a heavy editing day, well under the free limit.

### 12.6 Templates and migration [PROPOSED]

- A template is a JSON file: `{ id, version, name, sections: [{ moduleId, moduleVersion, defaults }] }`.
- Import validates every module id, version and default against the registry. Invalid files are rejected with a readable error list.
- Builds pin `template_id + template_ver`. Editing a template creates a new version; existing builds keep working on their pinned version.
- "Upgrade to v2" shows a per-section diff: added sections get defaults, removed sections are listed before deletion, and changed modules run their `migrate()` function. Upgrades happen one build at a time, never automatically.

---

## 13. API (all JSON, all Zod-validated)

All `/api/admin/*` routes require a valid Access JWT (§14).

| Method + path | Purpose |
|---|---|
| `GET /api/admin/pages/:id` | draft + published section list |
| `PATCH /api/admin/pages/:id` | autosave patch (with `updatedAt` guard) |
| `POST /api/admin/pages/:id/publish` | publish + version + purge + warm |
| `GET/POST /api/admin/builds` | list / create from template |
| `GET/PATCH/DELETE /api/admin/builds/:id` | read / autosave / delete (soft) |
| `POST /api/admin/builds/:id/publish` | publish |
| `POST /api/admin/builds/:id/upgrade` | template upgrade with diff confirm |
| `GET/POST /api/admin/templates` | list / import |
| `GET/POST /api/admin/devlog` | list / create |
| `GET /api/admin/devlog/:id/export` | post pack .zip |
| `GET/POST/PATCH /api/admin/milestones` | timeline |
| `POST /api/admin/media` | upload variants |
| `GET /api/admin/media/:id/usage` | where used |
| `POST /api/admin/media/:id/replace` | replace everywhere (selected usages) |
| `DELETE /api/admin/media/:id` | blocked if used |
| `GET /api/admin/versions?owner=…` | history |
| `POST /api/admin/versions/:id/restore` | restore (creates a new version) |
| `GET /api/admin/analytics?range=7d` | proxied GraphQL Analytics |
| `GET /api/admin/health` | section errors + system checks |

---

## 14. Security

1. **Access at the edge** protects `/admin*`, `/preview/*` and `/api/admin/*`. All three must be in the Access application's paths. **The biggest single risk in this whole system is a write route outside that policy.**
2. **Defence in depth**: the Worker also verifies the `Cf-Access-Jwt-Assertion` header on every admin request (signature against the team's public keys, `aud` = `CF_ACCESS_AUD`, expiry, email = Josef's). Requests failing this get 403 even if they somehow bypass the edge.
3. **CSRF**: admin writes require `Content-Type: application/json` and a same-origin `Origin` header.
4. **Input**: everything goes through Zod; text is escaped on render (Astro does this by default); no raw HTML fields exist.
5. **Uploads**: MIME sniffed, size-capped, keys generated server-side.
6. **Headers**: strict Content-Security-Policy (self + media subdomain + analytics beacon), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
7. **Secrets** only in Worker secrets, never in the repo.
8. **Test**: a CI test calls every `/api/admin/*` route without a token and expects 403.

---

## 15. Analytics [PROPOSED]

- Cloudflare Web Analytics beacon on every public page (not on admin or preview).
- ClientRouter navigations are reported as page views.
- The admin's Analytics panel calls `/api/admin/analytics`, which queries Cloudflare's GraphQL Analytics API with a read-only token stored as a Worker secret and returns views per path, top referrers, countries, and 7/30-day totals.
- [VERIFY] that the GraphQL dataset for Web Analytics is queryable on the free plan. Fallback: a link to the Cloudflare dashboard.
- No cookies, no consent banner needed.

---

## 16. Accessibility and motion

- Every animated module has a reduced-motion version: the Projects selector becomes a plain list/grid, the print rig shows the current print state, the hopper becomes a list with expandable slips, hover lift becomes outline only, page transitions become a 150 ms crossfade.
- Every interaction works by keyboard (the Projects selector: arrows, Enter, Space; the hopper: a "Feed it in" button).
- Focus is visible; focus moves to the new page's heading after navigation.
- Alt text is required on every image.
- Colour contrast is checked per ground (paper, ink, sun, stone, wood). [VERIFY] orange #F26B1D with small black text.

---

## 17. Deployment and CI

### 17.1 Flow

1. Josef (or Claude Code) pushes to `main` on GitHub.
2. Cloudflare Workers Builds (connected to the repo) runs: install → typecheck → tests → `astro build` → deploy.
3. Any failure stops the deploy; the live site stays on the last good version.
4. D1 migrations are applied as a deliberate step, never automatically.
5. Pull requests / other branches get preview deployments [VERIFY on free plan].

### 17.2 Commands and where to run them

All commands run in the **VS Code terminal opened at the repo folder** (or the WSL/Ubuntu terminal if the repo lives in WSL), unless noted.

| Task | Command |
|---|---|
| Install | `npm install` |
| Local dev with real bindings | `npx wrangler dev` (or `npm run dev`) |
| Typecheck | `npx astro check` |
| Test | `npm test` |
| Create a migration | `npx wrangler d1 migrations create josefyang-db <name>` |
| Apply migrations locally | `npx wrangler d1 migrations apply josefyang-db --local` |
| Apply migrations to production | `npx wrangler d1 migrations apply josefyang-db --remote` |
| Set a secret | `npx wrangler secret put CF_ACCESS_AUD` |
| Manual deploy (rarely needed) | `npx wrangler deploy` |

### 17.3 Backups

- A scheduled Worker (Cron Trigger) exports D1 to R2 weekly (`backups/db-YYYY-MM-DD.sql`), keeping the last 8 [PROPOSED].
- Media originals are kept in R2.
- Versions table = per-item undo; D1 Time Travel [VERIFY free retention] = whole-database restore.

---

## 18. Testing

| Layer | What | Tool |
|---|---|---|
| Schemas | every module's defaults + sample content validate; migrate functions | Vitest |
| Registry | no duplicate ids; all templates valid | Vitest (runs at build) |
| API | auth (403 without token), validation, `updatedAt` guard, replace-everywhere transaction | Vitest + Miniflare |
| Render | each page renders with one deliberately broken section and the rest intact | Vitest |
| E2E | admin edit → autosave → preview → publish → public page; router back/forward; reduced motion | Playwright |
| Performance | LCP/CLS/JS budgets on Home and a build page | Lighthouse CI |

---

## 19. Build order (phases)

1. **Skeleton**: repo, `decision.md`, `log.md`, Astro + adapter, bindings, D1 migration 0001, Access paths, JWT check, CI with tests. Ships an empty, deployable site.
2. **Core**: field library, registry, boundary, render pipeline, cache + purge + warm, media helpers.
3. **Admin shell**: sidebar, split view, preview iframe, schema-built forms, Text and Images panels, autosave, publish, versions.
4. **Plain modules**: hero, text blocks, Off the bench, build page sections, footer. All four pages work with no animation.
5. **Media**: browser-side resizing, upload, library, usage tracking, replace everywhere.
6. **Builds + templates**: create from template, import, upgrade flow, Failures derivation, bench + devlog + post pack.
7. **Islands**, one at a time: Projects selector (hardest: one state machine for lock/unlock scrolling, tested on phone, trackpad, keyboard) → About print rig → Failures hopper, each with its reduced-motion version.
8. **Transitions**: ClientRouter, selector lock-in, crossfades.
9. **Analytics + health panels.**
10. **Hardening**: performance budget, accessibility pass, security tests, backups, content entry.

Each phase is a deployable state. The site is usable after phase 4 even if no animation exists yet.

---

## 20. Risks and mitigations

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| 1 | An admin write route left outside the Access policy | Anyone could edit the site | Path list covers `/admin*`, `/preview/*`, `/api/admin/*`; Worker JWT check; CI 403 test |
| 2 | Free-plan CPU limit on cache-miss renders | Errors on first visit after publish | Cheap renders, cache warm on publish, static-prerender fallback |
| 3 | Projects selector lock/unlock scroll logic | Scroll traps, jumpy behaviour on some devices | One state machine; manual scroll always wins; E2E on phone, trackpad, keyboard |
| 4 | Hard-coded content in a module | Text or image can't be edited | Module rule §5.5 #1; review checklist; lint for raw strings/URLs in `View.astro` [PROPOSED] |
| 5 | Template migration | Old builds break when a template changes | Version pinning; one-at-a-time upgrades with diffs; `migrate()` per module |
| 6 | Router lifecycle bugs | Doubled animations, leaks, dead listeners | `onPage()` helper; E2E back/forward tests |
| 7 | Mixed-quality build images (phone shots, AI objects) | Home looks inconsistent | Fixed aspect ratios, focal points, empty states; one shooting/cut-out guide |
| 8 | Browser-side image encoding quirks (HEIC, huge photos) | Upload fails on some files | Fallback to WebP-only; size cap; clear error |
| 9 | Scope and time | Weeks of evenings; motivation drop | Phased plan: usable site at phase 4 |

---

## 21. Open questions

1. Repo name: `josefyang` or `josefyang-site`?
2. Home shows "From the devlog": latest entry only, or latest three?
3. CV: one PDF uploaded through Settings, or generated from site data later?
4. Media subdomain `media.josefyang.com`: OK?
5. Size tokens: are six steps (`xs`–`xxl`) enough, or does the display type need a separate "giant" step for the cropped name?

---

## 22. Glossary

- **Island**: a piece of a page that ships JavaScript; everything else is plain HTML.
- **Module**: one self-contained section folder (schema + view + optional island).
- **Schema**: the Zod definition of a module's fields; drives form, validation and render.
- **Draft / published**: the copy you edit vs the copy visitors see.
- **Edge cache**: copies of rendered pages stored in Cloudflare's data centres near visitors.
- **Access JWT**: the signed token Cloudflare Zero Trust attaches to Josef's requests after login.
