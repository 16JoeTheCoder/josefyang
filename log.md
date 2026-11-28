# log.md

Newest at the bottom. Read this first every session.

## 2026-11-16 (unattended scheduled run)

- 21:58 WIB: Read all of prompt/ and screenshotted every mockup. Wrote plan.md, log.md, decisions.md.
- /impeccable: launcher needed `sh` (file not executable); ran fine via `sh scripts/impeccable context`. No question tool in this run, so PRODUCT.md is inferred from the brief and labelled as such.
- Next: branch claude/build-site, push, draft PR, then Phase 1 skeleton.
- 22:26 WIB: Phases 1–4 done in one pass (skeleton, core, admin shell, all plain modules), plus most of 5–7: media upload with browser resizing + library + replace everywhere, builds + templates + upgrade diff, devlog + post pack, all four islands (floor pan, selector, print rig, hopper) with reduced-motion/mobile fallbacks, ClientRouter on.
- Local DB: `.wrangler/state` with migrations 0001–0004 + seed (content + dev placeholders). Dev server: `npx astro dev --port 4321` (runs detached in Astro 7: `npx astro dev stop`).
- Tests: 78 unit tests pass; astro check 0 errors; build passes.
- Next: Sonnet subagents for island Playwright tests, security pass, admin E2E; fix findings; mobile screenshots at 390/768/1024; final /impeccable audit.
- 22:50 WIB: QA round 1 (islands + security, Sonnet subagents): no high bugs; fixed url schema (//evil.com), hopper drag selection, selector hash on load, floor neighbour peeks (scatter spacing), footer email fit, link underlines on empty images, 404 without DB, headers on early 403/415.
- 23:00 WIB: QA round 2 (admin E2E + rules review): fixed autosave timer (saver in a ref), milestone inputs losing focus, publish/restore status text, friendly media usage + health labels, 44px targets on phone, hard-coded aria labels → editable, rgb() literals → tokens (new test enforces it).
- Added weekly D1→R2 backup cron (src/worker.ts), font subset, Lighthouse check (home 99/100/100/100).
- Where to resume: Lighthouse CI in GitHub Actions; click-to-edit from preview (data-field-path); Library "Replace everywhere" should refresh open editors; AVIF variants; real content entry by Josef.
- Known: admin state can be stale after Replace everywhere until reload. Media upload writes the original to R2 before validating variants (orphan object possible on a bad variant).

## 2026-11-25 (plan v2 session)

- Read both handoff zips; merged with chat decisions into plan.md "Plan v2". Board for workers: board.md.
- Lead: video field contract, workshop hero (home-hero v2 + floor target), admin click-to-edit/live text/section library/drag. Sonnet workers: S1 Chronos modules + pack, S2 portfolio updates, S3 game hub, S5 packs + video, S6 blog, S7 admin polish. Reviewers after.
- Verified: Chronos pack → admin import → draft build with all media from R2 (preview /builds/chronos).
- Reviews done (R1 code/security, R2 public QA); all high/med findings fixed. Production build passes. Open items for Josef: see PR description.

## 2026-11-26 (production deploy)

- Deployed to josefyang-site from branch deploy/plan-v2 (version da0bffb4). The branch merges fix/admin-email-access: production was running it, main lacked it (real D1 id, three admin emails). Deploying main without it would be wrong.
- D1 migrations 0005 + 0006 applied. Pre-deploy backup: .wrangler/backups/prod-pre-planv2-2026-11-26.sql (not in git). Time Travel bookmark: 00000278-00000000-0000512f-b211d4be2d3f2676a29018692cc3d852.
- Incident: after the first deploy, cached HTML pointed at removed CSS files (404). Purged the zone cache, then added a per-build id to the edge cache key; second deploy verified clean without a purge.
- Chronos pack imported through the live admin as a draft. Not published.
- game.josefyang.com belongs to the separate josefyang-games Worker (not touched). docs/GAME-CONTRACT.md §8 assumes otherwise. GAME_HOST makes josefyang.com/games redirect there.
- Open: push branch/PR to main; published Home name "BuiltByJosef Portfolio" is 2 characters too long for the new hero (blocks Home publish); admin forms show un-migrated v1 hero content (public and preview show v2); About shows Greenmech placeholders publicly.

## 2026-11-28 (Phase 1: portfolio, content and mobile performance)

- Intake: main 965dc73 verified; V3 patch forward-only → applied (73 paths), overlay identical; check, 177 tests and build passed. Committed as e52e350 (V3 only).
- Baseline perf (V3, tests/perf/mobile.mjs, 390×844, 4× CPU, 1.6 Mbps/150 ms) recorded before changes.
- Built: host router + /games journey + /hub catalog, private host boundary, 60 s TTL + bounded purge, bounded reads + migration 0008, per-route CSS, floor cap + skip, On my bench, Home layout upgrade, About story, Chronos case study (pack updated), devlog strip bounded.
- Sonnet verifiers: browser QA 7/8 pass (fixed: no-JS tablist showing, Back to projects losing the build); data/security review (fixed: lean card query still read draft_json, text-band migrate overreach, catalog host serving /devlog/rss.xml, missing devlog order index, games-limit merge, query-key cache fan-out).
- Local fixtures: seed/dev-phase1.sql (fixture game + game updates), tests/fixtures/home-legacy.json, tests/e2e/route-fixture.sh, tests/e2e/freshness.sh.
- Open: Home LCP on touch +0.4 s vs V3 (floor transform settles after mount; 1.25 s, in budget); /devlog, /failures, /projects still read everything; production Access/routes/D1 unverified; Josef to confirm "student council" wording.
