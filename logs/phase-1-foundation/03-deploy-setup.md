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

## 2026-10-07: Reviews before merging

**Done**
- Ran `/code-review` at `high` on the branch against `main`, and the `unit-reviewer` agent. Fixed what they found, as below. CI's `check` job, including the new dry-run build, was green on the first commit.

**Worked**
- The unit reviewer confirmed in Wrangler's own code what the setup relies on: the D1 database is found by name for both migrations and deploy, the confirm prompts answer yes in Workers Builds (it detects `WORKERS_CI`), `wrangler deploy` always runs the `build` command, and the Worker must exist with its secrets before the first deploy. It also ran the dry-run build from a fresh clone and the app at a phone size.

**Didn't work**
- The earlier entry's reason for turning preview builds off was wrong. Worker Previews, which new Workers Builds projects use, don't inherit the production database; Wrangler 4.148 instead refuses to create a Preview when `wrangler.jsonc` has no `previews` block, so every branch build would fail. Off is still right; the reason is now that they would fail and nobody needs them. The `preview_urls: false` reason (old versions' URLs would run against the live database) stands.

**Decisions**
- `/code-review`: the deny list didn't cover other Wrangler commands that change production or the account. Fixed: sessions are now also denied `wrangler versions`, `rollback`, `delete`, `triggers`, `d1 create` and `d1 delete`. Why: `CLAUDE.md` rule 7.
- `/code-review`: migrations run before the deploy, so the old code briefly runs against the new schema, or until the next push if the deploy step fails. Kept the order and added "Migrations reach the live database on their own" to `README.md`: keep migrations additive. Why: the other order has the same gap the other way round (new code against the old schema), and additive migrations make either gap harmless.
- `/code-review`: drizzle-kit rebuilds a table with `PRAGMA foreign_keys=OFF`, which D1 ignores, so dropping the old table would delete or block the rows that reference it. Documented in the same `README.md` section: check generated SQL for rebuilds, and a unit that needs one plans it and tries it on the local D1 first. Why: no unit needs one yet; the first migration (unit 1.02) only creates tables.
- `/code-review`: the build token may not be under **My Profile > API Tokens**. Added the account tokens page as a fallback. Why: Cloudflare's docs say Workers Builds uses user tokens today, but the fallback costs one sentence.
- `/code-review`: a build started on connecting fails before step 5, with no new commit to retry it. Step 6 now says to retry that build. Why: otherwise the first deploy waits for the next merge.
- `/code-review`: `workers_dev: true` repeats Wrangler's default. Kept. Why: it sits next to `preview_urls` and says where the app lives; without it a reader has to know the default.
- `/code-review`: the log had no review entry yet. This entry.
- Unit reviewer, Should fix: the preview builds reason (above), plus the dashboard path to turn them off in case the connect dialog doesn't show it. Both fixed in `README.md` and the plan.
- Unit reviewer, notes taken: step 2 mentions choosing a `workers.dev` subdomain on a new account, step 6 says how to check the first deploy, and the secrets part warns that changing `COOKIE_SECRET` logs every player out. Why: each saves Danny a question for one sentence.
- Unit reviewer, note left: a migration whose result reports failure without throwing would let the deploy go ahead. Why: remote D1 errors throw through Wrangler's API calls, so the reviewer judged it can't happen in practice, and guarding against it would mean custom code around Wrangler.

## 2026-10-07: Second unit review

**Done**
- Ran the `unit-reviewer` agent again on the fixes (head 21b4268, with `main` and unit 2.01 merged in): Pass, nothing Blocking or Should fix. CI's `check` job was green on that commit.

**Worked**
- It confirmed the preview builds fix in the README, plan and log, and the new README text and deny rules.

**Didn't work**
- Nothing.

**Decisions**
- Its note that the deny list still allows a few remote Wrangler commands (`d1 time-travel restore`, `kv namespace create`, `r2 bucket create`): softened the plan's wording to say the list isn't complete, and added no more rules. Why: sessions have no Cloudflare credentials, and `CLAUDE.md` rule 7 is the guard; the deny list only catches the common slips.
- Its note that the `versions` rule also blocks read-only commands: left as it is. Why: sessions have no use for them.

## 2026-10-07: Deploy token that can use D1

**Done**
- `npm run deploy` now exports `CLOUDFLARE_API_TOKEN` from the build secret `DEPLOY_API_TOKEN` when it is set, so both migrations and the deploy use that token. README step 5 now has Danny make an "Edit Cloudflare Workers" token with D1 Edit and add it as that build secret.
- Checked the fallback in `sh`: with `DEPLOY_API_TOKEN` set the commands get it; empty or unset, they keep Workers Builds' own token.

**Worked**
- Danny could create a new user token with **Account > D1 > Edit**.

**Didn't work**
- The original step 5 failed when Danny tried it. On the token Workers Builds created for itself, D1 offered only Read; Edit was greyed out. Cloudflare's docs don't say why.
- Choosing another token under **Settings > Builds > API token** also failed: the list shows only the token Workers Builds made, not one created by hand. (The docs say "select one that you already own", but the dashboard doesn't offer it.)

**Decisions**
- Pass the token as a build secret rather than committing a `database_id` and dropping D1 from the build. Why: migrations must run against the live database, and that needs D1 Edit whatever the config says; a build secret is a documented Workers Builds feature, and Danny already had the token.
- A separate name, `DEPLOY_API_TOKEN`, rather than overriding `CLOUDFLARE_API_TOKEN` directly in the build settings. Why: the docs say only the listed default variables can be overridden and don't say whether a build variable beats the injected build token, while a variable of our own name is read by our script for certain.
- Use the new token for `wrangler deploy` too, not only for migrations. Why: with no `database_id`, `wrangler deploy` looks the database up by name, which also needs D1; with no D1 access it skips the lookup and the first deploy, onto the Hello World Worker that has no D1 binding yet, would fail.

## 2026-10-07: Review of the deploy token change

**Done**
- Ran `/code-review` at `high` on the change. Fixed the findings below. `npm run deploy` now stops at once with a message naming `DEPLOY_API_TOKEN` if the secret isn't set, instead of falling back to Workers Builds' own token as the entry above describes.

**Worked**
- Checked in `sh` that the script stops with the message and exit code 1 when the secret is empty or unset, and goes on to Wrangler with the secret's value when it is set.

**Didn't work**
- The fallback to Workers Builds' own token, built in the entry above, could only ever fail on D1, with an error that doesn't mention the secret. Replaced.

**Decisions**
- Fail fast without `DEPLOY_API_TOKEN`. Why: the fallback token can't use D1, so the fallback only turned a clear error into a confusing one (code review).
- README step 5 says to update `DEPLOY_API_TOKEN` after rolling or replacing the token, and step 6 says a fresh build after the next merge picks up the secret if a retried one doesn't. Why: both were gaps the code review found; one sentence each.
- README now matches the plan on what happens without the secret. Why: the code review found them disagreeing.
- Kept the "Edit Cloudflare Workers" template with All zones, rather than asking Danny for a narrower custom token. Why: the account has no zones (the app uses workers.dev only), so the zone permissions grant nothing in practice, and Danny already made this token; the code review's point about scope is noted here for the final review.
- Not made Windows-safe (the code review noted `cmd.exe` doesn't understand the script). Why: only Workers Builds, on Linux, runs it; sessions never deploy and nobody deploys by hand (`CLAUDE.md` rule 7).
