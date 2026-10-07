# Phase 3, unit 06: Host reset button

- Status: In progress
- Log: [logs/phase-3-screens/06-host-reset.md](../../logs/phase-3-screens/06-host-reset.md)
- Depends on: 3.04 Host page

## Goal

A "Reset the game" button on the host page, so Danny can start again from an empty Lobby after a test game. Added at Danny's request on 2026-10-07, after playing through the live app alone, so the app is clean for the Thursday 2026-10-08 test run.

## Scope references

- `docs/scope.md`, "Host page": the reset is one of the host's actions (added with this unit, Danny's request of 2026-10-07). Like the rest of the host page, it shows no challenge or decoy.
- `docs/scope.md`, "Joining and rejoining": phones remember their player in a signed cookie (unit 3.01). After a reset there is no player for that cookie to match, so phones go back to the join screen.
- Unit 3.04's pattern for actions that can't be undone: a `GET` confirm page saying what happens, then a `POST` that does it and redirects with a `?done=` notice.
- `CLAUDE.md` rule 7: the reset only changes the game's data through the host page; it is not a deploy or a database command from a session.

## Work

1. `src/db/host.ts`:
   - `gameMarker(db)`: where the game is, as the phase, the highest player id (0 with nobody) and the number of players. Any join, removal, reset or phase change changes one of them, because player ids are never reused.
   - `resetGame(db, seen)`: if the game's marker still matches `seen`, deletes every accusation and every player and sets the game row (id 1) back to the Lobby, in one `db.batch` (a single transaction), and returns true; otherwise changes nothing and returns false. Accusations are deleted explicitly rather than left to the foreign key cascade. Player ids are not restarted: they are AUTOINCREMENT, so a phone still holding an old cookie can never be taken for a new player.
   - `test/reset-db.ts` (every test file's `beforeEach`) calls `resetGame`, so the tests and the host's reset clear the same tables.
2. `src/routes/host.tsx`:
   - A "Reset" section at the bottom of the host page, below "Emergency", with a "Reset the game" button (`contrast outline`, like the other buttons that can't be undone).
   - `GET /host/reset`: a confirm page carrying the game's marker in hidden fields, saying that every player and accusation is deleted, the game goes back to the Lobby, every phone goes back to the join screen, players join again as new players, and the host password stays the same; "This can't be undone"; a "Yes, reset the game" button and Cancel.
   - `POST /host/reset`: checks the form with Zod and runs `resetGame` with the marker from the page. It redirects to `/host?done=reset` ("The game was reset.") or, when the game has changed since the page was opened (an old tab, the Back button, a second tap after someone joined) or the form is bad, to `/host?done=reset-unchanged`, which says nothing was reset.
   - Both are behind the host page's `basicAuth`, `no-store` header and Hono's CSRF check, like every other `/host` path.
3. `README.md`: the host page section mentions the reset.

## Tests

`test/host.test.ts`, "resetting the game":

- The host page offers the button.
- The confirm page changes nothing and shows no challenge or decoy.
- Confirmed, from every phase, it deletes every player and accusation, goes back to the Lobby, and redirects with the notice; the host page then shows the notice, the Lobby and an empty player list.
- An empty game resets.
- A stale confirm page changes nothing: after a join, a removal (of a player who isn't the newest), a phase change or another reset. A second tap on the same page after someone joined changes nothing. A tampered form changes nothing.
- A phone logged in before the reset is sent to the join screen (a page load gets a redirect, an htmx poll gets `HX-Redirect`), and the same name can join again as a new player with a new PIN.
- It needs the host password and refuses a cross-site post; `/host/reset` is in the list of protected host paths.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI's `check` job.
- On `npm run dev`, in a phone-sized browser: with players and accusations in a game under way, the host resets the game from the host page after a confirm step, the host page shows the Lobby with nobody joined, and a player's open screen goes back to the join page on its next poll. A confirm page opened before someone joined resets nothing.

## Not in this unit

- Switching to the real content (unit 4.01). That unit's PR clears the game data too; it can call `resetGame` or do the same clear in a migration, as it chooses.
- Keeping players while clearing only accusations or completions. Danny asked for a clean start.
