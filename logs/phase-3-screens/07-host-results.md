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
