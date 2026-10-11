# Reviving the app

The app ran the chess pub crawl on Saturday 2026-10-10 and was taken offline on 2026-10-11 (unit 4.02), so it can be brought back for another event. This page says what was left where, and how to bring it back.

## What was left where

- **The code** is all in this repository, on `main`. The real content set is `src/content/real.json` and `CONTENT_SET` in `wrangler.jsonc` is still `real`.
- **The Worker** `chess-themed-challenges` is still in Danny's Cloudflare account, with its secrets `HOST_PASSWORD` and `COOKIE_SECRET`, but `workers_dev` is `false` in `wrangler.jsonc`, so it has no public address and nobody can reach it. Unused Workers cost nothing on the free plan.
- **Workers Builds** is still connected to this repository, so every push to `main` still deploys, with the `workers.dev` address staying off until `wrangler.jsonc` turns it back on.
  If the database is deleted while the app is archived, every later push's build fails at its first step (applying migrations to `chess-crawl`), which does no harm but shows as a failed build until the database is recreated (step 2 below).
- **The database** `chess-crawl` (D1) still holds the 2026 game, in the Reveal, with all four migrations applied.
- **A copy of the 2026 game data** (players, completions, accusations) and its final results are in the Claude project's files, under `archive/2026-event/`: `live-data.json`, `live-data.sql` (to load into a local database) and `results.md`. They are not in this repository because it is public and they hold the players' names.

If Danny later deletes the Worker or the database, or archives this repository on GitHub, the steps below say what changes.

## Bringing it back

1. **If the repository is archived on GitHub**, unarchive it first: on GitHub, **Settings > General > Danger Zone > Unarchive this repository**. Nothing can be pushed or merged until then.
2. **If the Worker or the database was deleted**, recreate it by following `README.md`, "Deploying", "One-time setup", for whichever is missing (the names must be exactly `chess-crawl` and `chess-themed-challenges`). A new database gets every migration on the first deploy and starts empty in the Lobby. While `workers_dev` is still `false`, that first deploy succeeds but leaves the Worker with no address, so README step 6's "open it on your phone" waits until step 4 below. If both still exist, skip this step: the secrets and the build connection are still in place.
3. **Bring the code up to date** in a PR: `npm ci`, `npm run typecheck` and `npm test`. Update the packages if they are old (`npm outdated`), and run the checks again. `compatibility_date` in `wrangler.jsonc` can stay as it is.
4. **Bring it back online in one PR**, so the address only comes back once the old game is gone and the right content is chosen:
   - Set `"workers_dev": true` in `wrangler.jsonc` and update the comment above it.
   - Pick the content set: `CONTENT_SET` `test` if there will be a test run first (`CLAUDE.md` rule 4: test runs use the placeholders), or `real` if not. To change the real challenges, decoys or hints, edit `src/content/real.json`; it must keep exactly 20 of each.
   - Add a migration that clears the old game, made with `npm run db:generate -- --custom` and holding the same three statements as `migrations/0003_clear_game_for_real_content.sql`. The deploy applies migrations before it deploys the new version, so the 2026 players and results are gone before the address comes back.
   - Remove the "Archived" notes at the top of `README.md` and `CLAUDE.md`, so later sessions know the app is live again (merges to `main` redeploy it).
   Merging the PR makes Workers Builds deploy, and the app is back at `https://chess-themed-challenges.<your-subdomain>.workers.dev`, shown on the Worker's page in the Cloudflare dashboard. Don't enable the address from the dashboard instead: the next deploy would turn it off again while `wrangler.jsonc` says `false`, and the old game would be on show until someone resets it.
5. **After a test run on `test`**, switch to `real` the way unit 4.01 did: one PR that sets `CONTENT_SET` to `real` and adds another clearing migration.
6. The host page is `/host` (the password is `HOST_PASSWORD`; change it under the Worker's **Settings > Variables and Secrets** if wanted). Its "Reset the game" button also clears the game, at any time.
7. Open the address on a phone and check the join screen loads, then play a short game with two phones before the event.

## Taking it offline again

Set `"workers_dev": false` in `wrangler.jsonc` and merge to `main`. The next deploy removes the public address; the Worker, its secrets and the database stay as they are.

## Looking at the 2026 results again

`archive/2026-event/results.md` in the project files has the leaderboard and everyone's breakdown. To see them in the app itself, on a computer with this repository and a local database with no players in it (a fresh clone, or after `rm -rf .wrangler/state`):

```sh
npm ci
cp -n .dev.vars.example .dev.vars   # keeps an existing .dev.vars
npm run db:migrate:local
npx wrangler d1 execute DB --local --file path/to/live-data.sql
npx wrangler dev --var CONTENT_SET:real
```

Then open `http://localhost:8787/host/results` (any user name, and the `HOST_PASSWORD` in `.dev.vars`, `local-host-password` in the example). `--var CONTENT_SET:real` makes sure a `CONTENT_SET` in `.dev.vars` doesn't override the real set. `npm run dev` would show the same game with the placeholder text instead.
