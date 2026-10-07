# Log: phase 3, unit 01: Join and rejoin

Plan: [docs/phase-3-screens/01-join-and-rejoin.md](../../docs/phase-3-screens/01-join-and-rejoin.md)

## 2026-10-07: Plan written

**Done**
- Wrote the unit plan from `docs/phases.md`, unit 3.01, and the handovers in the 1.02 and 2.02 plans and logs.

**Worked**
- Nothing to note yet.

**Didn't work**
- Nothing.

**Decisions**
- Plan and build in the same PR. Why: `docs/README.md` and the working agreement.

## 2026-10-07: Join and rejoin built

**Done**
- Everything under the plan's "Work": PIN hashing, `cleanName`, the player queries and late-joiner assignment, the signed cookie with `getCurrentPlayer` and `requirePlayer`, the join page at `/`, log out, the `/play` placeholder, and `test/join.test.ts` and `test/players.test.ts`. Typecheck and 152 tests pass.
- Told the 3.04 Host page thread, running in parallel, where `hashPin` lives and what it does, so the PIN reset doesn't write its own.

**Worked**
- Removing the clash check from `assignLateJoiner` makes three tests fail (the two racing tests and 20 phones joining at once through the Worker), so the tests really exercise the race: in the test runtime, concurrent requests interleave their D1 reads and writes.

**Didn't work**
- 2.02's suggested pattern (write the late joiner's numbers, re-check with `isLeastHeld`, re-pick on a clash) can't work: 1.02's trigger refuses changing a challenge once written. Replaced with a check inside the write (below).
- The first test run got 200 instead of 303 from every join, because the test `fetch` followed redirects. Fixed with `redirect: 'manual'`.
- `@hono/zod-validator`'s hook doesn't get this app's binding types; the hook casts `c.env` to `Env`.

**Decisions**
- Late joiners are assigned with one guarded `UPDATE`: it applies only if the player is still unassigned and nobody else has taken the picked challenge or decoy since the read (the count of other holders is unchanged); otherwise read and pick again. Why: D1 runs a statement as a whole, so the check can't be split from the write; a clash is caught before anything is written, so the trigger is never hit and the joiner never sees numbers that change; the first writer always wins, so two joiners can't collide in lockstep and no random wait is needed. Comparing counts rather than "unused" keeps reuse even beyond 20 players.
- After 20 failed tries the pick is written without the check, with a warning. Why: each failed try means another player was assigned, so this can't happen with about 20 players; 2.02's plan prefers a rare shared challenge to a player who can't join.
- Players found unassigned during Game on are assigned by `getCurrentPlayer`, on any player screen. Why: 2.02's plan asks 3.01 to cover someone who joins between 3.04's read and its batch; doing it in the one helper every screen calls means their next page or poll fixes it. Only in Game on: scope assigns on joining or at Game on, and a player can't act once accusations close.
- One form for joining and rejoining: a new name joins, a taken name needs its PIN. Why: the scope says the same name and PIN gets them back in; one form means nobody has to choose. The error for a taken name covers both cases ("If it's you, check your PIN; if not, choose a different name") and says nothing about whether the PIN was close.
- The join page posts to `/` itself. Why: a refresh after an error then shows the join page rather than a 404.
- The cookie holds the player id and join time, signed, for 7 days. Why: the id alone would let a phone with an old cookie become whoever later gets that id if game data is cleared (4.01) in a way that resets ids; the join time makes such a cookie fail. 7 days covers the Thursday test and Saturday; the join time stops Thursday's cookies working once 4.01 clears the game.
- `Secure` and `HttpOnly` cookie. Why: production is HTTPS on workers.dev, browsers accept `Secure` cookies on `localhost` for `npm run dev`, and no script needs the cookie.
- The PIN field is a password field with the numeric keypad. Why: someone reading a PIN over a shoulder in the pub could log in as that player and see their challenge. The host can reset a mistyped PIN (3.04).
- Names: 30 characters at most, stored as typed but trimmed and with repeated spaces collapsed (`cleanName`). Why: `docs/phases.md` asks for the shown name trimmed; 30 fits a phone screen and the host's list.
- A "Not you? Log out" button. Why: not in the scope's list, but without it a phone someone else logged in on (helping a friend in the pub) stays that player for 7 days. It changes no game data and costs one route.
- `/play` is a placeholder showing only the player's own details. Why: 3.02 builds the player screen; players need somewhere to land, and showing their own challenge and decoy names lets the rejoin be checked in a browser now.
- Wrong PINs give 400 with the form, with no lockout or delay. Why: `CLAUDE.md` says no lockout.
