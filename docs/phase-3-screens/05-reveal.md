# Phase 3, unit 05: Reveal

- Status: Done
- Log: [logs/phase-3-screens/05-reveal.md](../../logs/phase-3-screens/05-reveal.md)
- Depends on: 2.01 Scoring and detection, 3.01 Join and rejoin

## Goal

The reveal screen every player sees once the host moves the game to the Reveal: the final leaderboard and each player's breakdown (challenge and decoy with their full descriptions, whether they completed it, who detected them, their own correct and wrong accusations, and the points for each), worked out by unit 2.01's `scoreGame` from what is in the database. Before the Reveal it shows nothing.

## Scope references

- `docs/scope.md`, "Reveal": a final leaderboard, and for each player their challenge, decoy, whether they completed it, who detected them, and their own correct and wrong accusations. A big-screen one-by-one reveal is not in scope.
- `docs/scope.md`, "Detection and scoring": the points table and shared ranks for ties (computed by 2.01; this unit only shows them).
- `docs/scope.md`, "Player screen": full challenge descriptions are only shown at the reveal.
- `docs/phases.md`, unit 3.05.
- `CLAUDE.md` rule 2 (no spoilers: nothing about other players reaches a phone before the Reveal), rule 3 (scoring follows the scope, with tests) and rule 5 (test content only).
- Unit 1.02's phase rules (`phaseAllows(phase, 'seeReveal')`: Reveal only) and schema; unit 3.01's `requirePlayer`.
- Unit 2.01's handover: `scoreGame` needed every player to have a challenge and decoy, so this unit decides what the reveal shows for anyone who never got one. 2.01's own rules stay: standard competition ranks (1, 1, 3), odd accusation data ignored rather than refused.

## Work

1. Players with no challenge, in `src/game/scoring.ts` (a change to 2.01's code, logged in 2.01's log too):
   - `ScoringPlayer` and `PlayerScore` allow `challenge` and `decoy` to be `null`.
   - Such a player is on the leaderboard like anyone else: 0 challenge points (they can't have completed anything), never detected, and guesses about them are ignored, as for a removed player, so nobody gains or loses a point over them. Their own guesses count as usual.
   - In practice this is almost never seen: everyone in the lobby is assigned at Game on, late joiners on joining, and anyone missed on their next screen during Game on (3.01). It only covers someone who joined at the last moment and never opened a screen before accusations closed.
2. `src/db/reveal.ts`: `loadFinalGame(db)` reads every player's id, name, numbers and completion, and every accusation, in one D1 batch, so the scores come from one consistent moment. Called only once the phase is the Reveal.
3. `src/routes/reveal.tsx`, `GET /reveal`, behind `requirePlayer`, registered with one line in `src/index.ts`:
   - It reads the phase first. Outside the Reveal it sends the phone to `/play` (a 303, or `HX-Redirect: /play` for an htmx request) and reads nothing else.
   - In the Reveal: the title "Final results"; the leaderboard as a table of rank, name and points, with tied ranks shown as `=1` and the phone's own row marked "(you)"; a collapsed "How points work" with the scope's table.
   - Each leaderboard name links to `/reveal?show=<id>#player-<id>`, which reloads the page with that player's breakdown open as well as the phone's own (following a link to a closed `<details>` doesn't open it). Anything in `show` that isn't a player id is ignored.
   - Then every player's breakdown, in leaderboard order, each a card (`<article>`) holding a collapsible `<details>` (the phone's own one open): challenge name and full description, decoy name and description, "Completed: Yes/No", "Detected by" (names, or "Nobody"), the challenge points with the reason, each correct accusation ("Bob: Challenge 3", +2) and each wrong one ("Bob: guessed Challenge 5, it was Challenge 7", −1), and the total. A player with no challenge shows "Never got a challenge". The reason for the challenge points is worked out from the points themselves, so the two can't disagree. Negative numbers use a typographic minus everywhere.
   - It doesn't poll: the Reveal is the last phase and completions are final by then. Reloading the page shows the latest.
4. The player screen (3.02) sends players to `/reveal` once the Reveal starts; agreed with the 3.02 thread, which owns `src/routes/play.tsx`.

## Tests

- `test/scoring.test.ts`, players with no challenge: 0 challenge points even if marked completed, never detected, guesses about them neither +2 nor −1, their own guesses scored, and ranked with everyone else.
- `test/reveal.test.ts`, through the Worker:
  - A phone that isn't logged in goes to `/`. In Lobby, Game on and Accusations closed, `/reveal` sends a logged-in phone to `/play` (htmx gets `HX-Redirect`), and the response holds no other player's name, challenge, decoy or completion.
  - A five-player game worked out by hand in the test file's comment: every rank and total on the leaderboard, a tie shown as `=`, and one full breakdown (descriptions, decoy, completion, detectors, correct and wrong accusations with points).
  - The phone's own row marked "(you)" and its breakdown open, and only that one; a leaderboard link opens that player's breakdown too, and a bad `show` value is ignored.
  - Negative totals shown with a minus sign.
  - A player with no challenge, a game with no accusations, and a removed player's guesses gone from everyone's scores.
  - Names are escaped.

## Done when

- `npm run typecheck` and `npm test` pass.
- In a phone-sized browser on `npm run dev`: a game moved to the Reveal by the host shows every player the same leaderboard, with the scores matching a hand calculation, and `/reveal` shows nothing before then.

## Not in this unit

- The player screen, including moving players from `/play` to `/reveal` (3.02), and accusations (3.03).
- A big-screen or one-by-one reveal (not in scope).
