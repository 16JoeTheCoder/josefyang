# josefyang.com

Josef Yang's personal site: Astro (strict TypeScript) on Cloudflare Workers with D1, R2, Zero Trust Access, a Preact admin, Zod and GSAP. The full brief is in `prompt/`; the build plan in `plan.md`; decisions in `decisions.md`; progress in `log.md`.

## Run it locally

All commands: **VS Code terminal opened at the repo root** (or the WSL/Ubuntu terminal if the repo lives in WSL). Node 22+.

```bash
npm install
cp .dev.vars.example .dev.vars          # PowerShell: Copy-Item .dev.vars.example .dev.vars
npm run db:migrate:local                 # creates the local D1 tables (and the default build template)
npm run db:seed:local                    # optional: real facts + bracketed placeholder builds/devlog for testing layouts
npm run dev                              # http://localhost:4321  and the admin at http://localhost:4321/admin
```

Locally the admin opens without a login because `.dev.vars` sets `DEV_ADMIN_BYPASS=1`. That bypass only works on `localhost` and only when `CF_ACCESS_AUD` is not set, so it can never open the live admin.

Checks (same terminal):

```bash
npx astro check      # type-check
npm test             # unit tests (fields, registry, no hard-coded content, Access check)
npm run build        # production build
npm run preview      # run the built Worker locally with wrangler (http://localhost:8787)
```

## Put it on Cloudflare (Josef runs these; nothing here was created for you)

Run in the **VS Code terminal at the repo root** unless it says browser.

1. Log in once: `npx wrangler login` (opens the browser).
2. Create the database: `npx wrangler d1 create josefyang-db`. Copy the printed `database_id` into `wrangler.jsonc` (replace the zeros) and commit it.
3. Create the media bucket: `npx wrangler r2 bucket create josefyang-media`.
4. Apply migrations to production: `npx wrangler d1 migrations apply josefyang-db --remote`.
5. Optional real starting content (Chronos + the three About milestones, no placeholders): `npx wrangler d1 execute josefyang-db --remote --file=seed/content.sql`. Never run `seed/dev-placeholders.sql` remotely.
6. Browser, Cloudflare dashboard > Zero Trust > Access > Applications: edit (or create) the "josefyang admin" self-hosted application so it covers **all three paths**: `josefyang.com/admin*`, `josefyang.com/preview/*`, `josefyang.com/api/admin/*`. Policy: allow only `josef@josefyang.com`. Copy the application's **AUD tag**.
7. Secrets:
   - `npx wrangler secret put CF_ACCESS_AUD` (paste the AUD tag)
   - `npx wrangler secret put CF_ACCESS_TEAM_DOMAIN` (e.g. `yourteam.cloudflareaccess.com`)
   - Optional, after step 10: `npx wrangler secret put CF_ANALYTICS_TOKEN`
8. Deploy: either connect the repo in the browser (Workers & Pages > Create > Import a repository > `16JoeTheCoder/josefyang`, build command `npm run build`, deploy command `npx wrangler deploy`) or run `npm run build && npx wrangler deploy` once by hand.
9. Browser, Workers & Pages > josefyang-site > Settings > Domains & Routes: add `josefyang.com` as a custom domain. The edge cache only works on the custom domain (not on `*.workers.dev`).
10. Browser, Analytics & Logs > Web Analytics: add the site, copy the token, then step 7's analytics secret.
11. Optional media domain: R2 > josefyang-media > Settings > Custom domains > `media.josefyang.com`, then set `MEDIA_BASE_URL` to `https://media.josefyang.com` in `wrangler.jsonc` and redeploy. Until then images are served by the Worker at `/media/*`.
12. Open `https://josefyang.com/admin`, sign in through Access, and publish each page once (Home, Projects, Failures, Devlog page, Devlog entry layout, About, Settings).

## How it is built

- `src/modules/<id>/`: every page section is one folder: `module.ts` (fields + defaults), `View.astro` (pure render, scoped CSS), optional `island.ts` (GSAP), `README.md`.
- `src/core/`: field library and text-fit rule (`fields.ts`), registry, render pipeline with per-section error boundaries, D1 queries, Access JWT check, edge cache, media helpers.
- `src/admin/`: the Preact admin. Every form is generated from the module fields, so a new module needs no admin code.
- `src/pages/api/admin/[...path].ts`: every write endpoint, Zod-validated, behind Access + a Worker-side JWT check.
- `migrations/`: D1 schema. Apply locally with `npm run db:migrate:local`.

Adding a section: copy a module folder, change the id, fields and view, add its id to a page layout in `src/core/db.ts` (or to a template). `npm test` fails if its defaults don't pass its own schema or its view hard-codes text, colours or URLs.
