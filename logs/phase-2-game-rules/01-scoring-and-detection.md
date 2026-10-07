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

## 2026-10-07: Code review and unit review

**Done**
- Ran `/code-review` at `high` on the branch's diff against `main`. Ten findings, handled as follows:
  1. A second guess by one player about the same player made `scoreGame` throw, so a double tap that slipped past the database would break the reveal for everyone. Fixed: the last guess passed in counts. This replaces the "throw" decision in the entry above. Also told the unit 1.02 thread that a unique (accuser, accused) index would guarantee one guess per pair.
  2. A player listed twice (same id) was scored twice and pushed everyone below down a rank. Fixed: scored once.
  3. Guesses outside 1 to 20 (for example a cleared guess mapped to 0) cost a point. Fixed: ignored.
  4. `detect()` listed detectors in input order while `scoreGame` sorted them by name. Fixed: `detect()` sorts them by id.
  5. Accusations were validated twice. Fixed: one pass (`judge()`).
  6. Each player rescanned every accusation. Fixed: accusations are grouped by accuser in one pass.
  7. Ranks used `findIndex` per player, relying on the sort above it. Fixed: one pass comparing with the previous total.
  8. Name order used `sensitivity: 'base'`, which also ignores accents, while the plan says "ignoring capitals". Fixed: `sensitivity: 'accent'`.
  9. Plan status still "In progress". Set to "Done" in this entry's commit.
  10. No test with two players sharing a challenge (more than 20 players). Added.
- Ran the `unit-reviewer` agent. Verdict "Fix needed", nothing blocking; it worked the five-player game and its own six-player game by hand and both matched. Findings:
  - Should fix: no test with a shared challenge. Added (code review finding 10).
  - Note: the tie test didn't prove names are ordered ignoring capitals. Added a test tying `alice` and `Bob`.
  - Note: `detect()` had no test of its own for self-accusations and removed players. Added.
  - Note: duplicate guesses throwing would break the reveal. Fixed (code review finding 1).
  - Note: `ScoringPlayer` needs a challenge and decoy, so the reveal (3.05) decides what to do about anyone without an assignment. Left for 3.05.
- Updated the plan's rules and tests to match. 26 tests in `test/scoring.test.ts`; typecheck and all tests pass.

**Worked**
- Both reviews agreed the scoring maths matched the scope; every finding was about awkward input.

**Didn't work**
- Nothing.

**Decisions**
- Bad input is ignored or resolved rather than thrown. Why: the reveal runs once, on the night, for everyone; a wrong-looking guess costing nothing is better than a 500 page for 20 players.

## 2026-10-07: Second unit review

**Done**
- Ran the `unit-reviewer` agent again on the fixed branch. Verdict "Pass", nothing blocking or to fix. It re-worked the five-player game and a new six-player game by hand (with a removed player, a self-accusation, duplicate and out-of-range guesses and a tie), and both matched. Notes:
  - The plan said "the last one passed in counts", but ignored guesses (out of range, self, removed player) never replace an earlier valid one. Fixed the plan's wording to "the last valid one".
  - `CHALLENGE_COUNT` is a local 20 rather than the content's count. Left: the scope fixes 20, and unit 1.02's content module isn't merged yet.
  - A player id listed twice with different data keeps the first copy silently. Left: it only guards against a bad query in 3.05.
  - This log entry was still to be written. Done.

**Worked**
- Nothing new to note.

**Didn't work**
- Nothing.

**Decisions**
- None new.
