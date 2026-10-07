# Log: phase 3, unit 04: Host page

Plan: [docs/phase-3-screens/04-host-page.md](../../docs/phase-3-screens/04-host-page.md)

## 2026-10-07: Plan written

**Done**
- Wrote the plan from `docs/phases.md` (unit 3.04), `docs/scope.md`, the 1.02 and 2.02 plans and logs, and the 1.01 conventions.

**Worked**
- Nothing to note.

**Didn't work**
- Nothing.

**Decisions**
- Recorded below with the build, since the plan was written and built in one session.

## 2026-10-07: Build

**Done**
- `src/auth/pin.ts`, `src/db/host.ts`, `src/routes/host.tsx` (registered in `src/index.ts`), `test/host.test.ts`, `test/pin.test.ts`, and a "Host page" section in `README.md`.
- Played the pages on `npm run dev` in a 390 × 844 browser with three players: the host page, the Game on confirm and change, a player's page, marking done, the QR code and "show all". No console errors; everything fits the phone width.

**Worked**
- Typecheck and 163 tests pass.
- Drizzle's `db.batch` runs the phase change and every lobby assignment as one D1 transaction, and `.returning()` on the guarded phase update tells whether it moved. Two `changePhase` calls at once in a test leave one phase change and 20 unique challenges and decoys.

**Didn't work**
- A test checked for "This can't be undone." in the HTML; hono/jsx escapes the apostrophe as `&#39;`. The tests match either form.

**Decisions**
- Reset PIN means the host types a new 4-digit PIN for the player and tells them. Why: the scope only says "reset a player's PIN"; clearing it so the player picks a new one would need a "no PIN yet" state in the schema (`pin_hash` is required) and in unit 3.01's rejoin flow, while a host-chosen PIN needs neither and works the moment the host says it.
- The PIN hashing helper (`src/auth/pin.ts`) is written here and sent word for word to the 3.01 thread, which needs the same thing for joining. Why: the two units run in parallel; identical files on both branches merge without a conflict, and there is one way to hash a PIN.
- Any user name with the right password logs in. Why: the browser's login box always asks for one, and nobody needs to remember a second word on the night; the password is the only secret. It's compared in constant time (`timingSafeEqual` from Hono), and an empty or missing `HOST_PASSWORD` keeps the page locked rather than letting an empty password in.
- Confirm steps are server-rendered pages (`GET` shows the question, the form `POST`s), not a JavaScript `confirm()` or `hx-confirm`. Why: they work on any phone, the confirm page can say what the change does, and the posted `from` phase makes a stale page or a double tap harmless.
- The removal and "show all" buttons get the same kind of confirm page as phase changes. Why: removing a player deletes their accusations for good, and "show all" spoils the game for Danny, who is playing.
- Completions are shown only on each player's own page, not in the player list. Why: the host must be able to fix completions, but Danny is also a player; keeping the list free of them means a glance at the host page during the game gives nothing away.
- "Show all" lists challenge and decoy names, not descriptions. Why: it is for sorting out a problem (for example a player who lost their challenge), and the names are enough to identify them; less on screen in an emergency.
- Starting Game on writes the phase and the lobby's numbers in one batch, each assignment guarded on `challenge IS NULL AND decoy IS NULL` (the 2.02 plan suggested `OR`; the schema makes the two the same, since challenge and decoy are assigned together). Why: unit 2.02's plan; a phone that sees Game on then always sees the lobby's numbers too, and two runs can't mix their picks. Someone who joins between the read and the batch is left without numbers in Game on; the host list flags them and unit 3.01 assigns them (told to that thread).
- The player list is polled as its own fragment, separate from the forms. Why: a 10-second poll that replaced the whole page would wipe a PIN being typed; the forms live on each player's page, which doesn't poll.
- After each action the page says what happened (`?done=<key>` from a fixed list of messages). Why: plain redirects keep the back button and a refresh from repeating the action, and a fixed list means nothing from the URL is ever shown as it is.
- Host pages are `Cache-Control: no-store`. Why: they show completions and, with "show all", everything; nothing should stay in a phone's cache or back button.
- The QR code is the site's own address plus `/`, taken from the request. Why: the live address depends on Danny's `workers.dev` subdomain, which the code can't know; the request has it.

## 2026-10-07: Code review

**Done**
- Ran `/code-review` at `high` on the branch's diff against `main`. Seven findings, all fixed:
  1. The Game on batch wrote the assignments even when its phase move matched nothing, so the losing run of a race (or a stale confirm page posted later in the game) could still assign a player who joined after the winner's read, possibly with a number someone already held. Fixed: the assignments now run before the phase move in the batch, each guarded on the game still being in `from`, so a losing run writes nothing. Tested for a stale run in Game on, Accusations closed and Reveal; the tests fail with the guard removed.
  2. The completion route read the phase and wrote the completion in separate queries, so a page loaded before the Reveal could change a completion after it. Fixed: `setCompletion` guards the write on the phase at that moment (the phases `phaseAllows(..., 'hostMarkCompletion')` lists). The route's separate check is gone; the Lobby and Reveal tests now exercise the guarded write and fail without it.
  3. An unassigned player's page said "Completion can be set once the game is on" during the game. Fixed: during the game it says the player has no challenge yet. Tested.
  4. Asking for a phase that isn't next said "The phase had already changed", which can be untrue. Fixed: one honest message for both cases, as the server can't tell a skipped phase from a stale page.
  5. `?done=constructor` passed the `in` check and showed an empty notice. Fixed with `Object.hasOwn`. Tested.
  6. `basicAuth` was registered for `/host` and `/host/*`, but Hono's `/host/*` also matches `/host`, so it ran twice there. Fixed: one registration; the login tests still cover `/host`.
  7. `src/auth/pin.ts` wrote its own hex conversion, digest and constant-time compare (rule 1). Fixed: it uses Hono's `sha256` and `timingSafeEqual`, and `crypto.randomUUID()` for the salt. The new content went to the 3.01 thread.

**Worked**
- Typecheck and 169 tests pass.

**Didn't work**
- Drizzle's `db.batch` needs a first element its types can see, so `[...assignments, move]` didn't typecheck. The first assignment is taken out (`[first, ...rest, move]`), and an empty lobby moves the phase on its own.

**Decisions**
- Guard writes on the phase inside the SQL (a subquery on the game row) rather than reading it first. Why: D1 runs each statement atomically, so the guard holds at the moment of the write; a read-then-write leaves a gap a second tab or a double tap can fall into.

## 2026-10-07: PIN helper matched to unit 3.01

**Done**
- The 3.01 thread proposed the API for `src/auth/pin.ts` at about the same time as this unit sent its own: `hashPin(pin)`, `verifyPin(pin, { pinHash, pinSalt })` and `pinSchema` (Zod, four digits). Switched this unit's file to exactly those exports, and the host's PIN form now uses `pinSchema`. Told that thread.

**Worked**
- Typecheck and 170 tests pass.

**Didn't work**
- Nothing.

**Decisions**
- Take 3.01's API. Why: joining is the main user of PIN hashing, and with the same exports on both branches, whichever unit merges second only has to keep one body; nothing else changes.

## 2026-10-07: Unit review

**Done**
- Ran the `unit-reviewer` agent. It started on the first commit and re-checked everything on the latest one. Verdict "Fix needed": nothing Blocking on the latest commit, one Should fix, and notes.
  - It reproduced the first commit's Game on race in a scratch test (a player who joined between two runs' reads got a challenge someone else held) and confirmed the code-review fix stops it: the losing run now writes nothing.
  - Should fix: the player names in the list were small text links (about 30 × 20 px), and they are the only way to a player's completion, PIN and Remove, so a mis-tap in a pub could pick the wrong player. Fixed: each name is a full-width outline button, 50 px tall at 390 px wide.
  - Note: the notices after an action were easy to miss. Fixed: shown in a Pico `<article>` box, in bold.
  - Note: odd indentation in the `basicAuth` options. Fixed.
  - Note: players left without numbers by the join race stay so until unit 3.01 assigns them. Nothing to change here; the 3.01 thread confirmed it assigns any player it finds unassigned during Game on.
  - Note: Game on runs one D1 query per lobby player in one invocation; fine for about 20 players, near the free plan's limit only at about 48. No change.
  - Note: the phase heading isn't polled, so a second host tab shows the old phase until reloaded; the confirm page re-checks, so it's harmless. No change.
  - Note: removing a player at the Reveal changes the leaderboard, as 1.02's rules allow. No change.
- The reviewer checked spoilers by saving every host response and searching for challenge, decoy, description and hint text: only the confirmed "show all" page had any.

**Worked**
- Typecheck and 170 tests pass.

**Didn't work**
- A PIN test asserted the hash doesn't contain the PIN's digits, which a hex hash does about once in a thousand runs; it failed once. Removed that assertion, as it tested nothing real (the hash is checked for its format and against a wrong PIN instead).

**Decisions**
- None beyond the fixes above.

## 2026-10-07: Second unit review and merge

**Done**
- Ran the `unit-reviewer` again on the fixes. Verdict "Pass", nothing Blocking or Should fix. It confirmed the player buttons (358 × 50 px at 390 px wide, long names wrap without overflow), the boxed notices, the 10-second poll, the guarded completion write after a stale Reveal tap, and no spoilers in any host response outside the confirmed "show all" page.
- `main` hadn't moved since the branch was cut (unit 3.01 not merged yet), so there was nothing to merge in. Set the plan's status to Done and merged the PR with a merge commit.

**Worked**
- Typecheck and 170 tests pass; CI's `check` job green.

**Didn't work**
- Nothing.

**Decisions**
- None. Carried over for 3.01: anyone left without numbers by the join race is assigned by 3.01, and whichever of 3.01 and this unit merges second keeps `main`'s `src/auth/pin.ts` body (the exports match).
