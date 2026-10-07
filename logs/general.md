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
- Danny approves the phase-by-phase plan, and unit plans are built without a separate OK unless they go beyond it or the scope. Why: the build has to be ready by Thursday, and Danny still reviews every PR. This was put to Danny as a question and can change.
- A general log for work outside any unit. Why: keeps the record of decisions complete. This was put to Danny as a question and can change.
