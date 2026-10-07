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
