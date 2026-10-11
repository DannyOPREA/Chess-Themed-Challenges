# Log: phase 4, unit 02: Archive after the event

Plan: [docs/phase-4-launch/02-archive.md](../../docs/phase-4-launch/02-archive.md)

## 2026-10-11: Plan written

**Done**
- Plan written, after Danny said on 2026-10-11 that the event was a success and asked for the code and deployment to be archived so it can be revived next year, without staying online meanwhile.

**Worked**
- Nothing yet.

**Didn't work**
- Nothing.

**Decisions**
- A new unit in phase 4 rather than an entry in `logs/general.md`. Why: it changes the deployed app's configuration (`wrangler.jsonc`), and app work goes in a unit's plan.

## 2026-10-11: Data saved, address turned off, revival guide written

**Done**
- Copied the live game out of `chess-crawl` with read-only `SELECT`s through the Cloudflare connector (every row of `game`, `players`, `accusations` and `d1_migrations`), into the Claude project's files under `archive/2026-event/`: `live-data.json`, `live-data.sql` and `results.md`. The game was in the Reveal.
- `wrangler.jsonc`: `workers_dev` is `false`, and the old comment saying local `CONTENT_SET` comes from `.dev.vars` now says it comes from `npm run dev`'s `--var` (it never was in `.dev.vars.example`).
- `docs/revival.md`, linked from `README.md` (with a note in "Deploying" that the address is off), `docs/README.md`, `logs/README.md` and `CLAUDE.md`. Unit 4.02 added to `docs/phases.md` (logged in `logs/general.md`).

**Worked**
- `live-data.sql` loaded into a fresh local D1 (`--persist-to` in a scratch folder) after `wrangler d1 migrations apply DB --local`: Reveal, all players and accusations. `wrangler dev --var CONTENT_SET:test` on it showed `/host/results` with the same leaderboard and breakdowns as `results.md`, which `scoreGame` worked out from `live-data.json`; the accusation points were also checked by hand.
- In the installed Wrangler (4.148), `workers_dev: false` makes `wrangler deploy` post `enabled: false, previews_enabled: false` to the Worker's subdomain setting, and with no routes it only logs "No targets deployed", so the deploy still succeeds. CI's `wrangler deploy --dry-run` passed.

**Didn't work**
- `wrangler deploy --dry-run` can't run in a session: the repo's permission rules deny `wrangler deploy*`. CI runs it instead.

**Decisions**
- Take the app offline by turning off `workers_dev` through a merge, not by deleting the Worker or the database. Why: Danny asked for it to be revivable; this can be undone by the same one-line change, goes through Workers Builds like every other production change (`CLAUDE.md` rule 7), and costs nothing on the free plan. Deleting anything, or archiving the repository, was put to Danny as a choice, recommending to keep everything.
- Workers Builds stays connected. Why: with the address off, a deploy changes nothing anyone can see, and keeping it means bringing the app back is one merge.
- The game data and results go in the project files, not the repository. Why: the repository is public and the data holds the players' names and PIN hashes (`CLAUDE.md` rule 5).
- `live-data.sql` updates the game row instead of inserting it. Why: migration 0001 already inserts row 1, so an insert fails on `game.id`; a local `d1 execute --file` runs as one batch, so a failing file loads nothing.
- Bringing the app back is one PR that turns the address on, picks the content set and adds a clearing migration. Why: the deploy applies migrations first, so the 2026 results are never on show to a player whose old cookie (7 days) or PIN still works, and a test run gets the placeholder set from the start.
- Status stays In progress until a follow-up docs PR records that the deploy passed and the address is off. Why: that can only be checked after the merge.

**Reviews**
- `/code-review` at high found: the first revival guide turned the address on before clearing the old game and before picking the content set (fixed, as above); this log had no work entry and the plan said Done before the deploy was checked (fixed); the guide didn't say to remove the "Archived" notes (added); README "Deploying" still said the app was live (fixed); a deleted database would fail every later build (noted in the guide); `cp .dev.vars.example .dev.vars` could overwrite an existing file (now `cp -n`), and `--var CONTENT_SET:real` looked redundant (kept: it overrides a `CONTENT_SET` in `.dev.vars`, which the reviewer confirmed); `logs/README.md` didn't list `revival.md` among the docs with no log (fixed).
- `unit-reviewer`, first run: no Blocking. Should fix: the missing log entry and status (fixed, as above) and the revival order (fixed). Notes: the stale `.dev.vars` comment in `wrangler.jsonc` (fixed); the local results steps need a database with no players (now said); `npm run db:generate -- --custom` instead of `npx drizzle-kit` (changed). The claim that builds fail without the database is inferred from `scripts/deploy.sh`, not tested, since that needs `--remote`.
