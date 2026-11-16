# 06. Process: how to build this

## 1. Before writing any code

1. Read every file in `prompt/` and open every mockup in `prompt/designs/` in a browser.
2. Write **`plan.md`** at the repo root: your own detailed interpretation of everything. It must include:
   - Your understanding of the goal, audience and brand in your own words.
   - The full module list per page, with each module's schema fields (role, maxLines, max, image slots with ratio + mode).
   - The D1 schema you will create (migration list), the routes, the API endpoints.
   - The admin screens and how each maps to the data.
   - How you will implement the hard parts: the Home floor pan, the Projects selector lock-in, the About print rig, the Failures hopper, text auto-fit, browser-side image resizing, cache purge + warm, Access JWT check.
   - The phase-by-phase build order (architecture §19) with what "done" means for each phase.
   - Risks you see and how you'll handle them.
   - Questions for Josef (only the ones that block you; otherwise decide and record it).
3. Show Josef a short summary of `plan.md` and wait for his go-ahead before Phase 1.

## 2. The three files you keep (repo root)

| File | Audience | What goes in it | When |
|---|---|---|---|
| `plan.md` | You and Josef | The detailed plan above. Update it when the plan changes, and mark phases done | Start, then on change |
| `log.md` | You | A running, dated log to keep yourself grounded: what you did, what's next, what's broken, where you left off. Short entries, newest at the bottom. Read it at the start of every session | Every work session, every phase |
| `decisions.md` | Josef | Every decision made mid-build that Josef should know about: what was decided, why, alternatives considered, and how to reverse it. Plain language, one entry per decision, dated | Whenever you choose something not already specified here |

Never let these drift. If you change direction, the decision goes in `decisions.md`, the plan update in `plan.md`, the event in `log.md`.

## 3. Design work: run /impeccable

Use the `/impeccable` skill throughout:
- Before building each page: run it to load context and shape the page (the mockups + `02-design-system.md` + `03-pages.md` are the brief; write `PRODUCT.md` and `DESIGN.md` for the repo via its init/document steps so future sessions share the same design context).
- After each page works: run its critique, audit and polish passes. Fix what they find.
- Final pass across all pages before launch: audit (accessibility, performance, responsive), polish, and a check against the AI-tells list in `02-design-system.md`.
- Verify by looking at the rendered result at 1440, 1024, 768 and 390 px widths (screenshots via Playwright), in batches, not after every tweak.

## 4. Subagents (Sonnet 5.5) for testing and bugs

Use Sonnet 5.5 subagents for verification work, so checking is done by a fresh pair of eyes that didn't write the code:
- **After each phase:** spawn a subagent to run the test suite, typecheck and build, and to read the diff against `plan.md` and the architecture, reporting bugs, missing requirements and rule violations (hard-coded content, raw hex values, missing reduced-motion fallbacks, admin routes outside Access).
- **For each island** (floor pan, selector, print rig, hopper): a subagent writes and runs Playwright tests for scroll, wheel, trackpad-like input, touch, keyboard, browser back/forward and reduced motion, and reports failures with reproduction steps.
- **Security pass:** a subagent calls every `/api/admin/*` route without an Access token and confirms 403; checks CSP headers.
- **Bug hunts:** when something breaks and the cause isn't obvious within a few minutes, hand it to a subagent with the reproduction and the relevant files.
- You fix the bugs; subagents find and verify. Record notable findings in `log.md`.

## 5. Phases (from architecture §19, adjusted)

1. Skeleton: repo files, Astro + Cloudflare adapter, bindings, D1 migrations, Access paths + JWT check, CI. Deployable empty site.
2. Core: field library (with the v1.1 text rule and image modes), registry, boundaries, render pipeline, cache purge + warm, media helpers, tokens.css from `02-design-system.md`, fonts, granite texture tile.
3. Admin shell: sidebar, split view, preview iframe, schema-built forms, Text + Images panels, autosave, publish, versions.
4. Plain modules: every page renders with no animation, all content editable, empty image states, footer, nav, mobile layouts. **The site is usable here.**
5. Media: browser resizing, upload, library, usage, replace everywhere, fit modes.
6. Builds + templates + devlog: create from template, Failures derivation, bench, devlog pages, post-pack export.
7. Islands, one at a time, each with reduced-motion and keyboard paths: Home floor pan → Projects selector → About print rig → Failures hopper.
8. Transitions: ClientRouter, selector lock-in, crossfades.
9. Analytics + health panels.
10. Hardening: performance budget, accessibility, security tests, backups, final /impeccable audit and polish.

## 6. Working rules from Josef

- Don't start building until Josef approves the plan. "Plan" means plan only.
- Lead with the answer; short executive summaries; flag the biggest risk; end with one question.
- Push back when something he asks for is weak, and say why.
- Lean, efficient code; know when to stop spending effort.
- Every command: say exactly where to run it (VS Code terminal at the repo root, Windows PowerShell, WSL/Ubuntu terminal, or browser).
- Never commit secrets. Never fabricate content.

## 7. Definition of done

- All pages in `03-pages.md` built, responsive (390–1920), matching the approved look.
- Every text and image editable in the admin; nothing hard-coded (a test greps `View.astro` files for raw strings and URLs).
- One broken module never breaks a page (render test with a deliberately broken section).
- Every island has keyboard, touch and reduced-motion paths; no scroll traps.
- Performance budget met (architecture §8.5); Lighthouse CI green.
- All `/api/admin/*` routes return 403 without Access.
- `plan.md`, `log.md`, `decisions.md` current.
- Final /impeccable audit and polish done; AI-tells checklist passes.
