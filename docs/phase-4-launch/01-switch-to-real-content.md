# Phase 4, unit 01: Switch to real content

- Status: In progress
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
   - `.dev.vars.example` sets `CONTENT_SET=test`; `.dev.vars` overrides `wrangler.jsonc` in `npm run dev`. A `.dev.vars` copied before this unit needs the line added.
3. Clearing the game: migration `0003_clear_game_for_real_content.sql` (made with `drizzle-kit generate --custom`, so Drizzle's journal knows it) deletes every accusation and every player and sets the game row back to the Lobby, the same three changes as `resetGame` (unit 3.06). The deploy applies migrations before it deploys the new version (`scripts/deploy.sh`), so the test game is gone before any player sees the real content, and Danny has nothing to press. D1 records applied migrations, so it runs only once and never touches Saturday's game. Player ids keep counting up, so phones still holding a test player's cookie go back to the join screen.

## Tests

- `test/content.test.ts`: tests still run on the `test` set (now set by `vitest.config.ts`), and both sets keep their shape checks; the real set is checked for shape only, so its text stays out of tests.
- `test/schema.test.ts`: migration 0003, run over a game in the Reveal with players, a completion and accusations, leaves no players or accusations, the Lobby, and a new player's id higher than the old ones; run over an empty Lobby it changes nothing.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI's `check` job.
- After the merge, the Workers Builds deploy succeeds; the live database has migration 0003, no players and the Lobby (read-only check); and a new player on the live app is shown a challenge from the real set once Game on starts.

## Not in this unit

- Any change to the content itself or to how the game plays.
- Switching back to `test`. If that's ever needed, it is another one-line PR, and the host page's reset clears the game.
