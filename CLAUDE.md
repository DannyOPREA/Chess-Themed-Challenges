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
- Tests: Vitest + `@cloudflare/vitest-plugin` (Cloudflare's new name for `@cloudflare/vitest-pool-workers`)
- Deploys: Cloudflare Workers Builds, on every push to `main`

## Commands

The project scaffold must provide these npm scripts. Keep the names: the session hook, CI and permission rules rely on them.

- `npm run dev`: local dev server with a local D1
- `npm test`: Vitest, once (not watch mode)
- `npm run typecheck`: `tsc --noEmit`
- `npm run db:generate`: generate a migration from the Drizzle schema
- `npm run db:migrate:local`: apply migrations to the local D1
- `npm run cf-typegen`: regenerate `worker-configuration.d.ts` (the `Env` type) after changing `wrangler.jsonc`

The code layout and conventions every unit follows (where routes, game logic, content and tests go) are in `docs/phase-1-foundation/01-scaffold.md`, "Conventions for later units".

## Working agreement

Agreed with Danny on 2026-10-07. Danny wants to be as hands-off as possible: Claude plans, builds, reviews and merges the units on its own, and Danny reviews the whole app once development ends. It applies to every Claude in the project, the coordinator and each thread.

### Carry on without asking

- The coordinator starts threads on units as it sees fit, without waiting for Danny's go-ahead or a review of earlier units. A unit starts once the units its plan depends on are merged; independent units can run in parallel.
- Threads work around problems themselves: try another approach, a library's README or types in `node_modules`, a different tool. A problem is never parked just because it is awkward.
- Where something isn't specified, pick the reasonable default, record it with its reason in the log, and keep going.
- Threads merge their own PRs once the review below passes. Danny is never asked to merge.
- Danny is told about results, not asked to approve them. A thread's last message says what was merged and anything Danny will want to know at the final review.

### Stop and ask Danny

Ask only when the decision can't be sensibly made without Danny: there is no obvious answer, or there are two or more obvious answers and nothing says which Danny would prefer. Then ask once, with the options and a recommendation, and carry on with whatever doesn't depend on the answer. Also ask before:

- changing `docs/scope.md`, or doing anything under its "Not in scope" (rule 6), or swapping a piece of the stack
- switching `CONTENT_SET` to `real` and clearing the game data: Danny decides when, after the Thursday test run (rule 4)
- anything only Danny can do: settings, secrets, accounts, a change through the Cloudflare connector (rule 7)
- merging while the app is in live use: from 17:00 UK time on Thursday 2026-10-08 and on Saturday 2026-10-10, until Danny says the session is over, merge only what Danny asks for, because every merge to `main` redeploys the live app

When blocked on one of these, say so once in the thread, in one line, and keep working on everything else.

### Plans and logs ("project partitioning")

The build is split into phases, each phase into units, and every unit has a build plan in `docs/` and a matching log in `logs/`.

- `docs/scope.md` is the spec and `docs/phases.md` is the phase-by-phase plan. Each unit's build plan is `docs/phase-<N>-<slug>/<NN>-<slug>.md`. One unit is one PR. Naming, statuses and the plan template are in `docs/README.md`.
- Every build plan has a log at the same path under `logs/`: a dated record of what was done, what worked, what didn't, and each decision with its reason. Entry format and rules are in `logs/README.md`.
- Claude writes and merges `docs/phases.md` and the unit plans within the scope, without waiting for Danny. Each unit's plan is written and built in the same PR.
- Before working on a unit, read its plan and its log.
- Work on the app that isn't in any unit's plan gets a plan first, or is added to the plan of the unit it belongs to. Setup and process work that belongs to no unit is logged in `logs/general.md`.
- In the same PR as the work: keep the plan matching what was actually built, update its status, and append a log entry.

### Review before merging (in Danny's place)

Danny doesn't review units, so Claude does, at least as strictly as Danny would. Every unit PR passes all of these before it is merged:

1. `npm run typecheck` and `npm test` pass, and the plan and log are up to date (rule 8).
2. The built-in `/code-review` skill, run at `high` on the branch's diff against `main`. Fix every correctness finding, or log why it doesn't apply.
3. The `unit-reviewer` sub-agent (`.claude/agents/unit-reviewer.md`): a fresh Claude that didn't write the code checks the change against the plan, `docs/scope.md` and the rules here, runs the app locally and plays the changed screens in a phone-sized browser. Fix every Blocking and Should fix finding, then run it again until it passes. If the agent isn't listed in a session, start a general-purpose agent with that file's instructions.
4. The log entry records what both reviews found and what was done about each finding.
5. `main` is merged into the branch, CI's `check` job is green on the latest commit, and the PR has no conflicts. Then merge it with a merge commit.

PRs that change no app code (docs, plans, process) need steps 1, 4 and 5 only.

When the last unit is merged, the coordinator starts one more thread for a whole-app check before telling Danny the app is ready: the `unit-reviewer` run across the whole app, playing a full game from Lobby to Reveal with several players, with the scores worked out by hand and compared. Fixes from it, and from Danny's own final review, go in the logs of the units they touch.

## Rules

1. **Reuse before writing.** For any solved problem, use a maintained library, a Hono middleware or a Cloudflare service. Custom code is only for the game itself (assignment, accusations, phase rules, detection, scoring) and the screens.
2. **No spoilers.** All game logic runs on the server. Before the reveal, nothing sent to a player's browser may contain another player's challenge, decoy, completion status, or whether any accusation is right. The host page never shows challenges or decoys, except behind the clearly marked emergency "show all" button.
3. **Scoring and detection follow `docs/scope.md` exactly.** Tests must cover scoring, detection, unique assignment and late joiners.
4. **Content** (20 challenges, decoys and hints) lives in the repo, with no editing screen. There are two sets: `test` (placeholders such as "Challenge 1", "Decoy 1", "Hint for Challenge 1") and `real` (Danny's list). The Worker setting `CONTENT_SET` picks one and starts as `test`. Development, automated tests and the Thursday test run all use `test`. Switching to `real` is a single PR that also clears all game data. See `docs/scope.md`.
5. **Keep the real content out of anything testers might see**: test fixtures, screenshots, PR descriptions and commit messages use the `test` set. The repo is public by Danny's choice, and committing the real content file is fine.
6. Anything under "Not in scope" in `docs/scope.md` needs Danny's OK first.
7. **Never deploy from a session.** Don't run `wrangler deploy`, `wrangler secret put` or any `--remote` command. Production changes only through Workers Builds when `main` changes, so merging a PR is the only way Claude changes production, and it follows the review above.
   The Cloudflare connector, when a session has it, is for looking only: listing resources and read-only (`SELECT`) D1 queries. Don't create, change or delete anything through it unless Danny asks for that specific change in the thread.
8. Before calling work done, `npm run typecheck` and `npm test` must pass, and the unit's plan and log must be up to date.

## Claude Code setup in this repo

- `.claude/skills/`: official skills copied unchanged from upstream: `hono` and `hono-jsx` (honojs/skills, MIT) and `wrangler` and `workers-best-practices` (cloudflare/skills, Apache-2.0). Sources and commits are in `.claude/skills/SOURCES.md`. Don't edit them; re-copy from upstream to update.
- `.claude/agents/unit-reviewer.md`: the independent reviewer used before every unit merge (see "Review before merging").
- `.claude/hooks/session-start.sh`: installs npm packages at the start of cloud sessions.
- `.claude/settings.json`: the hook and permission rules. These only apply while the Claude project has exactly one repository.
- `.github/workflows/ci.yml`: typecheck and tests on every PR and push to `main`.
- Cloud sessions may not be able to reach docs sites. If a fetch fails, use the skills above, the type definitions and READMEs in `node_modules`, or the library's docs on `raw.githubusercontent.com`.
