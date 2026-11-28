# End-to-end checks (Playwright, run by hand)

Need the local dev server (`npm run dev`, http://localhost:4321) with seed data (`npm run db:seed:local`). Run from the repo root in the VS Code terminal.

- `node tests/e2e/qa1.cjs` … `qa5.cjs`: islands (floor pan, selector, hopper, print rig, devlog filters, router back/forward, reduced motion, 390–1440 widths).
- `node tests/e2e/csp-console.cjs`: no CSP violations or console errors on every page.
- `bash tests/e2e/auth-403.sh`: every `/api/admin/*`, `/admin*`, `/preview*` path returns 403 without an Access token. Needs the production build running without the dev bypass:
  `npm run build && npx wrangler dev -c dist/server/wrangler.json --port 8788 --var DEV_ADMIN_BYPASS:0 --var CF_ACCESS_AUD:test --var CF_ACCESS_TEAM_DOMAIN:example.cloudflareaccess.com`

Phase 1 fixtures (repo root, after `npm run build`, local D1 migrated + seeded incl. `seed/dev-phase1.sql`):

- `bash tests/e2e/route-fixture.sh`: main/catalog/local host routes (status, Location, canonical, robots, cache) with dummy hosts.
- `bash tests/e2e/freshness.sh`: miss vs hit, stale until the 60 s TTL without a purge, fresh at once after a publish (~70 s).
- `NODE_PATH=$(npm root -g) node tests/perf/mobile.mjs http://localhost:8788 out.json / /projects /builds/chronos /games`: mobile lab sample (cold + warm, 3 runs) against `npm run preview`-style wrangler on port 8788.
