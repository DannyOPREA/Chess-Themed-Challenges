# Phase-by-phase plan

- Written: 2026-10-07
- Approved by Danny: 2026-10-07
- Changes to this plan are logged in [`logs/general.md`](../logs/general.md).

This plan splits the build of [`scope.md`](scope.md) into 4 phases and 11 units. One unit is one PR. Each unit's detailed build plan is written in its own PR, at the path shown, from the template in [`README.md`](README.md); this file only fixes what each unit delivers, what it depends on, and the order.

## Key dates

| When | What |
|---|---|
| Thursday 2026-10-08, 18:00 UK | Danny's test run with the `test` content |
| After the test run, when Danny says | Switch to the `real` content and clear the game (unit 4.01) |
| Saturday 2026-10-10 | The crawl |

The build has no target times (Danny, 2026-10-07). Work runs non-stop until Danny says to stop: each unit starts as soon as the units it depends on are merged, and the whole-app check starts as soon as phases 1 to 3 are.

## Build order

Units in the same wave can run in parallel. A unit starts once every unit it depends on is merged.

| Wave | Units, in parallel | Waits for |
|---|---|---|
| A | 1.01 Scaffold | nothing |
| B | 1.02 Data and content, 1.03 Deploy setup, 2.01 Scoring and detection, 2.02 Assignment | 1.01 |
| C | 3.01 Join and rejoin, 3.04 Host page | 1.02 and 2.02 |
| D | 3.02 Player screen, 3.03 Accusations, 3.05 Reveal | 3.01 (and 2.01 for 3.05) |
| E | Whole-app check (not a unit, see below) | every unit in phases 1 to 3 |
| F | 4.01 Switch to real content | the Thursday test run and Danny's word |

No other unit needs 1.03, but it comes early so that Danny's Cloudflare steps can be done before Thursday.

## Phase 1: Foundation

Folder: `docs/phase-1-foundation/`

### 1.01 Scaffold (`01-scaffold.md`)

- Depends on: nothing
- Delivers: the empty app that runs locally and in CI. Hono with `hono/jsx` server-rendered pages, a shared page layout with Pico CSS and htmx, `wrangler.jsonc` with the D1 binding and the `CONTENT_SET` variable (set to `test`), Drizzle and drizzle-kit configured, Vitest with `@cloudflare/vitest-plugin` (the new name of `@cloudflare/vitest-pool-workers`), and the npm scripts `CLAUDE.md` names (`dev`, `test`, `typecheck`, `db:generate`, `db:migrate:local`). One placeholder page and one test, so CI's `check` job starts running for real.
- Sets the layout later units share: routes for each screen in their own file under `src/routes/`, game logic in `src/game/`, content in `src/content/`, each registered in `src/index.ts` with one line, so parallel units rarely touch the same lines.

### 1.02 Data and content (`02-data-and-content.md`)

- Depends on: 1.01
- Delivers: the Drizzle schema and first migration (the game's current phase, players with name, PIN hash, challenge, decoy and completion, and accusations), and the two content sets: `test` (the placeholders in `scope.md`) and `real` (Danny's list with the two fixes in `scope.md`), with a loader that picks one by `CONTENT_SET`. Also the phase rules: which phase allows which action, and which phase changes the host can make.
- Tests: the loader picks the right set; each set has 20 challenges, decoys and hints with matching names; the phase rules.

### 1.03 Deploy setup (`03-deploy-setup.md`)

- Depends on: 1.01
- Delivers: everything needed for Cloudflare Workers Builds to build, apply D1 migrations and deploy on every push to `main`, and a short checklist for Danny of the steps only Danny can do in the Cloudflare dashboard: linking the repo to Workers Builds, the production D1 database, and the two secrets (the host password and the cookie signing key). Local values go in a git-ignored `.dev.vars`; the secret names and the example file come with 1.01.
- Runs early so the live app exists well before Thursday, and every later merge deploys. Sessions never deploy (`CLAUDE.md` rule 7); this unit only prepares the config and the checklist.

## Phase 2: Game rules

Folder: `docs/phase-2-game-rules/`

Pure functions over plain data, with no database or screens, so they can be built and tested in parallel with phase 1.

### 2.01 Scoring and detection (`01-scoring-and-detection.md`)

- Depends on: 1.01
- Delivers: detection (a player is detected if at least one other player's final guess about them is correct) and scoring exactly as the table in `scope.md`, plus the leaderboard with shared ranks for ties and the per-player breakdown the reveal shows.
- Tests (`CLAUDE.md` rule 3): every row of the scoring table, detection by one and by several players, nobody detected, everyone detected, players with no accusations, ties, and at least one full game worked out by hand.

### 2.02 Assignment (`02-assignment.md`)

- Depends on: 1.01
- Delivers: random challenge and decoy assignment. Unique while there are 20 or fewer players, reused only beyond 20. Covers assigning everyone in the lobby when Game on starts and assigning a late joiner an unused challenge and decoy.
- Tests (`CLAUDE.md` rule 3): uniqueness for 1 to 20 players, more than 20 players, late joiners, and that an assigned player is never reassigned.

## Phase 3: Screens

Folder: `docs/phase-3-screens/`

Each screen polls every 10 seconds with htmx. No unit may send a player another player's challenge, decoy, completion status, or whether an accusation is right before the reveal (`CLAUDE.md` rule 2).

### 3.01 Join and rejoin (`01-join-and-rejoin.md`)

- Depends on: 1.02, 2.02
- Delivers: the join page (name, unique ignoring capitals, and a 4-digit PIN stored as a salted SHA-256 hash), the signed cookie that remembers the phone, rejoining with the same name and PIN from a new phone, and assignment for late joiners during Game on. Provides the "current player" helper the other player screens use.
- Tests: duplicate names in different capitals, wrong PIN, rejoin keeps the same challenge and decoy, a late joiner gets an unused challenge.

### 3.02 Player screen (`02-player-screen.md`)

- Depends on: 3.01
- Delivers: the player's home screen. Their own challenge, decoy and completion status, the "I've done it" button and its undo (Game on only), the hint list of all 20 challenge names and hints, and what the screen shows in Lobby, Accusations closed and Reveal.

### 3.03 Accusations (`03-accusations.md`)

- Depends on: 3.01
- Delivers: the accusations screen. Pick another player, then a challenge name; one active guess per other player; change or clear it; no self-accusation; frozen once accusations close; no feedback until the reveal.
- Tests: one guess per player, change, clear, no self-accusation, refused outside Game on.

### 3.04 Host page (`04-host-page.md`)

- Depends on: 1.02, 2.02
- Delivers: the password-protected host page (Hono `basicAuth`). Who has joined, changing the phase (assigning the lobby at the start of Game on), marking or unmarking a player's completion, removing a player, resetting a PIN, the join QR code (`uqr`), and the clearly marked emergency "show all" button. Never shows challenges or decoys outside that button.
- Tests: phase changes, host completion fixes while accusations are closed, removing a player.

### 3.05 Reveal (`05-reveal.md`)

- Depends on: 2.01, 3.01
- Delivers: the reveal screen, shown only in the Reveal phase: the final leaderboard and each player's breakdown (challenge, decoy, completed or not, who detected them, their correct and wrong accusations), with full challenge descriptions.

## Whole-app check

Not a unit. When every unit in phases 1 to 3 is merged, the coordinator starts one thread that runs the `unit-reviewer` agent across the whole app and plays a full game from Lobby to Reveal with several players, working the scores out by hand (`CLAUDE.md`, "Review before merging"). Fixes go in the logs of the units they touch; the check itself is logged in `logs/general.md`.

## Phase 4: Launch

Folder: `docs/phase-4-launch/`

### 4.01 Switch to real content (`01-switch-to-real-content.md`)

- Depends on: every earlier unit, the Thursday test run, and Danny's word (`CLAUDE.md`, "Stop and ask Danny")
- Delivers: the single PR that sets `CONTENT_SET` to `real` and clears all game data (players, completions, accusations, phase back to Lobby), so Saturday starts from an empty lobby. Merged only when Danny asks, as the merge freeze is on by then.
