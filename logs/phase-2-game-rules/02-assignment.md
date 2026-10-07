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

## 2026-10-07: Second unit review

**Done**
- Ran `unit-reviewer` again on the fixes. Verdict: Fix needed, with two Should fix findings and no Blocking. Fixed both, as below.

**Worked**
- The bad-value handling and the plan and log updates passed.

**Didn't work**
- `isEvenlyAssigned`, added after the first reviews, checked the whole table. The reviewer showed that after 21 players and two removals the table is uneven for good (assignments never change), so no joiner's pick could pass and 3.01's suggested re-pick loop would never end. Replaced it with `isLeastHeld(others, player)`, which checks only the joiner's numbers against everyone else. A fresh pick always passes it, and it still catches two joiners on the same free number, because each sees the other holding it.

**Decisions**
- Should fix: replace the whole-table check with the per-joiner `isLeastHeld`, with a test for the 21-minus-2 case. Why: the check must always be satisfiable by a fresh pick, or the caller loops.
- Should fix: the suggested pattern for 3.01 now says to leave the joiner out of the list when re-picking and to cap the retries. Why: otherwise the joiner's own clashing numbers count as taken, and two racing joiners could collide again.
- Notes taken into the plan: 3.04's guarded update checks `decoy` too, and changes the phase in the same batch; 3.01 assigns any player it finds with `null` numbers during Game on, covering someone who joins between 3.04's read and its write. Why: both are cheap for those units to do and easy to miss.

## 2026-10-07: Third unit review and merge

**Done**
- Ran `unit-reviewer` a third time. Verdict: Pass, nothing Blocking or Should fix. Took its notes into the plan, merged `main` (unit 2.01) into the branch, and merged the PR.

**Worked**
- The reviewer checked the merge with `main` in a scratch copy before it was done: no conflicts, typecheck clean, all tests passing.

**Didn't work**
- Nothing.

**Decisions**
- Note: two joiners re-picking in lockstep can collide every round (the reviewer reproduced it with adversarial timing). Added to the suggested pattern for 3.01: a short random wait before each re-pick, and when the cap is reached, keep the numbers, log a warning and let the join succeed. Why: it needs phones joining within milliseconds during Game on, and a rare shared challenge is better than a player locked out.
- Note: 3.04's suggested guard is now `challenge IS NULL OR decoy IS NULL`. Why: it matches `assignPlayers`, which fills in either half.
- Notes: the plan's wording for when `isLeastHeld` fails, and the missing "ignores players not yet assigned" test in the plan's list, fixed. Why: keep the plan matching the code.
