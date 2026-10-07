# Log: phase 2, unit 01: Scoring and detection

Plan: [docs/phase-2-game-rules/01-scoring-and-detection.md](../../docs/phase-2-game-rules/01-scoring-and-detection.md)

## 2026-10-07: Plan written

**Done**
- Wrote the unit plan from `docs/phases.md`, unit 2.01, and `docs/scope.md`, "Detection and scoring" and "Reveal".

**Worked**
- Nothing to note yet.

**Didn't work**
- Nothing.

**Decisions**
- Plan and build in the same PR. Why: `docs/README.md` and the working agreement.

## 2026-10-07: Scoring and detection built

**Done**
- `src/game/scoring.ts`: `POINTS`, `detect()` and `scoreGame()`, which returns the leaderboard with each player's breakdown.
- `test/scoring.test.ts`: 21 tests covering every case in the plan, including a five-player game worked out by hand.
- `npm run typecheck` and `npm test` pass.

**Worked**
- Pure functions over plain data test without the Workers runtime doing anything special, so the tests are fast and need no database.

**Didn't work**
- Nothing.

**Decisions**
- Own input types (`ScoringPlayer`, `ScoringAccusation`) rather than the Drizzle row types. Why: unit 1.02 is writing the schema at the same time, and the reveal (3.05) can map rows to these in a line.
- Player ids are numbers. Why: SQLite integer keys are Drizzle's usual choice; if 1.02 picks text ids, the type changes in one place.
- Standard competition ranking (1, 1, 3), not dense ranking (1, 1, 2). Why: the scope only says tied players share a rank; competition ranking is what sports tables and quizzes use, so a player's rank still says how many people beat them.
- Ties, and the lists in each breakdown, are ordered by name ignoring capitals. Why: a stable, readable order; names are unique ignoring capitals, with the id as a last resort.
- Accusations by or about a removed player, and self-accusations, are ignored rather than refused. Why: the host can remove a player mid-game, and the reveal must still work; a removed player isn't on the leaderboard, so a guess about them can't be right or wrong.
- Two guesses by one player about the same player throw. Why: the database allows only one, so this would mean a bug elsewhere, and silently picking one could give a wrong score.
- The breakdown gives each accusation's guess and the real challenge as numbers, not names. Why: the reveal looks names and descriptions up in the content set (unit 1.02), which this unit doesn't depend on.
