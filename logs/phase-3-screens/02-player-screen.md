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
