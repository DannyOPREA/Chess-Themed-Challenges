# Log: general

Work that belongs to no unit: project setup, process changes, and decisions that cover the whole project. Work on a unit is logged in that unit's own log. The rules in [`README.md`](README.md) apply here too.

## 2026-10-07: Scope agreed

**Done**
- Scoping questions put to Danny, and the agreed answers written up as the spec, now `docs/scope.md`.

**Worked**
- Danny accepted every recommended default in one go, so the scope was fixed before any building started.

**Didn't work**
- Nothing.

**Decisions**
- Host-driven phases (Lobby, Game on, Accusations closed, Reveal) with no timers. Why: the recommended default, which Danny accepted; Danny ends the game by hand at the last pub.
- Name plus 4-digit PIN to join and rejoin. Why: a player who loses their phone or browser must get back in with the same challenge, decoy and accusations (Danny's constraint).
- Host page is password-protected and never shows challenges or decoys, apart from an emergency "show all" button. Why: Danny plays too.
- Free hosting on Cloudflare Workers and D1. Why: Danny strongly preferred free hosting, and it's always on.
- The detection rule and scoring table are in `docs/scope.md`. Why: the recommended defaults, which Danny accepted.

## 2026-10-07: Tech stack agreed

**Done**
- Compared stack options and recorded the agreed stack in `CLAUDE.md`.

**Worked**
- Nothing to note.

**Didn't work**
- Nothing.

**Decisions**
- Hono with server-rendered JSX and htmx on Workers and D1, Drizzle, Pico CSS, Zod, `uqr`, Vitest, deploys through Workers Builds. Why: Danny's rule to reuse maintained libraries and services and to write custom code only for the game itself.
- No lockout after wrong PIN guesses. Why: Danny said no to a lockout.

## 2026-10-07: Claude Code setup (PRs #1 to #3)

**Done**
- PR #1: `CLAUDE.md`, `docs/scope.md`, official Hono and Cloudflare skills copied unchanged, a session-start hook that installs packages, permission rules, and the CI workflow.
- PR #2: test and real content sets added to the scope and rules.
- PR #3: the Cloudflare connector limited to read-only use.

**Worked**
- The repo's Claude setup reaches the project's cloud threads, as long as the project has exactly one repository.

**Didn't work**
- The cloud network blocked the stack's docs sites at first. Danny allowed them in the environment settings.
- Danny hit a GitHub merge error on PR #3. It was merged afterwards.

**Decisions**
- The Thursday 2026-10-08 test run uses placeholder content, picked by the `CONTENT_SET` setting, and switching to the real content is one PR that also clears all game data. Why: the test must not give anything away to testers who will play on Saturday.
- The repo stays public. Why: Danny's choice, because branch protection is free on public repos. Committing the real content is fine, but anything testers might see uses the test set.
- Sessions never deploy, and production changes only through Workers Builds when `main` changes. Why: so every production change is a reviewed merge.

## 2026-10-07: Plans and logs structure (PR #4)

**Done**
- Added the "project partitioning" structure: unit build plans in phase sub-folders of `docs/`, one log per plan at the same path in `logs/`, this general log, and the rules in `docs/README.md`, `logs/README.md` and `CLAUDE.md`.

**Worked**
- Nothing to note yet.

**Didn't work**
- Nothing.

**Decisions**
- Phase sub-folders, even for a small project. Why: the number of phases isn't known yet, and sub-folders keep each plan's path matching its log's.
- One unit is one PR, and the log entry goes in the same PR as the work. Why: the log then lands on `main` together with the code it describes.
- Danny approves the phase-by-phase plan, and unit plans are built without a separate OK unless they go beyond it or the scope. Why: the build has to be ready by Thursday, and Danny still reviews every PR. Danny chose this.
- A general log for work outside any unit. Why: keeps the record of decisions complete. Danny chose this.

## 2026-10-07: Working agreement

**Done**
- Recorded the working agreement between Danny and Claude in `CLAUDE.md`, with the plans and logs rules now part of it.
- Added the `unit-reviewer` sub-agent (`.claude/agents/unit-reviewer.md`) and the review steps every unit passes before it is merged.
- Updated `docs/README.md` so plans no longer wait for Danny's approval.

**Worked**
- The `main` ruleset (PR required, 0 approvals, `check` CI required) needs no human approval, so a Claude thread can merge its own PR once `check` passes. This PR is the first one Claude merges itself.
- Playwright and Chromium are preinstalled in cloud containers, so the reviewer can play the app in a phone-sized browser without adding a dependency.

**Didn't work**
- Nothing.

**Decisions**
- Claude plans, builds, reviews and merges units without waiting for Danny, and asks only when there is no obvious answer or several obvious answers and Danny's preference is unknown. Why: Danny wants to be as hands-off as possible and will review the whole app at the end.
- Danny no longer approves `docs/phases.md` or reviews unit PRs. Why: Danny's agreement replaces those earlier decisions from the plans and logs PR.
- Every unit is reviewed twice before merging: the built-in `/code-review` skill and a separate `unit-reviewer` agent that also runs the app. Why: Danny asked for a review at least as strict as their own; the built-in skill is reused, and the custom agent only adds what it can't know (the plan, the scope, the spoiler rule, and playing the screens). This reverses the earlier choice of no custom sub-agents, which assumed Danny reviewed every PR.
- Merges wait for Danny while the app is in live use (from 17:00 UK on Thursday 2026-10-08 and on Saturday 2026-10-10, until Danny says it's over). Why: every merge to `main` redeploys the live app, so a merge mid-game could break the night. The 17:00 start is Claude's default; Danny can change it.
- Switching to the real content stays Danny's call. Why: it clears all game data in production and its timing depends on the Thursday test run.
- A whole-app check thread runs after the last unit, before Danny's review. Why: unit reviews can miss problems that only show in a full game.

## 2026-10-07: Phase-by-phase plan written

**Done**
- Wrote `docs/phases.md`: 4 phases and 11 units, each with what it delivers and what it depends on, the order in waves of parallel units, and the key dates.

**Worked**
- Danny approved the plan on 2026-10-07, after one change (no target times).

**Didn't work**
- Nothing.

**Decisions**
- Danny approves this plan before any unit starts. Why: Danny asked to approve it ("After I approve it, you will take it from there"), which overrides the working agreement's line that Danny no longer approves `docs/phases.md`. Later changes to the plan follow the working agreement.
- Unit plans are written in each unit's own PR, not in this one. Why: `docs/README.md` says each unit's plan is written and built in the same PR, and the unit thread knows the code it builds on.
- The game rules (scoring, detection, assignment) are pure functions in their own phase, built in parallel with the database. Why: they are what `CLAUDE.md` rule 3 says must be tested, they need no screens or database, and running them in parallel saves time before Thursday.
- The phase rules (what each phase allows) go in unit 1.02 with the schema rather than a unit of their own. Why: they are small and sit next to the stored phase; a separate unit would add a full review cycle for a few lines.
- Accusations get their own screen and unit (3.03), separate from the player screen (3.02). Why: the two can then be built in parallel without editing the same file.
- Deploy setup (1.03) comes in the second wave, though nothing depends on it. Why: Danny's Cloudflare steps (linking the repo, the production database, the secrets) can then be done early, and every later merge deploys, so deploy problems show up well before the Thursday test.
- The plan gives no target times, only the test run at 18:00 UK on Thursday 2026-10-08. Why: Danny asked for this, so that the coordinator doesn't time its work to a schedule and works non-stop until Danny says to stop. An earlier draft had targets of 13:00 and 16:00 on Thursday.
- The whole-app check is not a unit. Why: the working agreement logs its fixes in the units they touch; the check itself is logged here.
- The switch to the real content is planned now as unit 4.01, but built only when Danny says. Why: it clears all game data in production, and its timing depends on the Thursday test run.

## 2026-10-07: Test package renamed in the plan

**Done**
- `docs/phases.md` (unit 1.01) and `CLAUDE.md` now name `@cloudflare/vitest-plugin`, in the scaffold PR.

**Worked**
- Nothing to note.

**Didn't work**
- Nothing.

**Decisions**
- Use `@cloudflare/vitest-plugin`. Why: it is Cloudflare's new name for `@cloudflare/vitest-pool-workers`, which is deprecated and gets no more updates. The same package, so not a stack swap.
