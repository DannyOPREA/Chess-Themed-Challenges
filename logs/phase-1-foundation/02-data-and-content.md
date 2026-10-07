# Log: phase 1, unit 02: Data and content

Plan: [docs/phase-1-foundation/02-data-and-content.md](../../docs/phase-1-foundation/02-data-and-content.md)

## 2026-10-07: Plan written

**Done**
- Wrote the plan from `docs/phases.md` (unit 1.02), `docs/scope.md` and the 1.01 conventions.

**Worked**
- Nothing to note.

**Didn't work**
- Nothing.

**Decisions**
- Recorded below with the build, since the plan was written and built in one session.

## 2026-10-07: Build

**Done**
- Content: `src/content/test.json`, `src/content/real.json` and the loader `src/content/index.ts`. The real file was converted from Danny's text file by a throwaway script that also checked each hint's name matches its challenge's, and applied the two fixes from `docs/scope.md`. A second check confirmed every other string in the file appears word for word in Danny's original.
- Phase rules: `src/game/phases.ts`. Player name key: `src/game/names.ts`.
- Schema: `src/db/schema.ts` (`game`, `players`, `accusations`), `migrations/0000_init.sql` (generated) and `migrations/0001_seed_game.sql` (custom, the game row), `getPhase` in `src/db/game.ts`. Removed `migrations/.gitkeep`, now that the folder has files.
- Tests: `test/content.test.ts`, `test/phases.test.ts`, `test/schema.test.ts`, and `test/reset-db.ts` for clearing the database between tests.

**Worked**
- D1 enforces foreign keys, so `ON DELETE CASCADE` removes a removed player's accusations without any code.
- `drizzle-kit generate --custom` makes an empty migration in the journal for the seed row; a second `db:generate` reports no changes.

**Didn't work**
- The schema tests first assumed each test gets fresh storage, as the old `@cloudflare/vitest-pool-workers` did. The new plugin isolates storage per test file only (checked with two probe files): tests in one file share it. Added `resetDb()` for `beforeEach`.

**Decisions**
- Content as JSON files, checked with Zod when first loaded. Why: the tech-stack choice was "content as a JSON file in the repo", JSON is easy for Danny to edit on GitHub, and the check turns a bad edit into a failing test rather than a broken screen.
- Each hint is stored on its challenge rather than in a third list. Why: the scope pairs every hint with one challenge by name, so storing them together makes "matching names" true by construction.
- `loadContent` throws on a `CONTENT_SET` other than `test` or `real`, including different capitals. Why: a typo in the setting should fail loudly, not quietly show one set or the other.
- The game is a single row (id 1), seeded by a migration. Why: there is only ever one game (multiple games are out of scope), and seeding means every reader can rely on the row being there.
- `players.id` uses AUTOINCREMENT. Why: without it SQLite can give a removed player's id to the next player to join, and a phone still holding the removed player's signed cookie would then be logged in as the new player.
- Names are unique through a `name_key` column filled by `nameKey()` in JavaScript, not `COLLATE NOCASE`. Why: SQLite's case folding only covers A to Z, so names with accented capitals would otherwise not count as the same.
- The PIN hash and salt are separate columns. Why: clearer than packing them in one string; unit 3.01 fills them.
- Check constraints keep phases, challenge and decoy numbers (1 to 20) and self-accusation out of the database, as well as the code. Why: they are free, and they catch a bug in a later unit at the write rather than at the reveal.
- The host can fix a completion in Game on, Accusations closed and Reveal. Why: the scope lets the host override completions and says they can still fix them once accusations close; allowing it at the Reveal too lets a late correction fix the scores, and there is nothing left to spoil by then.
- Phase changes: each phase to the next, plus Accusations closed back to Game on. Why: the scope has the host move phases by hand, and closing accusations by mistake is the likeliest slip on the night; reopening it loses nothing. Game on can't go back to the Lobby, because assignment never changes once made, and the Reveal is final, because everything is public from then on.
- Joining is allowed in Lobby and Game on only; rejoining in every phase. Why: the scope allows late joiners during Game on; a player who switches phones after accusations close still needs to get back in to see the reveal.
- `getPhase` is here; changing the phase is left to unit 3.04. Why: every screen reads the phase, but only the host page changes it, together with assigning the lobby.

## 2026-10-07: Code review

**Done**
- Ran `/code-review` at `high` on the branch's diff against `main`. Ten findings, handled as follows:
  1. `nameKey` didn't ignore spaces, so "Dan" and "Dan " (a phone keyboard's trailing space) would be two players. Fixed: it trims, collapses repeated spaces and uses NFKC before lower-casing. Tested.
  2. Host completion fixes at the Reveal went beyond `docs/scope.md`, which calls the Reveal the final leaderboard. Fixed: allowed in Game on and Accusations closed only.
  3. Reopening accusations (Accusations closed back to Game on) went beyond `docs/scope.md`, which has the host move from one phase to the next and freezes everything once accusations close. Fixed: phases only move forward. This reverses two decisions in the Build entry above; see Decisions.
  4. Nothing in the database stopped an assignment changing. Fixed: `migrations/0002_assignment_final.sql` adds a trigger that refuses it, while assigning an unassigned player still works. Tested.
  5. A player could be marked completed before being assigned. Fixed: a check refuses it; another check makes challenge and decoy assigned together. Tested.
  6. `test/content.test.ts` quoted a word from a real hint, against rule 5 and the plan. Fixed: the test only checks that no real hint has asterisks; the spelling fix was checked at conversion.
  7. The schema imported `CONTENT_SIZE` from the content module, so `db:generate` loaded both content files. Fixed: `CONTENT_SIZE` is in `src/content/size.ts`.
  8. No index on `accusations.accused_id`. Fixed: added, since "who detected this player" filters on it.
  9. `resetDb` used raw SQL. Fixed: it uses the Drizzle tables, with a note that a new table must be added there.
  10. The plan's status and the log's review record weren't current. Done in this PR before merging.
- Regenerated the migrations from scratch rather than adding a fourth, since none has reached `main` or production.

**Worked**
- The trigger applies through both `wrangler d1 migrations apply` and the test runner's `applyD1Migrations`. Typecheck and 58 tests pass.

**Didn't work**
- Nothing.

**Decisions**
- Follow `docs/scope.md` exactly on phases: forward only, and host completion fixes up to Accusations closed. Why: going back, or changing scores at the "final" leaderboard, is new game behaviour that needs Danny's OK, and the scope's version works. A mis-tapped phase change is better guarded by a confirmation on the host page (unit 3.04) than by an undo.
- Enforce "assignment never changes" with a trigger. Why: it is a scope rule that a later unit's assignment code (2.02, 3.01, 3.04) could break with a careless `UPDATE`; the trigger turns that into a failed write and a failing test.

## 2026-10-07: Unit review

**Done**
- Ran the `unit-reviewer` agent on the code-review fixes. Verdict "Fix needed", nothing Blocking, one Should fix and some notes:
  1. Should fix: the safeguard for forward-only phases (a confirmation before each phase change on the host page) was only in this log, which the 3.04 thread won't read. Fixed: added to unit 3.04 in `docs/phases.md`, logged in `general.md`.
  - Note: the 1 to 20 checks let fractions through (SQLite stored 1.5 as it is). Fixed: the checks also require `typeof(...) = 'integer'`. Tested.
  - Note: the "start unassigned and not completed" test proved Drizzle's defaults, not the migration's. Fixed: it also inserts with raw SQL.
  - Note: `players.name` keeps spaces `nameKey` ignores. Added to unit 3.01 in `docs/phases.md`: trim the displayed name.
  - Notes left to later units: a join racing the start of Game on, and two late joiners picking the same challenge. Unit 2.02's plan already sets out the pattern for 3.01 and 3.04 (assign in the same batch as the phase change, assign anyone found unassigned, re-check `isLeastHeld`).
  - Note: the reviewer may have stopped a `wrangler dev` of this session with `pkill`; none was running, so nothing was lost.
- The reviewer confirmed: the real content matches Danny's file word for word apart from the two fixes; both content sets bundle and load under `wrangler dev`; all three migrations apply on a fresh local D1; and each safeguard's test fails when the safeguard is removed.
- Merged `main` (units 1.03, 2.01, 2.02) into the branch. No conflicts. Unit 2.02 also declared `CONTENT_SIZE`; it now re-exports this unit's (logged in its log).
- Regenerated the migrations once more for the new checks, as none has reached `main`.

**Worked**
- Typecheck and 110 tests pass after the merge.

**Didn't work**
- The first version of the integer check refused `null`, since SQLite's `typeof(null)` is `'null'`, so unassigned players couldn't be added. Fixed: `column is null or (...)`; `notNull()` still refuses null where a value is needed.

**Decisions**
- Status set to Done, pending the second unit review. Why: the remaining work is the review itself; any finding gets its own entry.
