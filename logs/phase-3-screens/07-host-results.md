# Log: phase 3, unit 07: Host results button

Plan: [docs/phase-3-screens/07-host-results.md](../../docs/phase-3-screens/07-host-results.md)

## 2026-10-08: Plan written and built

**Done**
- Danny asked at about 11:02 UK, after a game on the live app, for a button on the host page in the Reveal that opens the same leaderboard and points breakdown the players see. Wrote this plan, added the unit to `docs/phases.md`, the action to the host page list in `docs/scope.md`, and the Reveal exception to `CLAUDE.md` rule 2.
- Split unit 3.05's results into `loadResults` and a `Results` component in `src/routes/reveal.tsx`, used by both `/reveal` and the new `/host/results`. Added the button and route in `src/routes/host.tsx`, six tests in `test/host.test.ts`, and a line to `README.md`.

**Worked**
- `/reveal` needs a player cookie (`requirePlayer`), so the host couldn't simply link there without joining. Sharing the component gives the host the same screen with no second copy of the scoring or layout. `test/reveal.test.ts` passes unchanged.
- Typecheck and 302 tests pass.

**Didn't work**
- The first version of the new test had a hand-worked score wrong (Alice was given +1 for a completed challenge, but nobody guessed hers, so it is +5). The app was right; the test's figure was fixed.

**Decisions**
- A separate `/host/results` behind the host password, rather than letting the host into `/reveal`. Why: `/reveal` marks "(you)" from the phone's player cookie, and Danny asked not to have to be a player on the host's phone; the host's route already has the password check.
- The host's copy marks nobody and opens no breakdown. Why: the host page doesn't know which player is Danny's, and an all-closed list reads as a leaderboard to show round the table.
- Before the Reveal `/host/results` redirects to `/host` without reading the game. Why: the host page must not spoil the game for Danny, who also plays (`docs/scope.md`, "Host page"); the same rule as `/reveal`.
- The button is a primary button in the "Phase" section, in place of the next-phase button, which the Reveal doesn't have. Why: that is where the host looks after moving to the Reveal, and it's the one action left then.
- Updated `docs/scope.md` and `CLAUDE.md` rule 2 for the Reveal exception. Why: Danny's own request for the button is the OK `CLAUDE.md` asks for before changing the spec; after the Reveal every player already sees all of it.

## 2026-10-08: Code review

**Done**
- Ran `/code-review` at `high` on the branch against `main`. Eight findings, handled as follows:
  1. The test comparing the host's breakdowns with a player's compared nothing: it looked for "Everyone's breakdown", which the page writes with `&#39;`, so both sides were cut to their last character. Fixed: it starts at the first breakdown card, and checks the cut holds a challenge description. Checked by breaking the host's copy on purpose (dropping one accusation): the test then fails.
  2. The same test's normalising of the player's open card couldn't match (`<details open="" style=...>`). Fixed.
  3. Changing `docs/scope.md` and `CLAUDE.md` rule 2 needs Danny's OK. Left as it is: Danny's request for this button is that OK, as with unit 3.06; the change only lets the host see in the Reveal what every player already sees then.
  4. The `seeReveal` phase rule's comment only named players, though it now gates `/host/results` too. Fixed.
  5. The "Final results" heading was copied in both routes. Fixed: it is part of `Results`.
  6. The new test builds a player cookie by hand rather than through a shared helper. Left as it is: each test file keeps its own small helpers (the same call as unit 3.06's review), and `test/reveal.test.ts` builds it the same way.
  7. `loadResults`, a loader, was exported from a route file. Fixed: removed; both routes call `loadFinalGame` from `src/db/reveal.ts`, and `Results` scores the game itself.
  8. A reset in another tab between reading the phase and reading the game would show an empty results page. Left as it is: `/reveal` reads the same way, the window is milliseconds, and the result is an empty page, not a spoiler or a wrong score.
- Typecheck and 302 tests pass.

**Worked**
- Nothing new to note.

**Didn't work**
- Finding 1 above: the first version of the comparison test passed without checking anything.

**Decisions**
- `Results` takes the game and scores it, rather than taking scores. Why: both callers then do the same two steps (phase check, `loadFinalGame`), and no loader lives in a route file.
