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

## 2026-10-07: Reviews, and main merged in

**Done**
- Ran `/code-review` at `high` on the branch and the `unit-reviewer` agent, fixed the findings below, and merged `main` (unit 3.04 Host page) in. Typecheck and 218 tests pass after the merge.
- This entry corrects two lines of the previous one: the cookie is now `Secure` only over HTTPS (not always), and the test count is 218.

**Worked**
- Removing the phase condition from the late joiner's write now fails the new race test, and removing the clash check still fails three tests.
- `unit-reviewer` played the merged build in a phone-sized browser with the host page moving the phases: joining, duplicate names, wrong PINs, rejoin from a fresh browser, six late joiners at once, 20 lobby phones polling as Game on started, a join at the same moment as Game on, closed phases, log out, removed players and forged cookies. All challenges and decoys were different, nobody was left without numbers, and no page showed another player's details.

**Didn't work**
- My first PIN helper hand-wrote hex encoding and the constant-time compare; 3.04 had meanwhile written the same file with Hono's `sha256` and `timingSafeEqual`. Took 3.04's file as it is.

**Decisions**
- `/code-review`: `src/auth/pin.ts` clashed with 3.04's and re-implemented Hono helpers (rule 1). Fixed: took 3.04's file byte for byte, and its `test/pin.test.ts`; dropped my own PIN tests. Why: one file, and the merge stays clean.
- `/code-review`: a new name could join after accusations closed, if the host closed them between the join's phase read and its insert. Fixed: `createPlayer` is one `INSERT ... SELECT` that checks the phase at that moment; if nothing is inserted and the name isn't taken, the join is refused as closed.
- `/code-review`: a late joiner's numbers could be written after accusations closed. Fixed: the `UPDATE` also requires Game on at that moment, and each read takes the phase with the players in one batch, so the loop stops when the phase moves on. `unit-reviewer` noted the condition had no test; added one where the host's phase change lands between the read and the write.
- `/code-review`: always-`Secure` cookies are dropped by Safari on `npm run dev`'s plain http. Fixed: `Secure` whenever the request is HTTPS, which production always is.
- `/code-review`: missing form fields showed Zod's own English error. Fixed: a missing field counts as empty.
- `/code-review`: names made only of invisible characters looked blank. Fixed: `cleanName` drops control and format characters. `unit-reviewer` then noted this split emoji such as "👩‍💻"; fixed: the zero-width joiner stays between two emoji.
- `/code-review`: the assignment loop read every column, PIN hashes included. Fixed: it reads only ids and numbers.
- `/code-review`: the join page was rendered three ways. Fixed: one `renderJoin`.
- `/code-review`: `isLeastHeld`'s comment described the old pattern. Fixed the comment and added a note to 2.02's plan, logged in 2.02's log.
- `/code-review`: `/play` reads the phase twice for an unassigned player. Not changed. Why: one cheap read per poll in the lobby, and 3.02 replaces `/play`.
- `unit-reviewer` (Should fix): the log didn't record the review fixes. This entry.
- `unit-reviewer` (note): after accusations close, the intro and the error both said the game was closed. Fixed: the error now says nobody has joined with that name and to check the spelling.
- `unit-reviewer` (notes, not changed): the PIN message has no full stop (it is shared with 3.04's file, so left as main has it); `aria-invalid` marks both fields on any error (both fields are re-entered anyway); an `http://` request would get a cookie without `Secure` (workers.dev redirects to HTTPS).
- `unit-reviewer` (checked, fine): 3.04's Game-on batch only writes while the game is in the Lobby and the late joiner only writes in Game on, so the two can't overlap; a player missed by the host's batch is assigned on their next screen, which the coordinator asked to confirm.

## 2026-10-07: Second unit review

**Done**
- Ran the `unit-reviewer` again on the fixes. Verdict "Pass", nothing Blocking or Should fix. It confirmed the new phase test fails with the condition removed, the reworded closed-game page, and emoji names in the browser.
- Acted on its two notes (below). Typecheck and 218 tests pass.

**Worked**
- Nothing new to note.

**Didn't work**
- The first emoji fix still split emoji with a skin tone, such as "🏃🏽‍♂️", because the skin-tone modifier isn't itself an emoji.

**Decisions**
- Note: the zero-width joiner now also stays after a skin-tone modifier, with a test. Why: iPhones produce these often. Tag-sequence flags (such as England's) still lose their tag characters and show as a plain flag. Why not fixed: cosmetic, rejoining still works, and allowing tag characters would let invisible characters back into names.
- Note: a wrong PIN once accusations close now says "That PIN doesn't match that name. Check your PIN, or ask the host to reset it." Why: the usual advice to choose a different name doesn't help when new names can't join.
- Merge with a merge commit once CI's `check` job is green. Why: the working agreement.
