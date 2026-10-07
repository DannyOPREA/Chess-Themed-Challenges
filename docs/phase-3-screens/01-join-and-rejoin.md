# Phase 3, unit 01: Join and rejoin

- Status: Done
- Log: [logs/phase-3-screens/01-join-and-rejoin.md](../../logs/phase-3-screens/01-join-and-rejoin.md)
- Depends on: 1.02 Data and content, 2.02 Assignment

## Goal

Players join from their phone with a name and a 4-digit PIN, the phone remembers them, and the same name and PIN gets them back in from any phone with everything they had. Late joiners during Game on get an unused challenge and decoy, safely even when several phones join at once. The other player screens (3.02, 3.03, 3.05) get one helper that tells them who the current player is.

## Scope references

- `docs/scope.md`, "Joining and rejoining": no app or account, a name unique ignoring capitals, a 4-digit PIN, the phone remembers them, the same name and PIN gets them back in with the same challenge, decoy, completion status and accusations.
- `docs/scope.md`, "Assignment": assigned on joining during Game on, or at the start of Game on for the lobby; never changed after that, including on rejoin; late joiners get an unused challenge.
- `docs/phases.md`, unit 3.01, including showing the name trimmed.
- `CLAUDE.md`, "Stack": Hono signed cookies, the PIN as a salted SHA-256 hash via Web Crypto, no lockout after wrong PINs, Zod with `@hono/zod-validator`. Rules 2 (no spoilers), 3 (tests for late joiners and unique assignment) and 5 (test content only).
- Unit 1.02's phase rules (`phaseAllows(phase, 'join')`: Lobby and Game on) and schema (`players`, the trigger that refuses changing an assignment). Unit 2.02's handover in its plan's "Not in this unit": make a late joiner's assignment safe when two phones join at the same moment, and assign anyone found unassigned during Game on.

## Work

1. `src/auth/pin.ts`, shared with unit 3.04's PIN reset and identical on both branches: `pinSchema` (Zod, exactly 4 digits), `hashPin(pin)` (a fresh random salt, 32 hex characters from `crypto.randomUUID`, and Hono's `sha256` of salt and PIN, hex, for `pin_salt` and `pin_hash`) and `verifyPin(pin, stored)` (Hono's constant-time `timingSafeEqual`).
2. `cleanName(name)` in `src/game/names.ts`: the name as typed without the spaces `nameKey` ignores (spaces at either end, repeated spaces) and without invisible control and format characters (such as zero-width spaces; a zero-width joiner stays only between two emoji, so "👩‍💻" stays whole), which is what is stored, shown and looked up, so a name can't look blank or like someone else's.
3. `src/db/players.ts`:
   - `findPlayerByName(db, name)` by `nameKey`, and `createPlayer(db, name, pin)`: one `INSERT ... SELECT ... WHERE` the game's phase, at that moment, allows joining, `ON CONFLICT DO NOTHING`. It returns nothing if joining has closed or the name was taken, even a moment ago by another phone.
   - `ensureAssigned(db, player)`: a player with no challenge during Game on gets one; anyone else is returned unchanged. This covers late joiners and anyone who joined just as the host started Game on and was missed by the host's assignment (3.04).
   - `assignLateJoiner(db, id)`: reads every player's id and numbers and the phase in one batch, picks with 2.02's `assignOne` from everyone else's numbers, and writes with one `UPDATE` that only applies if the game is still in Game on, the player is still unassigned, and the number of other players holding the picked challenge, and the picked decoy, is still what was read. D1 runs each statement whole, one at a time, so no other phone can get between that check and the write. If it doesn't apply, another player was assigned first or the phase moved on: read and pick again (or stop, if the phase moved on). Each failed try means someone else's write succeeded, so the loop ends; after 20 tries (never reached in practice) it writes without the clash check and logs a warning, so a player is never locked out.
   - This replaces the pattern 2.02's plan suggested (write, re-check with `isLeastHeld`, re-pick after a random wait): 1.02's trigger refuses changing a challenge once written, and a check-before-write can't collide in lockstep, so no wait is needed.
4. `src/auth/session.ts`:
   - The cookie `player`, signed with `COOKIE_SECRET` by Hono's `setSignedCookie`, `HttpOnly`, `SameSite=Lax`, path `/`, for 7 days, and `Secure` whenever the app is served over HTTPS (always in production; not on `npm run dev`'s plain http, where Safari would drop it). Its value is the player's id and join time, so a removed player's phone, or a cookie from a game whose data was since cleared (4.01), counts as logged out.
   - `logIn(c, player)`, `logOut(c)`.
   - `getCurrentPlayer(c)`: the player this phone is logged in as, or nothing; it calls `ensureAssigned`, so a screen always sees the player's numbers during Game on.
   - `requirePlayer` middleware and the `PlayerEnv` type for the player screens: sets `c.var.player`, or sends a phone that isn't logged in to `/` (a 303 redirect, or an `HX-Redirect: /` header for htmx requests such as the 10-second polls, so htmx loads the join page as a whole page). It also clears a stale cookie.
5. `src/routes/home.tsx`, replacing the placeholder start page (the join QR code points at `/`):
   - `GET /`: a phone already logged in goes to `/play`. Otherwise the form: name (30 characters at most) and a 4-digit PIN (a password field with the numeric keypad). In Lobby and Game on it says "Join the game"; once accusations close it only offers getting back in.
   - `POST /`, checked with `zValidator`. A name nobody has is a new player, if the phase allows joining. A name already taken (ignoring capitals and extra spaces) is a rejoin and needs the right PIN, in any phase. A missing field counts as empty. Errors re-show the form with the name kept and the PIN cleared, with status 400: "Enter your name.", the length limit, "The PIN must be 4 digits", "That name is already taken. If it's you, check your PIN; if not, choose a different name.", and, once accusations close, "Nobody has joined with that name, and new players can no longer join…". On success: assign a late joiner, set the cookie, 303 to `/play`.
   - `POST /logout` ("Not you? Log out"): forgets the player on this phone and goes back to `/`. Name and PIN still get them back in.
6. `src/routes/play.tsx`: a placeholder at `/play` behind `requirePlayer`, showing only the player's own name, the phase, their own challenge and decoy names once assigned, and the log-out button. Unit 3.02 replaces this file with the player screen and keeps the log-out button.
7. One `app.route('/', play)` line in `src/index.ts`. The CSRF test now posts to a path with no route, as `/` takes posts.

## Tests

- `test/pin.test.ts` (shared with 3.04): salted hash, fresh salt each time, right and wrong PIN, `pinSchema` (4 ASCII digits only).
- `test/players.test.ts`: finding by name ignoring capitals and spaces; `createPlayer` with a taken name, refused once accusations close and allowed in Lobby and Game on; `ensureAssigned` waits for Game on, leaves assigned players alone and doesn't assign once accusations close; `assignLateJoiner` writes nothing once the phase has moved on, including when the host closes accusations between its read and its write; ten joiners racing with a random source that makes them all pick the same number get ten different challenges and decoys (five rounds; this fails with the clash check removed); racing beyond 20 players keeps each joiner's numbers least-held; a removed player; a player assigned meanwhile is never changed.
- `test/join.test.ts`, through the Worker:
  - The join page and its closed-phase wording.
  - Joining: stores a salted hash, not the PIN; the cookie's flags; lands on `/play`; a logged-in phone skips the join page; the name stored and shown trimmed.
  - Duplicate names in different capitals and spacing are refused with a different PIN; a wrong PIN is refused and sets no cookie; the right PIN gets the same player back.
  - Bad input (3- and 5-digit PINs, letters, empty PIN, empty or blank name, a 31-character name, no fields, no PIN field) gives 400 with a plain message, keeps the name, never echoes the PIN, stores nothing. Invisible characters are dropped, so a name of only zero-width characters is refused and a look-alike of a taken name counts as that name; emoji joined from several parts stay whole.
  - The cookie is `Secure` over HTTPS and not over plain http.
  - Lobby joiners stay unassigned; new names are refused once accusations close while rejoining still works.
  - Late joiners: joiners 6 to 20 all get unused challenges and decoys; with 19 taken, the joiner gets exactly the free one; 20 phones joining at the same moment all get different ones; a player missed by the host's assignment is assigned on their next screen; a 21st player gets a reused number rather than being refused.
  - Rejoining from a new phone keeps the same challenge, decoy, completion and accusations, in every phase.
  - The cookie: `/play` shows only the player's own challenge and decoy; no cookie sends the phone to `/`, and htmx gets `HX-Redirect`; a removed player's phone is logged out; a cookie edited on the phone, or correctly signed from an earlier game, is ignored; logging out clears it.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI.
- In a phone-sized browser on `npm run dev`: joining, a duplicate name, a wrong PIN, rejoining from a fresh browser with the same challenge, a late joiner during Game on, and logging out all work.

## Not in this unit

- The player screen itself, with the completion button and hint list (3.02), accusations (3.03), the reveal (3.05). They use `requirePlayer` and `c.var.player`.
- Changing the phase and assigning the lobby at Game on, removing players, resetting PINs and the QR code (3.04). Resetting a PIN doesn't log out phones already in.
- Clearing the game for the real content (4.01).
