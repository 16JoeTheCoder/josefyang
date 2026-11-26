# Adding a project (recipe for a fresh Claude Code session)

Goal: Josef hands a session a project's assets and gets back a pull request with the project's modules, plus a ready `<slug>.zip`. He then imports the zip at **Admin → Builds → Import project (.zip)** and sees the build as a draft with every image in place.

## 1. Read first

1. `CLAUDE.md` (repo root), then `prompt/README.md` and the files it lists.
2. `board.md` rules (tokens only, no hex/rgb/URLs/sentences in `View.astro`, GSAP only inside islands via `onPage`, reduced-motion and no-JS fallbacks, never fabricate facts: use `[placeholders]`).
3. `docs/PROJECT-PACK.md` (the pack format, limits and field value shapes).
4. The module pattern: `src/core/fields.ts`, `src/core/module.ts` and one existing module such as `src/modules/own-tools/`.
5. Before any UI edit, the craft floor reference named in `board.md`.

## 2. Plan the page from existing modules

Reuse the generic showcase modules before writing new ones:

| Module | What it is for |
| --- | --- |
| `showcase-intro` | Breadcrumb, giant headline, intro, call-to-action |
| `showcase-media` | Heading, body, poster image with an optional short video |
| `showcase-switch` | Switchable views (toggle between states) |
| `showcase-figures` | Figures and numbers |
| `showcase-tabs` | Tabbed content |
| `showcase-end` | Closing block |

Open each `src/modules/showcase-*/module.ts` to see its exact fields. Only build a new module when the project has an interactive piece the generic ones cannot show.

## 3. Build the project's own piece as modules

- Folder `src/modules/<slug>-<piece>/` with `module.ts`, `View.astro` and, if it animates, `island.ts` (set `island: true`). Use the existing modules as the pattern. The registry discovers it automatically.
- Every text and every image is a field (`f.heading`, `f.body`, `f.image`, `f.video`, ...). Nothing hard-coded in `View.astro`. A video field is always paired with a poster image field.
- Defaults are bracketed `[placeholders]` and must validate and be publishable (`tests/registry.test.ts` checks this).
- Add `pages: ["build"]`. Keep to the design tokens in `src/styles/tokens.css`.
- Videos: H.264 MP4, under 25 MB, ideally with the index first so they stream: `ffmpeg -i in.mov -c:v libx264 -crf 28 -preset slow -vf scale=1280:-2 -an -movflags +faststart out.mp4`.
- Images: webp or png/jpg, wide enough for the slot (1600 px or more for full-width ones). Cut-outs need transparency (png or webp).

## 4. Write the pack

```
packs/<slug>/
  project.json
  media/<name>.<ext>
```

- `slug` in `project.json` must equal the folder name.
- Put the page together as `sections` (module ids and content, see `docs/PROJECT-PACK.md` for how each field value is written). Fill `meta` (title, kind, status, summary, year, built, madeWith, skills, links, selector image).
- Write real copy only from facts Josef supplied. Use `[placeholders]` for anything missing and list them in the PR.
- Every image/video needs sensible `alt`.

## 5. Zip it

```
npm run pack -- <slug>
```

This writes `dist-packs/<slug>.zip` (git-ignored). Attach or hand over that file: Josef imports it, so it must exist when you finish. If the PR cannot carry binaries, say exactly where the zip is.

## 6. Verify

Run, and fix everything they report:

```
npx vitest run
npx astro check
npm run build
```

To prove the pack, import the zip in the local admin (`http://localhost:4321/admin#builds`) and open the draft: check every image and video appears, then delete the test build. Screenshot the build page at 390 px and 1440 px and look at them.

## 7. Open the PR

Branch, commit the modules, `packs/<slug>/` and any docs. Do not commit `dist-packs/`. The PR description lists: the modules added or reused, placeholders still to fill, anything blocked, and how to import (below).

## 8. What Josef does

1. Merge the PR and deploy, so the new modules exist on the live site (the importer needs them).
2. Admin → Builds → **Import project (.zip)**, drop `<slug>.zip`.
3. Read the dry-run summary (new draft or update of an existing slug, sections, image and video counts, any problems in plain English), then confirm.
4. Open the draft, fix any orange text or missing alt text, preview, and publish when happy.
