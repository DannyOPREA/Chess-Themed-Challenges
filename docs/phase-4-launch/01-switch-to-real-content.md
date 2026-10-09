# Phase 4, unit 01: Switch to real content

- Status: Done
- Log: [logs/phase-4-launch/01-switch-to-real-content.md](../../logs/phase-4-launch/01-switch-to-real-content.md)
- Depends on: every earlier unit, the Thursday test run, and Danny's word (`CLAUDE.md`, "Stop and ask Danny"). Danny gave it on 2026-10-09 after the test run.

## Goal

The deployed app gives players Danny's real challenges, decoys and hints, and Saturday's game starts from an empty Lobby, with nothing left over from the test run.

## Scope references

- `docs/scope.md`, "Content": `CONTENT_SET` switches to `real` in one change that also clears all game data (players, completions, accusations, phase back to Lobby). The real list is built in as Danny wrote it, with the two fixes on import (unit 1.02 made them).
- `CLAUDE.md` rule 4 (development, automated tests and the test run use `test`), rule 5 (the real content stays out of tests, logs, screenshots and PR text) and rule 7 (no deploys or `--remote` commands from a session: the clear has to reach the live database through Workers Builds).

## Work

1. `wrangler.jsonc`: `CONTENT_SET` is `real`. The real set itself, `src/content/real.json`, came with unit 1.02; it was checked again against Danny's original file (same 20 challenges, decoys and hints, only the two fixes differ).
2. Local development and tests stay on the `test` set:
   - `vitest.config.ts` sets `CONTENT_SET` to `test` in the test bindings, over `wrangler.jsonc`.
   - `npm run dev` is `wrangler dev --var CONTENT_SET:test`, so local development gets the test set whatever is in `.dev.vars`.
   - `.claude/agents/unit-reviewer.md` says so, and tells the reviewer to stop if the local screens show anything but the test placeholders.
3. Clearing the game: migration `0003_clear_game_for_real_content.sql` (made with `drizzle-kit generate --custom`, so Drizzle's journal knows it) deletes every accusation and every player and sets the game row back to the Lobby, the same three changes as `resetGame` (unit 3.06). The deploy applies migrations before it deploys the new version (`scripts/deploy.sh`), so the test game is gone before any player sees the real content, and Danny has nothing to press. D1 records applied migrations, so it runs only once and never touches Saturday's game. Player ids keep counting up, so phones still holding a test player's cookie go back to the join screen.

## Tests

- `test/content.test.ts`: tests still run on the `test` set (now set by `vitest.config.ts`), and both sets keep their shape checks; the real set is checked for shape only, so its text stays out of tests.
- `test/schema.test.ts`, migration 0003:
  - run over a game in the Reveal with players, a completion and accusations, it leaves no players or accusations, the Lobby, and a new player's id higher than the old ones;
  - it empties every table but the game row, and the test names the tables, so a table added later without being added to the migration fails it;
  - applying the migrations again (what every later deploy does) leaves a game in progress alone.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI's `check` job.
- Merged before anyone joins Saturday's game, since the migration deletes whatever players the live database holds when it runs (Friday 2026-10-09).
- After the merge, checked from the session without writing anything: the deployed Worker has `CONTENT_SET` set to `real`, and a read-only `SELECT` on the live database shows migration 0003 applied, no players and the Lobby. Joining the live game from a session would add a player to Saturday's game, so it isn't done; Danny can join in the Lobby to see the real hint list and remove that player on the host page.

## Not in this unit

- Any change to the content itself or to how the game plays.
- Switching back to `test`. If that's ever needed, it is another one-line PR, and the host page's reset clears the game.
