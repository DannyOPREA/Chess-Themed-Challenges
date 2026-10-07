# Phase 3, unit 03: Accusations

- Status: In progress
- Log: [logs/phase-3-screens/03-accusations.md](../../logs/phase-3-screens/03-accusations.md)
- Depends on: 3.01 Join and rejoin

## Goal

The accusations screen: a player picks another player, then a challenge name. Each player has one active guess per other player, which they can change or clear until accusations close. Nobody learns whether a guess is right until the reveal.

## Scope references

- `docs/scope.md`, "Player screen": pick another player, then a challenge name; one active guess per other player; change or clear it until accusations close; no self-accusation; no feedback on accusations until the reveal.
- `docs/scope.md`, "Game phases": players make or change accusations only in Game on; everything is frozen once accusations close.
- `docs/scope.md`, "Joining and rejoining": the same name and PIN gets a player back their accusations (they are stored by player id, so this needs nothing here).
- `docs/phases.md`, unit 3.03.
- `CLAUDE.md` rules 2 (no spoilers: the screen shows only the player's own guesses and never whether one is right), 5 (test content only) and the stack (htmx, screens poll every 10 seconds, Zod with `@hono/zod-validator`).
- Unit 1.02: the `accusations` table (primary key `(accuser_id, accused_id)`, a check refusing self-accusation, challenge 1 to 20, cascades when a player is removed) and `phaseAllows(phase, 'accuse')` (Game on only). Unit 2.01 reads the same table at the reveal as everyone's final guesses. Unit 3.01: `requirePlayer` and `c.var.player`.

## Work

1. `src/db/accusations.ts`, with no schema change:
   - `listTargets(db, playerId)`: every other player (id and name), each with this player's own guess about them or null, ordered by name as the reveal orders them (`byName`, now exported from unit 2.01's `src/game/scoring.ts`). Nothing about anyone else's challenge, completion or accusations.
   - `setGuess(db, accuserId, accusedId, challenge | null)`: makes or changes the guess (one `INSERT ... SELECT ... ON CONFLICT DO UPDATE`), or clears it (a `DELETE`), each guarded in the same statement on `phaseAllows(phase, 'accuse')` and both players still existing, so a page loaded before accusations closed can't change a guess after. Returns `saved`, `closed` (accusations not open), `gone` (a removed player) or `self` (accusing yourself, checked before writing; the database refuses it too). Clearing a guess that isn't there counts as saved; a guess that should have been written but wasn't throws rather than saying "saved".
   - `currentPhase` (the phase as a subquery, for guarding a write) moves to `src/db/game.ts`, and `src/db/players.ts` and `src/db/host.ts` import it instead of keeping their own copies.
2. `src/routes/accusations.tsx`, at `/accuse`, behind `requirePlayer`, registered with one line in `src/index.ts`:
   - `GET /accuse`: in the Lobby, "Accusations open when the game starts." In Game on, one row per other player: their name, a list of "No guess" and the 20 challenge names in content order (as the hint list shows them) with the player's current guess selected, and a Save button; a count of how many players they have a guess for; and a line saying nobody finds out whether a guess is right until the reveal. Once accusations close (and at the Reveal), the same rows read-only: "Name: Challenge n" or "no guess", as their final guesses. A link back to `/play`. Shows "Nobody else has joined yet." when the player is alone.
   - `POST /accuse` (`accused`, `challenge`, empty to clear), checked with `zValidator`. With htmx, picking a challenge saves straight away (`hx-trigger="change, submit"`): the answer fills only the row's status line ("Saved: Challenge n." or "Guess cleared.") and updates the count above the list out of band, so the list itself is never replaced and a quick second pick, which htmx queues on the same form, is still sent; without JavaScript, the Save button posts the form and the page reloads with the same notice. A refused save (accusations closed, a removed player) sends the phone back to the whole screen with a notice (`HX-Redirect` for htmx). A tampered form or a self-accusation stores nothing and goes back to the screen. The answer to a right guess and a wrong one is the same.
   - `GET /accuse/poll?v=<fingerprint>`, every 10 seconds until the Reveal: an empty 204 while the phase and the list of other players are unchanged, otherwise `HX-Redirect: /accuse`, so the screen reloads (without any old `?done=` notice) when the host opens or closes accusations, someone joins late or is removed. The fingerprint is a SHA-256 of the phase and, outside the Lobby, the other players' ids and names; it leaves out the player's own guesses, so saving a guess doesn't reload the page, and the Lobby screen, which lists nobody, doesn't reload each time someone joins.
3. The player screen (unit 3.02) links to `/accuse`; this unit doesn't edit `src/routes/play.tsx`.

## Tests

`test/accusations.test.ts`:

- `setGuess`: one active guess per other player, changed and cleared (the row is deleted); guesses about different players and by different players are kept apart; no self-accusation; refused in the Lobby, Accusations closed and Reveal, leaving an existing guess unchanged; refused about or by a removed player. `listTargets` lists everyone else by name with only this player's own guesses.
- The screen: a phone that isn't logged in goes to `/` (htmx gets `HX-Redirect`); the Lobby wording; every other player listed with the 20 challenge names and never the player themselves; nobody else joined; no spoilers (only the player's own guesses selected, no decoys, descriptions, hints, completion or right/wrong wording, even when others have guessed and someone has completed); a right and a wrong guess get the same answer; saving, changing and clearing with a plain form post and with htmx (the row status and the out-of-band count); self-accusation, out-of-range, fractional, non-numeric and missing fields store nothing; frozen and read-only once accusations close and at the Reveal; a removed accused player; a cross-site post is refused.
- The poll: 204 while nothing changes, including after the player's own guess and a join during the Lobby; `HX-Redirect: /accuse` when a player joins during Game on, when accusations close, and when the game starts; no poll at the Reveal.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI.
- In a phone-sized browser on `npm run dev`: making, changing and clearing guesses in Game on, the read-only list once accusations close, and the screen reloading by itself when the host closes accusations.

## Not in this unit

- The player screen and its link to `/accuse` (3.02).
- Showing which guesses were right, who detected whom, and scoring (2.01, 3.05).
- Showing the same player's guesses live on a second phone: a second phone sees a guess made on the first when it next loads the screen.
