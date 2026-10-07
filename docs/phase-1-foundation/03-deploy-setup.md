# Phase 1, unit 03: Deploy setup

- Status: Done
- Log: [logs/phase-1-foundation/03-deploy-setup.md](../../logs/phase-1-foundation/03-deploy-setup.md)
- Depends on: 1.01

## Goal

Everything Cloudflare Workers Builds needs to build the app, apply D1 migrations and deploy it on every push to `main`, and a short checklist of the steps only Danny can do in the Cloudflare dashboard. No session deploys anything (`CLAUDE.md` rule 7): this unit only prepares the config and the checklist.

## Scope references

- `docs/phases.md`, unit 1.03.
- `docs/scope.md`, "Hosting and tech": Workers and D1 on the free plan; deploying set up as a single step, with the details given at build time.
- `CLAUDE.md`: the stack (deploys through Workers Builds on every push to `main`), rule 7 (never deploy from a session; the Cloudflare connector is read-only), and "Stop and ask Danny" (settings, secrets and accounts are Danny's).

## Work

1. `npm run deploy`: `wrangler d1 migrations apply DB --remote && wrangler deploy`. Workers Builds runs it as its deploy command, so migrations reach the production database before the code that needs them. Wrangler answers its own "apply migrations?" prompt with yes in CI, and stops before deploying if a migration fails.
2. `wrangler.jsonc`:
   - no `database_id` for `DB`: Wrangler finds the production database by its name, `chess-crawl`, both when applying migrations and when deploying.
   - `workers_dev: true` and `preview_urls: false`: the app lives at its `workers.dev` address, and old versions don't get URLs of their own that would run old code against the current database.
3. `.node-version` (`22`): Workers Builds and CI both use Node 22, the version Wrangler needs at least. Workers Builds would otherwise use its default, Node 24, which CI doesn't test.
4. CI's `check` job reads the Node version from `.node-version` and ends with `wrangler deploy --dry-run --outdir dist`, which runs the build step and bundles the Worker without uploading anything, so a change that can't deploy fails before it reaches `main`.
5. `.claude/settings.json` denies `npm run deploy` in sessions, next to the existing deny rules for `wrangler deploy` and `--remote`.
6. `README.md`, "Deploying": how deploys work, and Danny's one-time checklist: create the `chess-crawl` database, create the `chess-themed-challenges` Worker, add the secrets `HOST_PASSWORD` and `COOKIE_SECRET`, connect the repository with `npm run deploy` as the deploy command and preview builds off, and give the build token D1 Edit.
7. `drizzle.config.ts`: its comment now says `npm run deploy` applies migrations in production.

## Tests

- No new automated tests: this unit adds no app code. CI's new dry-run step checks on every PR that the Worker still builds for deploying.
- Checked by hand in the session: `npx wrangler build` (the same dry run) from a clean checkout, with no `public/` folder and no `.dev.vars`, succeeds and lists the `DB` and `CONTENT_SET` bindings.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI's `check` job, which now also runs the dry-run build.
- `README.md` has Danny's checklist, and Danny has it in the thread after the merge.
- Nothing was deployed and no Cloudflare resource was created from a session.

## Not in this unit

- Doing the dashboard steps: Danny does them (`CLAUDE.md`, "Stop and ask Danny").
- The schema and migrations (1.02); this unit only makes sure they are applied on deploy.
- Preview deployments of branches: off, because they would share the production database.
