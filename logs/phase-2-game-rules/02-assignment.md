# Log: phase 2, unit 02: Assignment

Plan: [docs/phase-2-game-rules/02-assignment.md](../../docs/phase-2-game-rules/02-assignment.md)

## 2026-10-07: Plan written

**Done**
- Wrote the unit plan from `docs/phases.md`, unit 2.02.

**Worked**
- Nothing to note yet.

**Didn't work**
- Nothing.

**Decisions**
- Plan and build in the same PR. Why: `docs/README.md` and the working agreement.

## 2026-10-07: Assignment built

**Done**
- `src/game/assignment.ts` with `assignPlayers` (the lobby at the start of Game on) and `assignOne` (a late joiner), and `test/assignment.test.ts`, as the plan describes.

**Worked**
- One rule covers every case in `docs/scope.md`: pick at random among the numbers the fewest players hold. It gives unique numbers up to 20 players, even reuse beyond, and an unused number for late joiners, without special cases.

**Didn't work**
- First version of `assignPlayers` returned every player, assigned or not. Changed it to return only the players it assigned, so callers know exactly which rows to write and an assigned player visibly can't be touched.

**Decisions**
- Beyond 20 players, reuse goes to the least-held numbers, picked at random. Why: `scope.md` only says numbers "get reused"; spreading them evenly keeps any one challenge from being held by three players while another is held by one, which would make guesses unfair.
- Challenges and decoys are drawn independently, so a player's decoy number can equal their challenge number. Why: decoys in both content sets are a separate list, not paired with challenges, so the same number means nothing.
- The functions take any object with `challenge` and `decoy` (`number | null`) rather than a database row type. Why: 1.02 is writing the schema in parallel; matching it here would make the two units depend on each other. Callers pass their rows straight in.
- `CONTENT_SIZE` (20) is defined here. Why: assignment only needs the count, and importing 1.02's content would tie the units together; 1.02's tests check each set has 20.
- `Math.random` by default, injectable for tests. Why: it's random enough for a pub game, and nothing a player sees depends on predicting it, as assignments never leave the server before the reveal.
- Making the database read and write safe when two phones join at once is left to 3.01 and 3.04. Why: these functions don't touch the database; the plan's "Not in this unit" records it so those units don't miss it.
