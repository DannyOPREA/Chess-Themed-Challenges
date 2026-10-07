# Phase 3, unit 02: Player screen

- Status: In progress
- Log: [logs/phase-3-screens/02-player-screen.md](../../logs/phase-3-screens/02-player-screen.md)
- Depends on: 3.01 Join and rejoin

## Goal

The player's home screen at `/play`, where players land after joining: their own challenge, decoy and completion status, the "I've done it" button and its undo during Game on, the hint list of all 20 challenge names and hints, and what the screen shows in each phase. It replaces 3.01's placeholder and keeps its log-out button.

## Scope references

- `docs/scope.md`, "Player screen": own challenge, decoy and completion status; an "I've done it" button they can undo (honour system, the host can override it); the hint list of all 20 challenge names, each with its hint, visible from the start; full challenge descriptions only at the reveal; no one's completion status visible until the reveal.
- `docs/scope.md`, "Game phases": players mark their own challenge done only in Game on; everything is frozen once accusations close, and the host can still fix completions.
- `docs/phases.md`, unit 3.02. Screens poll every 10 seconds with htmx.
- `CLAUDE.md` rule 2 (no spoilers): nothing on this screen is about another player.
- Unit 1.02's phase rules (`phaseAllows(phase, 'markOwnCompletion')`: Game on only). Unit 3.01's `requirePlayer`, which also assigns a player found unassigned during Game on, and its "Not you? Log out" button.

## Work

1. `currentPhase` and `currentPhaseAllows(action)` in `src/db/game.ts`: the game's phase, and whether it allows an action (1.02's rules), at the moment a statement runs. They replace the private copies in `src/db/host.ts` (3.04) and `src/db/players.ts` (3.01); behaviour there is unchanged.
2. `setOwnCompletion(db, id, completed)` in `src/db/play.ts`: one `UPDATE` that applies only if the player exists, has a challenge, and `currentPhaseAllows('markOwnCompletion')`. Returns whether it applied. A tap from a screen loaded before accusations closed changes nothing.
3. `src/routes/play.tsx` replaces the placeholder. Every route is behind `requirePlayer` and sends `Cache-Control: no-store`, since the page holds the player's secret. A one-line `pageshow` script reloads the page when a browser shows it again from its back-forward cache (Safari does despite `no-store`), so Back after logging out on a borrowed phone lands on the join page.
   - `GET /play`: the player's name, the status section, the hint list and the log-out button.
   - The status section shows the phase and:
     - Lobby: the challenge and decoy appear, and accusations open, when the game starts; read the hints meanwhile.
     - Game on, Accusations closed and Reveal: the player's own challenge (name and description) with the completion status, and their decoy (name and description), marked optional and not affecting the score. A player with no challenge sees a line saying so instead.
     - Game on: "I've done it", or "Undo: I haven't done it" once marked (the form's `hx-sync` cancels a poll in flight, so an older poll answer can't land after the tap), and a "Make or change accusations" link to the accusations screen (`/accuse`, unit 3.03).
     - Accusations closed: the completion ("Not marked done" rather than "Not done yet" from here on) is frozen ("tell the host if it's wrong"), and a link to see your accusations (`/accuse`).
     - Reveal: a "See the results" link to the reveal (`/reveal`, unit 3.05).
   - The hint list: all 20 challenge names, in content order, each with its hint, in every phase. No descriptions.
   - `GET /play/status`: the 10-second htmx poll. It sends the state key it last saw (phase, assigned, completed); while that still matches it gets `204 No Content`, which htmx doesn't swap, otherwise the new status section. A section showing a notice has a key no poll matches, so the next poll clears the notice. When the phase has just become Reveal (the key it last saw is from another phase), the poll answers `HX-Redirect: /reveal`, so phones on this screen move to the results on their own; a plain visit to `/play` in the Reveal shows the screen with its link.
   - `POST /play/done` with `completed=true|false` (the state wanted, not a toggle, so a double tap is harmless), checked with `zValidator`. htmx gets the new status section; a plain form post goes back to `/play`. If `setOwnCompletion` refuses, the status shows "That wasn't saved: you can only mark your challenge done while the game is on" (`/play?done=refused` for a plain post). A tampered form changes nothing (htmx gets a 204, a plain post goes back to `/play`).
4. 3.01's tests that read the placeholder's wording now read the new screen's.

## Tests

`test/play.test.ts`, through the Worker:

- Lobby wording, with no button and no links to accusations or the reveal.
- The hint list: all 20 names and hints in every phase, and no challenge description except the player's own once assigned.
- Game on: own challenge and decoy with descriptions, "Not done yet", the button, the accusations link.
- No spoilers: another player's name, challenge description, decoy and completion are in neither the page nor the poll, in Game on and once accusations close.
- Accusations closed: completion shown frozen, no button. Reveal: the results link. A player who never got a challenge.
- `Cache-Control: no-store` on the page and the poll, and the `pageshow` reload script (with no Content-Security-Policy to block it).
- "I've done it" and undo from a plain form and from htmx (a fragment, not a page); a double tap; it doesn't touch another player's completion; refused in Lobby, Accusations closed and Reveal, including from a screen loaded in Game on, with the notice, which the next poll clears; a tampered form, by plain post and by htmx; a phone not logged in; the host's override shows.
- `setOwnCompletion` in each phase, for an unassigned player, and for a missing player.
- The poll: its attributes; 204 while unchanged; the new section when the phase changes, when the host changes the completion, and when Game on assigns the challenge; `HX-Redirect: /reveal` once when the Reveal starts, and not again; `HX-Redirect` for a removed player.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI.
- In a phone-sized browser on `npm run dev`: the screen in each phase, marking done and undoing it, the poll picking up a phase change and a host override, and a tap from a stale screen after accusations close.

## Not in this unit

- The accusations screen at `/accuse` (3.03) and the reveal at `/reveal` (3.05). This screen only links to them; until those units merge, the links give the 404 page.
- Host completion overrides (3.04, done).
