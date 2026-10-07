# Log: phase 1, unit 03: Deploy setup

Plan: [docs/phase-1-foundation/03-deploy-setup.md](../../docs/phase-1-foundation/03-deploy-setup.md)

## 2026-10-07: Plan written

**Done**
- Wrote the unit plan from `docs/phases.md`, unit 1.03.

**Worked**
- Nothing to note yet.

**Didn't work**
- Nothing.

**Decisions**
- Plan and build in the same PR. Why: `docs/README.md` and the working agreement.

## 2026-10-07: Deploy setup built

**Done**
- Added `npm run deploy` (migrations, then deploy), `.node-version`, `workers_dev` and `preview_urls` in `wrangler.jsonc`, the dry-run build in CI, a session deny rule for `npm run deploy`, and the "Deploying" section of `README.md` with Danny's checklist.
- Read Danny's Cloudflare account through the connector, read-only: no Workers and no D1 databases yet, so the checklist starts from nothing.
- Checked by hand: `npx wrangler build` (`wrangler deploy --dry-run --outdir dist`, nothing uploaded) succeeds from a clean state, with no `public/` and no `.dev.vars`.

**Worked**
- Wrangler 4.148's own code (in `node_modules/wrangler`) answered how it behaves in Workers Builds: in CI it answers the migrations prompt with yes; a D1 binding with a `database_name` and no `database_id` is found by name, both by `d1 migrations apply` and by `deploy`; and a first deploy of a Worker that doesn't exist yet fails when the secrets in `secrets.required` aren't set.

**Didn't work**
- Nothing.

**Decisions**
- Danny creates the Worker from the Hello World template and adds the secrets before connecting the repository, rather than using "Import a repository". Why: `wrangler deploy` refuses to create a new Worker while its required secrets are missing, and the import flow builds straight away, so its first build would fail.
- Migrations run before `wrangler deploy`, in one deploy command. Why: new code may need the new tables; if a migration fails, the old code keeps running. This is the order Cloudflare's own D1 guides use.
- Danny creates the `chess-crawl` database in the dashboard, and the config names it without a `database_id`. Why: migrations run first, so the database must exist before the first deploy; Wrangler's automatic provisioning would only create it during `wrangler deploy`, after the migrations step had already failed. Finding it by name means no ID has to be copied into the repo.
- Danny adds **Account > D1 > Edit** to the build token. Why: Cloudflare's docs list the permissions of the token Workers Builds creates (Workers Scripts, KV and R2, no D1), and applying migrations and finding the database by name both need D1.
- `preview_urls: false`, and preview builds off in the checklist. Why: previews and old versions' URLs would run with the production database and secrets, possibly with code that doesn't match its schema; nobody needs them, since every unit is reviewed locally before merging.
- Node 22 pinned in `.node-version`. Why: CI already tested on 22, Wrangler needs at least 22, and Workers Builds defaults to 24 now. One file keeps both on the same version.
- CI also runs `wrangler deploy --dry-run`. Why: with migrations before deploy, a build that fails after merging could leave the database migrated and the old code running; catching build failures on the PR avoids that. It uploads nothing, so it isn't a deploy.
- The checklist lives in `README.md`, "Deploying", not in a new file under `docs/`. Why: it's how the project is run rather than a build plan, and `README.md` already says how to run it locally.
