# Phase 2, unit 02: Assignment

- Status: Done
- Log: [logs/phase-2-game-rules/02-assignment.md](../../logs/phase-2-game-rules/02-assignment.md)
- Depends on: 1.01

## Goal

The game rule that hands out challenges and decoys: random, different for every player while there are 20 or fewer, reused evenly only beyond 20, never changed once given, and an unused one for a late joiner. Pure functions over plain data, for units 3.01 (late joiners) and 3.04 (the lobby at the start of Game on) to call.

## Scope references

- `docs/scope.md`, "Assignment": random challenges and decoys, different for each player while there are 20 or fewer, reused beyond 20; assigned on joining during Game on, or at the start of Game on for the lobby; never changed after that, including on rejoin; late joiners get an unused challenge.
- `docs/phases.md`, unit 2.02.
- `CLAUDE.md` rule 1 (custom code is for the game itself, which assignment is), rule 3 (tests cover unique assignment and late joiners), rule 5 (tests use no real content; these use numbers only).
- `docs/phase-1-foundation/01-scaffold.md`, "Conventions for later units": challenges and decoys are numbers 1 to 20; game logic is pure functions in `src/game/`, one file per topic.

## Work

1. `src/game/assignment.ts`, with no database or content imports:
   - `CONTENT_SIZE` (20) and the types `Assignment` (`{ challenge, decoy }`), `AssignmentSlot` (the same, each `number | null` until assigned) and `RandomSource` (a `() => number` in [0, 1), `Math.random` by default, a seeded one in tests).
   - The one rule both functions share: each new number is picked at random from the numbers the fewest players hold. While 20 or fewer players hold numbers, that is always an unused number; beyond 20 it spreads the reuse evenly, so no number is held more than once more than any other. Challenges and decoys are drawn independently, since decoys aren't paired with challenges.
   - `assignPlayers(players, { random })`: for the start of Game on. Takes every current player (any object with `challenge` and `decoy`), fills in the missing values of those who lack one, and returns only those players, in input order, with their other fields kept. Values already held are never changed and count as taken. The input isn't modified.
   - `assignOne(current, { random })`: for a late joiner. Takes every current player and returns `{ challenge, decoy }` for one new player.
   - `isLeastHeld(others, player)`: whether a player's challenge, and separately their decoy, is still among the numbers the fewest of `others` hold (`others` leaves that player out). Every fresh `assignOne` pick passes, even when removals have left reuse uneven; it fails when someone else took the same number meanwhile while a less-held one is still free (or the host removed someone in between; a re-pick is harmless then). For 3.01 to re-check a late joiner after writing (see "Not in this unit").
   - Removed players are left out of the list by the caller, so their numbers are free again. Numbers already shared beyond 20 players stay shared if players are later removed, because assignments never change; new joiners still get the least-held number.
   - A missing value (`null` or `undefined`) means not yet assigned. A stored number outside 1 to 20 throws a `RangeError` rather than being quietly treated as free.

## Tests

`test/assignment.test.ts`, with a seeded random source over 25 seeds so failures repeat:

- Uniqueness: every lobby size from 1 to 20 gets all-different challenges and all-different decoys, all in 1 to 20; exactly 20 players use each number once; also with the default `Math.random` (unseeded on purpose; uniqueness holds for every random sequence, so it can't flake).
- More than 20: lobbies of 21, 25, 39, 40, 41 and 60 use every number, each held either ⌊n/20⌋ or ⌈n/20⌉ times.
- Never reassigned: players who already hold numbers are left out of the result and their numbers aren't given to anyone else; everyone already assigned gives an empty result; the input isn't changed; a half-assigned player keeps the half they have.
- Late joiners: joiners 6 to 20 each get an unused challenge and decoy; with 19 held, the joiner gets exactly the free one; beyond 20, a number freed by a removed player goes to the next joiner; joiners 21 to 45 keep the reuse even; lobby players with no numbers yet don't block anything; the first player ever gets a valid pair.
- Bad stored values: `undefined` is treated as unassigned; 0, 21, -1, 1.5 and NaN throw in all three functions.
- Re-checking: `isLeastHeld` passes every fresh pick across lobby sizes and seeds; catches another joiner who took the same challenge or decoy, and a re-pick then passes; allows sharing once every number is held; still passes for the joiner after 21 players lose two who alone held a challenge (the table stays uneven, the joiner gets a freed number); ignores players not yet assigned.
- Randomness: a first player can get any of the 20 challenges and decoys; a player's challenge isn't tied to their decoy or their place in the lobby; random values from -0.5 to 1.5 stay in range.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI's `check` job.
- The tests above pass.

## Not in this unit

- Reading and writing players in D1, and calling these functions: 3.01 (late joiners on joining during Game on) and 3.04 (the lobby when the host starts Game on). Two phones joining at the same moment could both read the same free numbers before either writes; the calling unit makes this safe. Suggested:
  - 3.04 changes the phase and writes the lobby's numbers in one D1 batch, each update guarded with `WHERE challenge IS NULL OR decoy IS NULL` (matching `assignPlayers`, which fills in either), so a double tap of "Game on" can't mix two runs. Someone joining between 3.04's read and its batch would be left in Game on with no numbers, so 3.01 also assigns any player it finds with `null` numbers during Game on.
  - 3.01 inserts the late joiner, re-reads every player, and checks the joiner with `isLeastHeld(everyone except the joiner, joiner)`. If it fails, it picks again with `assignOne` over everyone except the joiner, writes, and re-checks, up to a few times, all before the joiner is shown their numbers. Two joiners re-picking in lockstep can land on the same numbers again every round (the unit reviewer reproduced it), so wait a short random time before each re-pick. If the cap is still reached, keep the numbers, log a warning, and let the join succeed: a rare shared challenge is better than a player who can't join.
  - What 3.01 actually built (2026-10-07): the write-then-re-check pattern above can't work, because 1.02's trigger refuses changing an assignment once written. 3.01 instead writes the pick with one `UPDATE` that only applies if nobody took either number since the read, and picks again otherwise; see `docs/phase-3-screens/01-join-and-rejoin.md`. `isLeastHeld` is now used only by tests.
- Which phases allow joining and assignment: 1.02's phase rules.
- The content itself (names, descriptions, hints): 1.02.
