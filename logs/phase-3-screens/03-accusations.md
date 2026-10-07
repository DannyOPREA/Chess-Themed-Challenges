# Log: phase 3, unit 03: Accusations

Plan: [docs/phase-3-screens/03-accusations.md](../../docs/phase-3-screens/03-accusations.md)

## 2026-10-07: Plan written and built

**Done**
- Wrote the plan.
- `src/db/accusations.ts` (`listTargets`, `setGuess`), `src/routes/accusations.tsx` (`/accuse`, its form post and its 10-second poll), one route line in `src/index.ts`, and `test/accusations.test.ts`.
- Told the 3.02 Player screen thread that accusations live at `/accuse` so the player screen links there, and the 3.05 Reveal thread that the table holds exactly the final guesses.

**Worked**
- The handovers held: unit 1.02's primary key already gives one guess per pair of players (2.01's suggestion), and its check refuses self-accusations, so no schema change was needed.
- Guarding each write on the phase inside the same statement, as units 3.01 and 3.04 do, makes "frozen once accusations close" hold even for a page loaded before the host closed them.

**Didn't work**
- The first poll fingerprint included the player's own guesses, which would have reloaded the page a few seconds after every save. Left them out.

**Decisions**
- Accusations get their own screen at `/accuse` rather than a section of `/play`. Why: unit 3.02 is rewriting `/play` at the same time, and a separate file keeps the two PRs apart; the player screen only needs a link.
- One row per other player, each with a list of the 20 challenge names, rather than choosing a player first and then a challenge on a second step. Why: it is still "pick a player, then a challenge", needs no extra page, and shows all of a player's guesses at once, which is what they need to keep track of about 19 people.
- With htmx a guess saves as soon as a challenge is picked; the Save button stays for phones without JavaScript. Why: nothing can be left unsaved when the 10-second poll reloads the page, and a guess is easy to change back.
- The poll reloads the whole page (`HX-Refresh`) only when the phase or the list of players changes, and otherwise answers 204. Why: swapping the list every 10 seconds would close a challenge list a player has open; reloading only on a real change keeps the screen current with nothing lost.
- Challenge names are listed in content order, and a player may pick their own challenge's name for someone else. Why: content order matches the hint list on the player screen; with more than 20 players challenges are reused, so the guess can be right, and with 20 or fewer it is simply a wrong guess, as the scope scores it.
- A save the server refuses (accusations closed, a player removed) sends the phone back to the whole screen with a notice instead of updating one row. Why: the whole screen has changed (read-only, or a player gone), so showing it whole is clearer.

## 2026-10-07: Code review and unit review

**Done**
- Ran `/code-review` at `high` on the branch against `main`. Nine findings, all acted on:
  1. The "You have a guess for X of N players" count went stale after an htmx save. Fixed: the save's answer updates it out of band (`hx-swap-oob`).
  2. The Game on intro said "nobody sees who you've accused", but the reveal shows who detected whom and everyone's right and wrong guesses (`docs/scope.md`, "Reveal"). Fixed: "Nobody finds out whether a guess is right, or who guessed what, until the reveal."
  3. The poll's `HX-Refresh` reloaded the URL with its `?done=` notice, so an old "Accusations are closed…" or "That player has left the game." came back on later reloads. Fixed: the poll answers `HX-Redirect: /accuse`.
  4. A second pick made while the first was being saved was queued on the form, which the first answer then replaced, so htmx dropped it and the first pick stayed. Fixed: the answer fills only the row's status line, so the form stays and the queued pick is sent after the first.
  5. `currentPhase` was copied a third time, and the guard wrote `'game_on'` into the SQL instead of following `phaseAllows`. Fixed: `currentPhase` moved to `src/db/game.ts` (players and host import it), and the guard uses the phases where `phaseAllows(p, 'accuse')`.
  6. `setGuess` said "saved" when a guess wasn't written although both players existed in Game on, and its two follow-up reads ran one after the other. Fixed: that case throws (only clearing a guess that wasn't there counts as saved), and the reads run in one `db.batch`.
  7. A save re-read every other player only to render one row. Now it is needed for the count (finding 1), so it stays; it is one indexed read of about 20 rows.
  8. The Lobby screen reloaded each time someone joined, though it lists nobody. Fixed: in the Lobby the fingerprint is the phase only, and the players aren't read.
  9. The name order copied unit 2.01's `byName`. Fixed: exported from `src/game/scoring.ts` and reused.
- Ran the `unit-reviewer` agent (it started on the first commit; the code review fixes landed while it ran, and it re-checked everything on them). Verdict "Fix needed", nothing blocking: no spoilers in 78 saved responses, scope matched, and it confirmed findings 1, 3 and 4 above fixed in a phone-sized browser with 20 players. Its findings:
  - Should fix 1: a save that fails on the network or with a server error showed nothing, and the row could say "Saved: Challenge 7" under a pick of Challenge 8. Fixed: the form's `hx-on::before-request`, `hx-on::send-error` and `hx-on::response-error` set the status line to "Saving…" and "Not saved. Check your signal and pick again." Checked in Playwright with a slowed and an aborted post.
  - Should fix 2: no log entry for the review fixes, and the plan status. Fixed: this entry; the status goes to Done at merge.
  - Note: a poll reload landing while a save was in flight cut the save off. Fixed: the poll skips a tick while any htmx request is in flight.
  - Note: without JavaScript, Save reloaded the page at the top of a 19-row list. Fixed: it goes back to the same row (`#player-<id>`), whose status line says what was saved, instead of a notice at the top.
  - Note: no test for the poll after a player is removed. Added. The queued second pick has no automated test (the Workers test pool has no browser); the reviewer checked it in Playwright.
  - Note: on a 360 px phone a 20-character challenge name may be cut off in the closed list, though the phone's own picker shows it in full. Left as it is: the row is already a list and a button, and the full name is one tap away.
  - Note: `z.coerce.number()` accepts `0x2` or ` 2 `. Left: still a whole number from 1 to 20.

**Worked**
- The unit reviewer's 20-player run in a phone-sized browser found the failed-save case, which no Workers test could have shown.

**Didn't work**
- Nothing.

**Decisions**
- Keep the htmx answer to a save as text plus an out-of-band count, not a whole row. Why: replacing the form is what dropped a quick second pick (code review finding 4).
- A failed save is reported on its row, not retried. Why: the player can see it and pick again; retrying silently could save an older pick after a newer one.

## 2026-10-07: Merged main (3.02 Player screen, 3.05 Reveal)

**Done**
- Merged `main` with units 3.05 (PR #15) and 3.02 (PR #14). Kept both route lines in `src/index.ts`.
- Unit 3.02 had meanwhile moved `currentPhase` into `src/db/game.ts` too, with `currentPhaseAllows(action)`. Took its versions of `src/db/game.ts`, `src/db/host.ts` and `src/db/players.ts`, and `setGuess` now guards with `currentPhaseAllows('accuse')`.
- Checked the player screen's accusations buttons link to `/accuse`, and added a test that follows the link.

**Worked**
- Agreeing the route with the 3.02 thread at the start meant no change to its button was needed.

**Didn't work**
- Nothing.

**Decisions**
- Use 3.02's `currentPhaseAllows` rather than this unit's own copy. Why: one shared guard for every phase-dependent write.

## 2026-10-07: Second unit review

**Done**
- Ran the `unit-reviewer` agent again, on the head with 3.02 and 3.05 merged in. Verdict "Fix needed", nothing blocking. It confirmed both earlier Should fix items in 390 px and 360 px browsers ("Saving…" and "Not saved" on slowed, aborted and 500 saves; the no-JS save landing on its own row), the poll skipping ticks during a held save, the click-through from `/play`, and no spoilers in 56 saved responses. Its findings:
  - Should fix: after a failed save, leaving the screen and coming back with the Back button showed the unsaved pick in the list with no warning, because the browser restored the form's value. Fixed: `autocomplete="off"` on the list (the reviewer confirmed it restores the saved value), with a test.
  - Note: a save that hangs showed "Saving…" for as long as it hung and paused the poll, as htmx has no request timeout by default. Fixed: the row's form sets a 15-second timeout (`hx-request`) and `hx-on::timeout` shows "Not saved". Checked in Playwright with a save held for 20 seconds.
  - Note: a poll already in flight when a save starts can still reload the page while the save is being sent. Left: it needs the phase or the players to change at that moment, the save has almost always reached the server by then, and the reloaded page shows the stored guess, so nothing wrong is shown.
  - Note: the count can briefly disagree with the rows when a player joins during a save, until the next poll reloads the page. Left: cosmetic and gone within 10 seconds.
  - Note: the Lobby player screen has no link to `/accuse`. Left: there is nothing to do there until Game on, and the player screen's wording (unit 3.02) says accusations open when the game starts.
- Status set to Done.

**Worked**
- Playing the screen in a real browser again found the Back-button case, which tests in the Workers runtime can't reach.

**Didn't work**
- Nothing.

**Decisions**
- A 15-second timeout for a save. Why: long enough for a slow pub connection to get through, short enough that a player who looks at the row sees "Not saved" before they move on.

## 2026-10-07: Third unit review

**Done**
- Ran the `unit-reviewer` agent a third time. Verdict "Pass", nothing blocking or to fix. It confirmed the Back button now shows the saved guess after a failed save, a hung save gives "Not saved" after 15 seconds and the poll resumes, a second pick queued behind a hung one is still saved, and no spoilers in 65 saved responses. Its notes:
  - "Not saved" can show when the save did reach the server but its answer was late; nothing wrong is stored. But "pick again" doesn't work when the player wants the same pick, as choosing the same option sends nothing. Fixed: the text is now "Not saved. Check your signal and tap Save.", and Save resends the current pick.
  - After a timeout, a queued second pick can be sent while the first is still on its way, so in theory they could arrive out of order. Left: both go over one connection, the reviewer saw no reordering, and the row shows what the last answer saved.
  - The Back button with the browser's back-forward cache couldn't be tested headless. Left: a cached page comes back whole, with its "Not saved" line still showing.
  - htmx logs its timeout and error events as console errors. Left: those are htmx's own messages for the failures the row reports.

**Worked**
- Nothing new beyond the above.

**Didn't work**
- Nothing.

**Decisions**
- No further review run for the wording change. Why: it changes only the text of one message, which no test or other code depends on.
