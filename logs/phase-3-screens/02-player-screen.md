# Log: phase 3, unit 02: Player screen

Plan: [docs/phase-3-screens/02-player-screen.md](../../docs/phase-3-screens/02-player-screen.md)

## 2026-10-07: Plan written and screen built

**Done**
- Wrote the plan. Built `setOwnCompletion` (`src/db/play.ts`), the player screen at `/play` with its 10-second poll at `/play/status` and the "I've done it" button at `/play/done`, replacing 3.01's placeholder, and `test/play.test.ts` (24 tests). Updated 3.01's `/play` assertions in `test/join.test.ts` to the new wording; what they check is unchanged.
- Typecheck and 242 tests pass.

**Worked**
- 3.01's `requirePlayer` already assigns an unassigned player during Game on and sends `HX-Redirect` to logged-out polls, so the screen needed no auth code of its own.

**Didn't work**
- Typing the `zValidator` hook's context as the player screen's context doesn't compile (the hook is typed for the plain environment). A tampered form now just redirects to `/play`; the screen's own buttons always send a valid value.

**Decisions**
- The player sees their own challenge's and decoy's descriptions, not just the names. Why: the names alone don't say what to do. The scope's "full challenge descriptions are only shown at the reveal" is about the hint list, which shows every challenge; there, only names and hints are shown.
- Accusations and the reveal stay on their own screens (`/accuse`, `/reveal`, built by 3.03 and 3.05 in parallel), linked from the status section. Why: one file per screen (1.01's conventions), so the three parallel units don't edit the same lines. Told both threads the paths.
- The poll sends the state it last saw and gets 204 when nothing changed. Why: htmx doesn't swap a 204, so the screen isn't redrawn every 10 seconds under the player's thumb (a tap landing during a swap), and 20 phones polling send almost nothing.
- "I've done it" posts the state wanted (`completed=true` or `false`), not a toggle. Why: a double tap or a resent form can't flip it back.
- The write checks the phase as it runs. Why: a phone that loaded the screen before the host closed accusations mustn't change a completion after.
- The button is a plain form with `hx-post`. Why: it works before htmx has loaded, and with htmx it swaps the status section without reloading.
- No confirm step on "I've done it". Why: it can be undone with one tap during Game on, and the host can fix it after.
- `Cache-Control: no-store` on every player route. Why: the page shows the secret challenge; after "Log out" on a borrowed phone, the back button mustn't show it from the cache.
- The hint list is in content order and doesn't mark the player's own challenge. Why: marking it adds nothing for the player and would be one more thing on screen for someone looking over their shoulder.
- The challenge isn't hidden behind a "tap to show". Why: not in the scope, and an extra tap each time; noted for the whole-app check.

## 2026-10-07: Code review

**Done**
- Ran `/code-review` at `high` on the branch and acted on its findings (below). Typecheck and 242 tests pass.

**Worked**
- Nothing new to note.

**Didn't work**
- Nothing.

**Decisions**
- `/code-review`: `no-store` doesn't stop Safari (and sometimes Chrome) showing the page again from the back-forward cache, so Back after logging out on a borrowed phone could show the challenge until the next poll. Fixed: a one-line `pageshow` script reloads the page when it comes from that cache; a logged-out phone then lands on the join page. The app sends no Content-Security-Policy, so the inline script runs; a test checks both.
- `/code-review`: the "That wasn't saved" notice never cleared, because every later poll matched the key and got 204. Fixed: a section with a notice has a key no poll matches, so the next poll replaces it. Tested.
- `/code-review`: a tampered htmx post got a redirect to `/play`, which htmx would follow and swap the whole page into the status section. Fixed: htmx gets a 204 (nothing to swap). Tested.
- `/code-review`: `setOwnCompletion` repeats `setCompletion` from 3.04, and the "phase at the moment of the write" subquery was copied into a third file. Fixed the subquery: `currentPhase` and `currentPhaseAllows(action)` now live in `src/db/game.ts`, used by `host.ts`, `players.ts` and `play.ts` (logged in 3.01's and 3.04's logs). The two completion writes stay separate. Why: they are five lines each, differ in the phase rule, and a shared function would make the host's and the player's permissions one parameter apart.
- `/code-review`: challenge and decoy were each looked up twice per render. Fixed with one `Secrets` component.
- `/code-review`: a poll can read the phase twice for an unassigned player (once in `ensureAssigned`, once in the route). Not changed. Why: one extra small read per phone every 10 seconds in the Lobby is far inside D1's free plan, and avoiding it means changing 3.01's `requirePlayer` for every screen.
- `/code-review`: showing the player their own challenge description during Game on might go against the scope's "full challenge descriptions are only shown at the reveal". Not changed, and not asked of Danny. Why: in Danny's real list the names (like "Challenge 1" in the test set) don't say what to do, so a player can't do their challenge without its description; the line sits under the hint list in the scope and is about the other 19 challenges. Only one reading makes the game playable.

## 2026-10-07: Fitting with 3.03 and 3.05

**Done**
- Agreed paths with the threads building 3.03 Accusations (`/accuse`, which links back to `/play`) and 3.05 Reveal (`/reveal`, which sends a phone back to `/play` outside the Reveal). Neither edits `src/routes/play.tsx`; this unit doesn't edit `src/index.ts`.
- The poll now sends a screen to `/reveal` when the Reveal starts. The accusations button reads "Make or change accusations", and the Lobby says accusations open when the game starts (3.03's suggestions). Typecheck and 243 tests pass.

**Worked**
- Nothing new to note.

**Didn't work**
- Nothing.

**Decisions**
- In the Reveal, the poll redirects to the results once (`HX-Redirect: /reveal` when the key it last saw is from another phase), but a plain visit to `/play` doesn't redirect. Why: 3.05 suggested always redirecting; this moves everyone over on their own at the big moment, while players can still come back to the hint list and the log-out button, and `/play` and `/reveal` can never redirect to each other in a loop.
- Until 3.03 and 3.05 merge, the links give the 404 page. Why: the three units are built in parallel; the Reveal and accusations can't be reached on `main` meaningfully until they land, and nobody plays on `main` before then.
