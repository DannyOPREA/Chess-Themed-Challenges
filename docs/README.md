# docs

This folder holds two kinds of file.

- **Reference docs**, at the top level of `docs/`. They have no log.
  - `scope.md`: the agreed spec. It decides how the game behaves.
  - `phases.md`: the phase-by-phase plan, listing each phase and its units. It will be written once the phases are agreed with Danny.
  - `README.md`: this file.
- **Build plans**, one sub-folder per phase. Each plan covers one unit: a piece of work small enough to build, test and merge in one PR.

Every build plan has a log at the same path under `logs/`. For example, `docs/phase-1-foundation/01-scaffold.md` is logged in `logs/phase-1-foundation/01-scaffold.md`. The log format is in [`logs/README.md`](../logs/README.md).

## Naming

- Phase folders are `phase-<N>-<slug>`, with N counting from 1 and the slug in lower-case words joined by hyphens, such as `phase-1-foundation`.
- Unit files are `<NN>-<slug>.md`, with NN a two-digit number counting from 01 within the phase, in build order, such as `01-scaffold.md`.
- Once work on a unit has started, its file is never renamed or renumbered, because links and its log point at it. A unit that is no longer needed stays in place with status `Dropped`, and its log says why.

## Writing and keeping a plan

1. Write the plan from the template below and create its log with a first entry ("Plan written"), before building starts. Danny approves `phases.md`. A unit plan that stays within `phases.md` and `scope.md` is built without a separate OK, in the same PR as the plan, and Danny reviews it there.
2. A plan implements `scope.md` and follows `CLAUDE.md`. If a plan needs something `scope.md` doesn't allow, or anything under "Not in scope", ask Danny first.
3. Update the status in the plan's header as the unit moves on: `Draft`, `Agreed`, `In progress`, `Done`, or `Dropped`.
4. When the work turns out differently from the plan, edit the plan in place so it describes what was actually built, and record the change and the reason in the log. The plan says what the unit is; the log says how it got there.
5. Plans, logs and their PRs use the `test` content set only (`CLAUDE.md` rule 5).

## Template

```markdown
# Phase <N>, unit <NN>: <unit name>

- Status: Draft
- Log: [logs/phase-<N>-<slug>/<NN>-<slug>.md](../../logs/phase-<N>-<slug>/<NN>-<slug>.md)
- Depends on: <earlier units, or "nothing">

## Goal

What this unit delivers, in a sentence or two.

## Scope references

The parts of `docs/scope.md` and the `CLAUDE.md` rules this unit implements or must respect.

## Work

1. The steps, in order.

## Tests

What the automated tests cover. Units that touch scoring, detection, assignment or late joiners list the cases (`CLAUDE.md` rule 3).

## Done when

- Checkable outcomes, always including `npm run typecheck` and `npm test` passing.

## Not in this unit

What is deliberately left for later units.
```
