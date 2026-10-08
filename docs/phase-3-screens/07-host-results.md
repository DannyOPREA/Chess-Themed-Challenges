# Phase 3, unit 07: Host results button

- Status: Done
- Log: [logs/phase-3-screens/07-host-results.md](../../logs/phase-3-screens/07-host-results.md)
- Depends on: 3.04 Host page, 3.05 Reveal

## Goal

A "Show the results" button on the host page in the Reveal phase, opening the same leaderboard and points breakdown the players see, without the host having to join as a player. Added at Danny's request on 2026-10-08, after playing a game on the live app.

## Scope references

- `docs/scope.md`, "Host page": opening the results in the Reveal is one of the host's actions (added with this unit, Danny's request of 2026-10-08). Before the Reveal the host page still shows no challenge or decoy outside "show all".
- `docs/scope.md`, "Reveal": what the results show. The host's copy is the same screen as the players', not a big-screen show (still "Not in scope").
- `CLAUDE.md` rule 2: the results show everyone's challenge and decoy, so `/host/results` refuses to show anything before the Reveal, like `/reveal`.
- `CLAUDE.md` rule 1: the host's copy reuses unit 3.05's components and scoring, rather than a second results screen.

## Work

1. `src/routes/reveal.tsx` (unit 3.05):
   - `Results`: the "Final results" heading, the leaderboard and everyone's breakdown, as `/reveal` showed them, scored with `scoreGame` from the game `loadFinalGame` read (`src/db/reveal.ts`, which now names that type `FinalGame`). It takes `you` (the phone's own player, marked "(you)" and opened; `undefined` for the host), `show` (one more breakdown to open) and `path` (the page the leaderboard's name links point at).
   - `showQuery` is exported for the host route. `/reveal` itself is unchanged for players.
   - The `seeReveal` phase rule (`src/game/phases.ts`) gates both pages; its comment says so.
2. `src/routes/host.tsx`:
   - In the Reveal, under "The game is over. This is the final phase.", a "Show the results" button (a primary button, as it is the one thing to do then) linking to `/host/results`.
   - `GET /host/results`: before the Reveal, a 303 back to `/host` that reads nothing about anyone. In the Reveal, a "Final results" page with a "Back to the host page" link at the top and a button at the bottom, and `Results` with no `you`, so nobody is marked and no breakdown is open, and name links to `/host/results?show=<id>#player-<id>`.
   - Behind the host page's `basicAuth` and `no-store` header, like every other `/host` path. It needs no player cookie.
3. `docs/scope.md`, `docs/phases.md`, `CLAUDE.md` rule 2, `README.md`: the new host action.

## Tests

`test/host.test.ts`, "results in the Reveal":

- The host page links to the results only in the Reveal.
- Before the Reveal, `/host/results` goes back to the host page and its response names no player, challenge, decoy or points.
- In the Reveal, without a player cookie: the leaderboard and every breakdown match what a player's own `/reveal` shows (with their "(you)" and open card taken out), including full descriptions; `no-store`.
- Nobody is marked as "you", no breakdown is open, the page links back to the host page and not to `/play`.
- Leaderboard names link to the host's copy, `?show=` opens that breakdown, and bad values are ignored.
- It needs the host password; `/host/results` is in the list of protected host paths.
- `test/reveal.test.ts` still passes unchanged for the players' screen.

## Done when

- `npm run typecheck` and `npm test` pass, locally and in CI's `check` job.
- On `npm run dev`, in a phone-sized browser: after a game is moved to the Reveal, the host page shows "Show the results", which opens the leaderboard and breakdowns with the same scores as a player's phone; `/host/results` before the Reveal shows the host page.

## Not in this unit

- A big-screen reveal show (`docs/scope.md`, "Not in scope").
- Marking the host's own player on the host's copy. The host page doesn't know which player Danny is; Danny's own phone shows "(you)" as before.
