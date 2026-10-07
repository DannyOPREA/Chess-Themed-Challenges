# Chess pub crawl app

A mobile web app for a one-night chess-themed pub crawl (Saturday 2026-10-10, about 20 players on their own phones). Each player is secretly given a challenge and a decoy, accuses other players of challenges, and is scored at the reveal.

**`docs/scope.md` is the agreed spec.** Read it before changing anything about how the game behaves.

## Stack (agreed; don't swap pieces without Danny's OK)

- Cloudflare Workers (free plan) + D1, TypeScript
- Hono with server-rendered `hono/jsx` pages; htmx for interactivity, screens poll every 10 s
- Drizzle ORM + drizzle-kit migrations
- Pico CSS
- Zod + `@hono/zod-validator` for input checking
- `uqr` for the join QR code
- Player login: Hono signed cookies; 4-digit PIN stored as a salted SHA-256 hash via Web Crypto. No lockout after wrong PINs.
- Host page: Hono `basicAuth`, password kept as a Cloudflare secret
- Tests: Vitest + `@cloudflare/vitest-pool-workers`
- Deploys: Cloudflare Workers Builds, on every push to `main`

## Commands

The project scaffold must provide these npm scripts. Keep the names: the session hook, CI and permission rules rely on them.

- `npm run dev`: local dev server with a local D1
- `npm test`: Vitest, once (not watch mode)
- `npm run typecheck`: `tsc --noEmit`
- `npm run db:generate`: generate a migration from the Drizzle schema
- `npm run db:migrate:local`: apply migrations to the local D1

## Plans and logs ("project partitioning")

Danny's way of working: the build is split into phases, each phase into units, and every unit has a build plan in `docs/` and a matching log in `logs/`.

- `docs/scope.md` is the spec and `docs/phases.md` is the phase-by-phase plan (written once the phases are agreed). Each unit's build plan is `docs/phase-<N>-<slug>/<NN>-<slug>.md`. One unit is one PR. Naming, statuses and the plan template are in `docs/README.md`.
- Every build plan has a log at the same path under `logs/`: a dated record of what was done, what worked, what didn't, and each decision with its reason. Entry format and rules are in `logs/README.md`.
- Before working on a unit, read its plan and its log.
- Work that isn't in any unit's plan gets a plan first, or is added to the plan of the unit it belongs to.
- In the same PR as the work: keep the plan matching what was actually built, update its status, and append a log entry.

## Rules

1. **Reuse before writing.** For any solved problem, use a maintained library, a Hono middleware or a Cloudflare service. Custom code is only for the game itself (assignment, accusations, phase rules, detection, scoring) and the screens.
2. **No spoilers.** All game logic runs on the server. Before the reveal, nothing sent to a player's browser may contain another player's challenge, decoy, completion status, or whether any accusation is right. The host page never shows challenges or decoys, except behind the clearly marked emergency "show all" button.
3. **Scoring and detection follow `docs/scope.md` exactly.** Tests must cover scoring, detection, unique assignment and late joiners.
4. **Content** (20 challenges, decoys and hints) lives in the repo, with no editing screen. There are two sets: `test` (placeholders such as "Challenge 1", "Decoy 1", "Hint for Challenge 1") and `real` (Danny's list). The Worker setting `CONTENT_SET` picks one and starts as `test`. Development, automated tests and the Thursday test run all use `test`. Switching to `real` is a single PR that also clears all game data. See `docs/scope.md`.
5. **Keep the real content out of anything testers might see**: test fixtures, screenshots, PR descriptions and commit messages use the `test` set. The repo is public by Danny's choice, and committing the real content file is fine.
6. Anything under "Not in scope" in `docs/scope.md` needs Danny's OK first.
7. **Never deploy from a session.** Don't run `wrangler deploy`, `wrangler secret put` or any `--remote` command. Production changes only through Workers Builds when `main` changes.
   The Cloudflare connector, when a session has it, is for looking only: listing resources and read-only (`SELECT`) D1 queries. Don't create, change or delete anything through it unless Danny asks for that specific change in the thread.
8. Before calling work done, `npm run typecheck` and `npm test` must pass, and the unit's plan and log must be up to date.

## Claude Code setup in this repo

- `.claude/skills/`: official skills copied unchanged from upstream: `hono` and `hono-jsx` (honojs/skills, MIT) and `wrangler` and `workers-best-practices` (cloudflare/skills, Apache-2.0). Sources and commits are in `.claude/skills/SOURCES.md`. Don't edit them; re-copy from upstream to update.
- `.claude/hooks/session-start.sh`: installs npm packages at the start of cloud sessions.
- `.claude/settings.json`: the hook and permission rules. These only apply while the Claude project has exactly one repository.
- `.github/workflows/ci.yml`: typecheck and tests on every PR and push to `main`.
- Cloud sessions may not be able to reach docs sites. If a fetch fails, use the skills above, the type definitions and READMEs in `node_modules`, or the library's docs on `raw.githubusercontent.com`.
