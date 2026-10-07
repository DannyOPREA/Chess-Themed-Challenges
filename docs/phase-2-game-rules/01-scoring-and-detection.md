# Phase 2, unit 01: Scoring and detection

- Status: Done
- Log: [logs/phase-2-game-rules/01-scoring-and-detection.md](../../logs/phase-2-game-rules/01-scoring-and-detection.md)
- Depends on: 1.01

## Goal

The game's end-of-night maths as pure functions: who was detected, each player's score exactly as the table in `docs/scope.md`, the leaderboard with shared ranks for ties, and the per-player breakdown the reveal shows. No database or screens; unit 3.05 loads the data and renders it.

## Scope references

- `docs/scope.md`, "Detection and scoring": a player is detected if at least one other player's final guess about them is correct, however many got them; the points table; the decoy is worth nothing; tied players share a rank.
- `docs/scope.md`, "Reveal": the breakdown shows each player's challenge, decoy, whether they completed it, who detected them, and their own correct and wrong accusations.
- `docs/phases.md`, unit 2.01.
- `CLAUDE.md` rule 3 (scoring and detection follow the scope exactly, with tests) and the conventions in `docs/phase-1-foundation/01-scaffold.md` (game logic in `src/game/`, challenges and decoys as numbers 1 to 20, tests in `test/`).

## Work

1. `src/game/scoring.ts`, with plain input types so it doesn't depend on the schema unit 1.02 is writing:
   - `ScoringPlayer`: `id`, `name`, `challenge`, `decoy`, `completed`. Ids are numbers (SQLite integer keys). `challenge` and `decoy` are `null` for a player who never got one (added by unit 3.05).
   - `ScoringAccusation`: `accuserId`, `accusedId`, `challenge` (the guess). Only final guesses are passed in; a cleared guess is simply absent.
   - `POINTS`: the scoring table as constants.
2. `detect(players, accusations)`: for each player id, the ids of the other players whose guess about them is right.
3. `scoreGame(players, accusations)`: the leaderboard, one `PlayerScore` per player, highest total first. Each entry carries the breakdown (`challenge`, `decoy`, `completed`, `detected`, `detectedBy` with names, `correctAccusations` and `wrongAccusations` with the accused player's name, the guess and their real challenge), the points (`challengePoints`, `accusationPoints`, `total`) and `rank`.
4. Rules for data the scope doesn't cover:
   - Ranks use standard competition ranking: tied players share a rank and the next rank skips (1, 1, 3). Within a tie, and in every list in the breakdown, players are listed by name, ignoring capitals.
   - `detect()` lists each player's detectors by id, lowest first, so the order doesn't depend on the order rows come from the database.
   - Ignored: accusations by or about a player who isn't in the player list (removed by the host), guesses about a player with no challenge, self-accusations, and guesses that aren't a challenge number from 1 to 20.
   - A player with no challenge (unit 3.05) is on the leaderboard with 0 challenge points, even if marked completed, and is never detected; their own guesses count as usual.
   - If one player has more than one guess about the same player, the last valid one passed in counts (ignored guesses never replace a valid one). The database should never hold two (unit 1.02), but a reveal that fails for everyone would be worse than a guess picked by order.
   - A player listed twice (same id) is scored once.

## Tests

`test/scoring.test.ts`:

- Every row of the scoring table: completed and not detected (+5), completed but detected (+1), not completed whether detected or not (0), each correct accusation (+2), each wrong accusation (−1, totals can go below zero), challenge and accusation points added together, and the decoy worth nothing (guessing someone's decoy is a wrong guess and doesn't detect them).
- Players with no challenge: 0 challenge points even if marked completed, guesses about them ignored, their own guesses scored, ranked with everyone else (added by unit 3.05).
- Detection by one player, by several (counted once), nobody detected, everyone detected, players with no accusations and a game with none, ignored self-accusations and accusations by or about removed players, the last of two guesses counting, guesses that aren't a challenge number, a fixed detector order, two players sharing a challenge (more than 20 players), and a player listed twice.
- Leaderboard order, ties sharing a rank with the next rank skipped, tied players ordered by name ignoring capitals, everyone tied, an empty game.
- A full game of five players worked out by hand in the test file's comment, with every score, rank and one full breakdown checked.

## Done when

- `scoreGame` and `detect` implement the scope's detection and scoring, with the tests above.
- `npm run typecheck` and `npm test` pass.

## Not in this unit

- Loading players and accusations from the database, and the reveal screen (3.05).
- Which accusations are allowed (one per other player, no self-accusation, frozen once closed): enforced when they are made (1.02, 3.03).
