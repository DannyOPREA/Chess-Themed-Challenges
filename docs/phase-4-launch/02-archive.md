# Phase 4, unit 02: Archive after the event

- Status: Done
- Log: [logs/phase-4-launch/02-archive.md](../../logs/phase-4-launch/02-archive.md)
- Depends on: the event (Saturday 2026-10-10) being over. Danny asked for this on 2026-10-11.

## Goal

The app is no longer reachable while nobody is using it, nothing needed to run it again is lost, and the repository alone says how to bring it back for another event.

## Scope references

- Danny's request of 2026-10-11: archive the code and the deployment so the event can be run again next year, without the app staying online in the meantime.
- `CLAUDE.md` rule 7: no deploys or `--remote` commands from a session, and the Cloudflare connector only reads. Taking the app offline therefore goes through a merge to `main`, like every other production change.
- `CLAUDE.md` rule 5: the real content and the players' details stay out of the repository's logs and PR text.
- `CLAUDE.md`, "Stop and ask Danny": deleting the Worker or the database, or archiving the repository, is Danny's call, since none of it can be undone by Claude.

## Work

1. Copy the live game data out of the `chess-crawl` database with read-only queries through the Cloudflare connector, into the Claude project's files (`archive/2026-event/`), not the public repository: `live-data.json` (every row), `live-data.sql` (to load into a database with the migrations applied) and `results.md` (the leaderboard and breakdowns, worked out with `scoreGame` from `src/game/scoring.ts`). Check that `live-data.sql` loads into a local D1 and that the host results screen shows the same scores.
2. `wrangler.jsonc`: `workers_dev` is `false`. The merge makes Workers Builds deploy, and `wrangler deploy` then turns off the Worker's `workers.dev` address. The Worker, its secrets, the build connection and the database stay, so bringing the app back is the same one-line change the other way. `preview_urls` was already `false`, so no other address serves it.
3. `docs/revival.md`: what was left where, and the steps to bring the app back (including when the Worker or database was deleted, or the repository archived), to take it offline again, and to look at the 2026 results locally. Linked from `README.md`, `docs/README.md` and `CLAUDE.md`.

## Tests

No game code changes, so no new tests. `npm run typecheck`, `npm test` and CI's `wrangler deploy --dry-run` still pass with `workers_dev` off.

## Done when

- The archive files are in the project files and the SQL copy loads locally.
- `docs/revival.md` is merged, and `npm run typecheck` and `npm test` pass.
- After the merge, the Workers Builds deploy succeeds and the `workers.dev` address no longer serves the app.

## Not in this unit

- Deleting the Worker or the database, emptying the database, or archiving the GitHub repository. These are Danny's decisions; `docs/revival.md` covers how to recover from each.
- Disconnecting Workers Builds: with the address off, a deploy changes nothing anyone can see, and keeping it connected means bringing the app back is one merge.
