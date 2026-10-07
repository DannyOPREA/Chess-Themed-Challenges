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
