# Log: phase 3, unit 06: Host reset button

Plan: [docs/phase-3-screens/06-host-reset.md](../../docs/phase-3-screens/06-host-reset.md)

## 2026-10-07: Plan written and built

**Done**
- Danny asked for a reset button on the host page at about 22:28 UK, after playing through the live app alone, so the app is clean for Thursday's test run. Wrote this plan, added the unit to `docs/phases.md` and the reset to the host page list in `docs/scope.md`.
- Built `resetGame` in `src/db/host.ts`, the "Reset" section, confirm page and action in `src/routes/host.tsx`, and seven tests in `test/host.test.ts`. Mentioned the reset in `README.md`.

**Worked**
- The existing cookie check (unit 3.01) already logs every phone out after a reset: the cookie holds the player's id and join time, and ids keep counting up, so no new player matches an old cookie.

**Didn't work**
- Nothing.

**Decisions**
- The reset deletes players and accusations and moves the game back to the Lobby in one D1 batch, without restarting player ids. Why: this is what Danny was told the button would do; one transaction means a phone never sees half a reset; restarting ids could let an old phone's cookie match a new player with the same id if the join times also matched.
- Accusations are deleted explicitly, before the players. Why: the cascade on `players` would do it, but an explicit delete doesn't depend on D1 enforcing foreign keys.
- The reset works in every phase and has one confirm page, like removing a player, with no extra typed confirmation. Why: the host may want to reset from any phase (after the Reveal of a test game, or mid-game to start over), and the other actions that can't be undone use one confirm step, which keeps the host page consistent.
- The button sits in its own "Reset" section at the bottom of the host page, below "Emergency". Why: the bottom is the hardest place to tap by accident, and keeping it apart from "show all" avoids mixing it up with the emergency button.
- Updated `docs/scope.md` (host page actions) with this unit. Why: Danny's own request for the button is the OK `CLAUDE.md` asks for before changing the spec.

## 2026-10-07: Code review

**Done**
- Ran `/code-review` at `high` on the branch against `main`. Seven findings, handled as follows:
  1. A stale confirm page (an old tab, the Back button) could wipe a later game, such as Saturday's. Fixed: the confirm page carries a marker (phase, highest player id, number of players) and the reset changes nothing, with a "wasn't reset" notice, if the game has moved on since. Tests for a join, a removal, a phase change and a reset in between, a second tap after a join, and tampered forms.
  2. `docs/phases.md` still said the whole-app check waits for every phase 3 unit. Fixed: wave E names the units it covered, and 3.06's entry says the check isn't re-run for it.
  3. `test/reset-db.ts` copied the reset's statements. Fixed: it calls `resetGame`, so the tests and the host clear the same tables.
  4. The new test's join helper repeats the ones in `test/join.test.ts` and `test/play.test.ts`. Left as it is: each test file in this repo keeps its own small request helpers, and moving them is a refactor beyond this unit.
  5. `src/auth/session.ts` only named unit 4.01 as clearing game data. Fixed: its comments name the reset and why it depends on ids never being reused.
  6. The reset notice described the whole game ("every player ... deleted"), which turns false if the page is reloaded after people join. Fixed: it now reads "The game was reset.", an event like "Player removed.".
  7. `/host/reset` wasn't in the test's list of protected host paths. Fixed.

**Worked**
- Typecheck and 295 tests pass.

**Didn't work**
- The first version of the stale-page test removed a player from an earlier loop round, so the removal case passed for the wrong reason and then failed. Fixed the test, and added the player count to the marker, because removing anyone but the newest player leaves the highest id unchanged.

**Decisions**
- The stale check is a read just before the batch, not a guard inside it. Why: it is there for pages left open, where minutes or days pass; a guard inside the batch can't be written for all three statements, as the reset itself changes the phase and the players the guard would read. A join in the same few milliseconds as a reset is lost, as it would be a moment later anyway.

## 2026-10-07: Unit review and merge

**Done**
- Ran the `unit-reviewer` on both commits. Verdict "Pass", nothing Blocking or Should fix. In a 390 × 844 browser it played: three players joined, Game on, accusations and a completion; Cancel on the confirm page changed nothing; a confirm page opened before a late join refused the reset with the "wasn't reset" notice; the real reset showed the Lobby with nobody joined; open `/play` and `/accuse` screens went to the join page within one poll; the same names joined again as new players with new PINs. No spoilers in any saved response, no console errors, no failed requests.
- Acted on the reviewer's notes:
  1. A phone on the results screen doesn't go back to the join page by itself, because `/reveal` doesn't poll (unit 3.05). Fixed the wording: the confirm page and plan say phones go back when their screen next updates, and a phone on the results screen when it is next tapped or reloaded. The screen itself is unchanged, as its content was already allowed at the Reveal.
  2. A double tap showed "wasn't reset" after the first tap had worked. Fixed: a game that is already an empty Lobby counts as reset. New test.
  3. Chromium reloads the confirm page on Back (it is `no-store`), so "the Back button" was the wrong example of a stale page. Reworded to "a page the browser shows again without reloading it".
  4. Plan status set to Done and this entry added.
  5. The reviewer stopped every `wrangler dev` in the container while switching commits; this thread had none running, so nothing was affected.
- Typecheck and 296 tests pass.

**Worked**
- The stale-page check worked in a real browser exactly as the tests say.

**Didn't work**
- Nothing.

**Decisions**
- A stale page after a reset now reports "The game was reset." rather than "wasn't reset" when the game is still an empty Lobby. Why: there is nothing to lose in an empty Lobby, and the result the host sees (an empty Lobby) is what they asked for.
- No polling added to the results screen. Why: it belongs to unit 3.05, which was reviewed and passed the whole-app check; a tap or reload is enough after a test game, and every other screen goes back by itself.
