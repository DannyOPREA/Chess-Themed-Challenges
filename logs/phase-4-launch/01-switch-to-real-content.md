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
