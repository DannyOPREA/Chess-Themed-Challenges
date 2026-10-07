# Log: phase 3, unit 05: Reveal

Plan: [docs/phase-3-screens/05-reveal.md](../../docs/phase-3-screens/05-reveal.md)

## 2026-10-07: Plan written

**Done**
- Wrote the unit plan from `docs/phases.md`, unit 3.05, `docs/scope.md`, "Reveal" and "Detection and scoring", and 2.01's handover.
- Told the 3.02 Player screen and 3.03 Accusations threads, built in parallel, that the reveal lives at `/reveal` in its own route file, and suggested 3.02 sends players there from `/play` once the Reveal starts.

**Worked**
- Nothing to note yet.

**Didn't work**
- Nothing.

**Decisions**
- Plan and build in the same PR. Why: `docs/README.md` and the working agreement.
- The reveal is its own page, `/reveal`, rather than part of `/play`. Why: 3.02 owns `/play` and is being built at the same time; a separate file means no merge conflict, and 3.02 only has to send players there.

## 2026-10-07: Reveal built, and both reviews

**Done**
- Everything under the plan's "Work": players with no challenge in `src/game/scoring.ts` (logged in 2.01's log too, with 2.01's plan updated), `loadFinalGame` in `src/db/reveal.ts`, the reveal page at `/reveal` in `src/routes/reveal.tsx`, its route line in `src/index.ts`, `test/reveal.test.ts` (16 tests, including a five-player game worked out by hand) and three new tests in `test/scoring.test.ts`. Typecheck and 236 tests pass.
- The 3.02 Player screen thread confirmed it will show a "See the results" button on `/play` in the Reveal, linking to `/reveal`. The 3.03 Accusations thread confirmed the `accusations` table keeps one row per pair and deletes a cleared guess, which is what the reveal reads.
- Ran `/code-review` at `high` and the `unit-reviewer` agent (findings and what was done below).

**Worked**
- `unit-reviewer` played a seven-player game in a phone-sized browser: a late joiner, a changed and a cleared guess, a host completion fix while accusations were closed, a removed player, and a player with no challenge who rejoined from a fresh browser. Its hand-worked scores matched the leaderboard on all seven phones, and `/reveal` sent nothing before the Reveal (the htmx request got an empty body with `HX-Redirect: /play`).

**Didn't work**
- The first version put the anchor id on the `<details>` itself, so a leaderboard link scrolled to a closed breakdown. Fixed with a server-side `?show=` (below).

**Decisions**
- A player with no challenge stays on the leaderboard, with 0 challenge points and "Never got a challenge", and guesses about them are ignored, not counted as wrong. Why: 2.01 left this to 3.05; the player had nothing to guess, which is the app's fault rather than the accuser's, and removed players are already treated the same way. The full reasoning is in 2.01's log.
- Tied ranks are shown as `=1`. Why: the scope says tied players share a rank; the `=` makes the tie obvious in a list where names are ordered alphabetically within it, as in pub quizzes.
- The page doesn't poll. Why: the Reveal is the last phase and completions are final; polling would also close any breakdown a player had opened. Reloading shows the latest, for example if the host removes a player.
- The reveal needs a logged-in player, like the other player screens. Why: a phone that lost its cookie can get back in with name and PIN in any phase, and it keeps names off a public URL.
- The breakdowns are cards with collapsible sections, only the phone's own open. Why: twenty open breakdowns make a very long page on a phone; the summary line already gives each player's rank and total.
- `/code-review` findings:
  1. Guesses about a player with no challenge are ignored without a logged reason. Fixed: the decision above, here and in 2.01's log.
  2. The log had no build entry and 2.01's plan and log weren't updated. Fixed: this entry, and 2.01's plan and log.
  3. `loadReveal` read every challenge and accusation before checking the phase, against the plan's "reads nothing else". Fixed: the route reads the phase first with `getPhase`; `loadFinalGame` reads players and accusations only in the Reveal.
  4. Nothing links to `/reveal` yet. Not changed here: 3.02 owns `/play` and adds the button (agreed with that thread). If 3.05 merges first, the Reveal is reachable by its URL until 3.02 merges, and nobody plays before the whole-app check.
  5. Leaderboard links land on a closed breakdown. Fixed: links go to `/reveal?show=<id>#player-<id>`, which opens that breakdown on the server, with a test. Chosen over moving the id inside the `<details>` (Safari's support for opening on a fragment is uncertain) or a script.
  6. Negative totals used a hyphen while points used a typographic minus. Fixed: one `number()` helper, with a test.
  7. `challengeReason` repeated the scoring rules. Fixed: the reason is worked out from the challenge points themselves.
  8. Shared ranks were found by scanning the list for every row. Fixed: counted once per render.
  9. The test helpers `addPlayer` and the cookie value repeat ones in other test files. Not changed. Why: every test file in the repo keeps its own small helpers; a shared helper would touch files 3.02 and 3.03 are editing now.
  10. The pre-reveal test checks the body of a 303, which is always empty. Kept: it guards against a future version rendering instead of redirecting, and the htmx case checks its exact empty body.
- `unit-reviewer` (verdict "Fix needed", nothing Blocking):
  - Should fix: no build log entry; 2.01's plan and log not updated; the plan's "reads nothing else" didn't match; leaderboard links landed on closed breakdowns. All fixed (code review findings 2, 3 and 5 above).
  - Note: summary rows were about 32 px tall, and an open breakdown ran straight into the next summary. Fixed: each breakdown is a Pico card (`<article>`), which pads and separates them, and labels replace the large headings inside.
  - Note: mixed minus signs. Fixed (code review finding 6).
