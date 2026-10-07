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

## 2026-10-07: Reviews

**Done**
- Ran `/code-review` at `high` on the branch against `main`, and the `unit-reviewer` agent. Fixed or answered every finding (below), and updated the plan to match.

**Worked**
- `unit-reviewer`: Pass, nothing Blocking or Should fix. It did not run the app, as no app code changed (the functions aren't called by any route yet). It checked the distribution of the 5th lobby player's challenge over 200,000 runs: every number came up between 9,762 and 10,170 times against 10,000 expected.

**Didn't work**
- Nothing.

**Decisions**
- `/code-review`: two phones joining at once can both pick the same free number, and the API gave callers no way to notice. Fixed: added `isEvenlyAssigned` and wrote a suggested safe pattern for 3.01 and 3.04 into the plan. Why: D1 can't read and then write conditionally inside one transaction from a Worker, so the caller needs a cheap re-check after writing; the joiner hasn't seen their numbers yet, so re-picking doesn't break "never changes".
- `/code-review` and `unit-reviewer`: an `undefined` value counted as assigned, so such a player would never be assigned. Fixed: `== null` checks, with a test.
- `/code-review`: stored numbers outside 1 to 20 were quietly ignored, leaving that player with an invalid challenge and their number counted as free. Fixed: they throw a `RangeError`, with a test. Why: a corrupt row should fail loudly rather than hand out a duplicate.
- `/code-review`: two tests used the unseeded `Math.random`. Fixed the 20-player one; kept the "default random source" test unseeded on purpose, with a comment. Why: it exists to check the default, and uniqueness holds for every sequence, so it can't flake.
- `/code-review`: `assignOne` could reuse `assignPlayers`. Not changed. Why: through `assignPlayers`, any unassigned players in the list would be given numbers first, changing what the joiner gets; both already share `pickLeastUsed`, so the rule lives in one place.
- `/code-review`: support for half-assigned players is unneeded. Not changed. Why: it is a few lines, never wrong, and keeps a held value unchanged, which is the rule that matters; nothing creates such rows today.
- `/code-review`: the clamp for a random value of 1 guards a case the type rules out. Kept, and widened to negative values after `unit-reviewer` showed a negative value gave `undefined`. Why: one line, and a broken injected source then still yields a valid number.
- `unit-reviewer`: the removed-player test repeated the 19-held one. Replaced it with the case beyond 20: 21 players, remove one who alone holds a number, and the next joiner gets it.
- `unit-reviewer`: numbers shared beyond 20 stay shared if players are later removed. Recorded in the plan, no code change. Why: assignments never change (`scope.md`).
- `unit-reviewer`: the race must actually be handled in 3.01 and 3.04. Recorded in the plan's "Not in this unit" with the suggested pattern.
