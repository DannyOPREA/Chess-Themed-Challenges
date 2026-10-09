# Log: phase 4, unit 01: Switch to real content

Plan: [docs/phase-4-launch/01-switch-to-real-content.md](../../docs/phase-4-launch/01-switch-to-real-content.md)

## 2026-10-09: Plan written and built

**Done**
- Danny said the Thursday test run was successful and asked for the live challenges at about 11:59 UK. That is the go-ahead `CLAUDE.md` asks for, and it lifts the merge freeze for this change only.
- Wrote the plan. Set `CONTENT_SET` to `real` in `wrangler.jsonc`, kept tests (`vitest.config.ts`) and local development (`.dev.vars.example`) on `test`, and added migration 0003, which clears the game, with two tests in `test/schema.test.ts`.
- Checked `src/content/real.json` against Danny's original file with a script (not committed): all 60 entries match, and the only differences are the two fixes in `docs/scope.md`.

**Worked**
- Typecheck and 304 tests pass. `test/content.test.ts` still finds the test set in tests, which shows the override in `vitest.config.ts` works over `wrangler.jsonc`.

**Didn't work**
- Nothing.

**Decisions**
- The game is cleared by a D1 migration rather than by Danny pressing the host page's reset. Why: `docs/scope.md` says the same change clears the game; the deploy applies migrations before the new version goes live, so no player can see the real content beside test players; and it needs nothing from Danny. Sessions can't run `resetGame` against the live database (`CLAUDE.md` rule 7). The migration does the same three changes as `resetGame`, by hand, because migrations are SQL.
- The migration was made with `drizzle-kit generate --custom`. Why: Drizzle's journal and snapshots stay in step, so the next `npm run db:generate` numbers its migration correctly.
- `wrangler.jsonc` holds `real`, with `test` set over it for tests and local development, rather than the other way round. Why: Workers Builds deploys `wrangler.jsonc` as it is, and the dashboard's own variables would be overwritten by it on every deploy.

## 2026-10-09: Reviews

**Done**
- Ran `/code-review` at `high` on the branch against `main`. Seven findings, handled as follows:
  1. If `wrangler deploy` failed after the migration ran, the old version would serve the test set over an empty game, and 0003 would never run again. Not changed: nothing is assigned in the Lobby, players store challenge numbers and the text is looked up when a page is drawn, so a retried build fixes it with nothing left to clear; the host page's reset covers anything else. The deploy is checked after the merge.
  2. Local development got the real set from any `.dev.vars` copied before this unit. Fixed: `npm run dev` is now `wrangler dev --var CONTENT_SET:test`, and the line in `.dev.vars.example` is dropped.
  3. `.claude/agents/unit-reviewer.md` told the reviewer to look for the `test` setting in `wrangler.jsonc`. Fixed: it says `npm run dev` sets it, and to stop if the screens show anything but the test placeholders.
  4. The plan's status and the log's review entry were missing. Fixed in this entry and the plan.
  5. `docs/scope.md` says Danny merges this PR. Not changed: Danny asked for the live challenges to be deployed, and under the working agreement (2026-10-07) Claude merges every PR and a merge is the only way to deploy, so that request is the merge.
  6. The migration copies `resetGame` by hand and could drift from it. Fixed with a test: after the migration every table but the game row is empty, and the test lists the tables, so a new table fails it until it is added.
  7. The test over an empty Lobby checked very little and nothing tested that 0003 runs only once. Fixed: replaced by a test that applying the migrations again leaves a game in progress alone.
- Ran the `unit-reviewer` agent on the first commit. Verdict "Fix needed", no Blocking findings. It replayed the live deploy locally (a game in the Reveal, then `wrangler d1 migrations apply` with the server running): the game was emptied, old phones and their polls went back to the join screen, and the same name joined as a new player. Two Should fix findings:
  1. Local development falling back to the real set: the same as code review finding 2, already fixed. The reviewer confirmed `--var` overrides `wrangler.jsonc` with a `.dev.vars` that doesn't set it.
  2. The plan's "Done when" asked for a new player on the live app, which would add a player to Saturday's game and needs the host password. Fixed: the check after the merge is read-only (the deployed Worker's settings and a `SELECT` on the live database), and the plan says the PR goes in before anyone joins.
- Its notes: a failed deploy is recoverable and the few seconds between the migration and the new version are harmless (both as in code review finding 1), and the weak test (code review finding 7).

**Worked**
- Typecheck and 305 tests pass.

**Didn't work**
- A first local check of the `--var` override hit a 500 on joining, because the reviewer had removed its temporary `.dev.vars` at that moment, so the dev server had no cookie secret. The reviewer's own check, with the secrets present, showed the override works.

- Ran the `unit-reviewer` agent again on the fixes: verdict "Pass", nothing Blocking or Should fix. It confirmed in a scratch copy that `npm run dev` serves the test set both with a `.dev.vars` holding only the secrets and with one that says `CONTENT_SET=real`, and found no real content in the diff, commit messages or PR text.

**Decisions**
- The PR is merged after the second `unit-reviewer` run passed. Why: the working agreement asks for the review to run again until it passes.
- The read-only check after the merge is reported to Danny in the project thread, not logged in a later PR. Why: nothing else should be merged to `main` before Saturday's event, since every merge redeploys the live app.
