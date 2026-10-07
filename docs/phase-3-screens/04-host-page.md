# Phase 3, unit 04: Host page

- Status: In progress
- Log: [logs/phase-3-screens/04-host-page.md](../../logs/phase-3-screens/04-host-page.md)
- Depends on: 1.02 Data and content, 2.02 Assignment

## Goal

The password-protected host page Danny runs the night from: who has joined, moving the game through its phases (assigning the lobby when Game on starts), fixing a player's completion, resetting a PIN, removing a player, the join QR code, and the clearly marked emergency "show all" button. Danny also plays, so the page never shows a challenge or decoy outside that button.

## Scope references

- `docs/scope.md`, "Host page" (everything the host can do; no challenges or decoys except behind "show all"), "Game phases" (moved by hand, forward only; the host can still fix completions once accusations close), "Assignment" (the lobby is assigned at the start of Game on; never changed after).
- `docs/phases.md`, unit 3.04: each phase change asks the host to confirm first, because phases only move forward (unit 1.02).
- `CLAUDE.md`: the stack (Hono `basicAuth` with the `HOST_PASSWORD` secret, `uqr`, Zod with `@hono/zod-validator`, htmx polling every 10 s, PINs as salted SHA-256 via Web Crypto), rule 2 (no spoilers), rule 3 (tests for unique assignment).
- Unit 1.02's phase rules (`phaseAllows`, `phaseChangesFrom`, `canChangePhase`) and the database's own guards (the assignment trigger, completion only when assigned, cascading accusations).
- Unit 2.02's plan, "Not in this unit": change the phase and assign the lobby in one D1 batch, each update guarded on the player having no numbers yet, so a double tap can't mix two runs.

## Work

1. `src/auth/pin.ts`: `hashPin(pin)` (a fresh random salt of 32 hex characters from `crypto.randomUUID()`, and Hono's `sha256` of `salt:pin`, named `pinHash`/`pinSalt` like the columns), `verifyPin(pin, { pinHash, pinSalt })` (Hono's constant-time `timingSafeEqual`), and `pinSchema` (Zod, exactly four digits). Shared with unit 3.01, which joins players with it; the exports are the ones that thread proposed, so whichever unit merges second keeps the same API.
2. `src/db/host.ts`, the host page's reads and writes:
   - `listPlayers` (id, name, and whether they have been assigned, in joining order), `getPlayer` (the same plus completion), and `listPlayersWithSecrets` (challenge, decoy and completion too, for "show all" only).
   - `changePhase(db, from, to)`: refuses anything `canChangePhase` doesn't allow; moves the phase only if the game is still in `from` (`UPDATE ... WHERE phase = from`), so a double tap or a stale second tab changes nothing. Starting Game on reads every player, runs `assignPlayers`, and writes every assignment and then the phase change in one `db.batch` (a single transaction). Each assignment is guarded on the player still having no numbers and on the game still being in `from` at that moment, so a run that loses a race writes nothing at all. Returns whether the phase moved.
   - `setCompletion` (only for an assigned player, and only while the phase allows it at the moment of the write), `resetPin` (stores a new hash and salt), `removePlayer` (the database removes the accusations by and about them). Each returns false, changing nothing, if it can't apply.
3. `src/routes/host.tsx`, registered with one line in `src/index.ts`. Everything under `/host` is behind `basicAuth` with `verifyUser`: any user name, the password compared in constant time with `HOST_PASSWORD`, and an unset or empty `HOST_PASSWORD` keeps the page locked. Every host response has `Cache-Control: no-store`.
   - `GET /host`: the current phase with a button for the next phase (none at the Reveal), the player list, the QR code button and the emergency button. A short notice after each action (`?done=...`, from a fixed list).
   - The player list is its own fragment, `GET /host/players`, polled every 10 s with htmx. It shows names (each linking to the player's page) and flags a player with no challenge yet once the game is on. It shows no completions: those are only on each player's own page, so Danny doesn't see everyone's at a glance.
   - Phase change: `GET /host/phase?to=<phase>` is a confirm page saying what the change does and that it can't be undone; its form posts `from` and `to` to `POST /host/phase`. A phase that isn't the next one, or a confirm page that has gone stale, changes nothing and says so (one message for both, since the server can't tell them apart).
   - `GET /host/players/:id`: the player's completion status with a "Mark as done" / "Unmark as done" button (only in Game on and Accusations closed, and only once assigned; a player left without a challenge during the game is explained as such), a form to set a new 4-digit PIN, and a "Remove" button. `POST /host/players/:id/completion`, `POST /host/players/:id/pin`, and `GET`/`POST /host/players/:id/remove` (a confirm page, then the removal).
   - `GET /host/qr`: the join link (this site's `/`) as an SVG QR code from `uqr`, with the link written underneath.
   - `GET /host/all`: a warning page; its button posts to `POST /host/all`, which shows every player's challenge name, decoy name and completion in a table. This is the only place the host page shows them.
   - Forms are checked with Zod (`zValidator`): the player id, phase names (`phaseSchema`), `completed` as `true`/`false`, and the PIN as exactly four digits. A bad form changes nothing and goes back to the page it came from; an unknown player sends the host back to the list.
4. `README.md`: where the host page is and how to log in.

## Tests

`test/host.test.ts` (through the Worker, against the migrated test D1) and `test/pin.test.ts`:

- Login: no password, a wrong password and an unset `HOST_PASSWORD` get 401; any user name with the right password gets in; every host path and action is protected; host pages are `no-store`; a cross-site post is refused by the CSRF check.
- Who has joined: names (escaped), the count, the 10-second poll, the fragment without the layout, the empty list, the "no challenge yet" flag, and only the page's own notices shown (not `?done=constructor` or made-up text).
- No spoilers: in every phase, the main page, the list fragment, the QR page and the "show all" warning contain no challenge or decoy names, descriptions or completions; a player's page shows their completion but not their challenge or decoy.
- Phase changes: the confirm page changes nothing; only the next phase is offered (nothing at the Reveal); forward through every phase; no skipping or going back; a stale confirm page or double post changes nothing; a made-up phase is ignored.
- Starting Game on (`CLAUDE.md` rule 3): 20 lobby players get all-different challenges and decoys in range; 22 players reuse numbers evenly; numbers already held are kept and not given to anyone else; a refused change assigns nobody; a stale Game on run once the game is in Game on, Accusations closed or Reveal assigns nobody (the late run of a race); an empty lobby starts; two simultaneous Game on runs give one phase change and one set of unique numbers; other phase changes assign nobody.
- Completions: marked and unmarked in Game on and Accusations closed (the button shows while accusations are closed), refused in the Lobby and at the Reveal (by the guarded write itself), refused for an unassigned player (with the right explanation during the game), a removed player, and a bad value.
- Removing: the confirm page changes nothing; removal deletes the accusations by and about the player and keeps the rest; works in every phase; an already-removed player and a bad id.
- PIN reset: the new PIN verifies and is a fresh salted hash; anything other than four digits is refused; the rest of the player is unchanged.
- QR code: an SVG and the join link.
- Show all: the warning shows nothing secret; once confirmed, every player's challenge, decoy and completion, and "Not yet" for an unassigned player.
- PIN hashing: hex hash and salt, a fresh salt each time, the right PIN accepted and any other refused.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI's `check` job.
- On `npm run dev`, the host page works in a phone-sized browser: log in, see players join, move through every phase with a confirm step, fix a completion, reset a PIN, remove a player, show the QR code and use "show all".

## Not in this unit

- The join page, signed cookies, rejoining, and assigning late joiners, including anyone left without numbers because they joined between the host's read and the Game on batch (3.01).
- The player screen, accusations and the reveal (3.02, 3.03, 3.05).
- Logging a player out of other phones when their PIN is reset or they are removed. Unit 3.01's cookie holds the player's id and join time, so a removed player's phone is logged out; a PIN reset doesn't log out phones already in, and only matters on the next rejoin.
- Clearing the game for the switch to real content (4.01).
