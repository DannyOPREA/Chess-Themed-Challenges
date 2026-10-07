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
