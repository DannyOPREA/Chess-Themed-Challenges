# logs

`logs/` mirrors the build plans in `docs/`: every build plan has exactly one log at the same path. For example, `docs/phase-1-foundation/01-scaffold.md` is logged in `logs/phase-1-foundation/01-scaffold.md`. The reference docs at the top of `docs/` (`scope.md`, `phases.md`, `README.md`) have no log.

A log is a dated record of the unit's history: what work was done, what worked, what didn't, and which decisions were taken and why. It is what a later session (or Danny) reads to understand how the unit got to where it is, so it records the reasons that the code and the plan don't show.

## Rules

1. The log is created together with its plan, with a first entry "Plan written".
2. Add an entry for each working session on the unit, in the same PR as the work it describes. A unit's PR isn't ready until its log entry is in.
3. Work that never reaches a PR, such as an approach that was tried and abandoned, still gets logged, in the unit's next PR.
4. Entries are only ever added, oldest first. Don't rewrite or delete earlier entries; if one turns out to be wrong, add a new entry saying so.
5. Dates are UK dates in `YYYY-MM-DD` form. Two sessions on the same day get two entries.
6. Decisions always carry their reason. When Danny made the decision, say so.
7. Logs are public and use the `test` content set only (`CLAUDE.md` rule 5). Never copy real challenges, decoys or hints into a log.

## Template

```markdown
# Log: phase <N>, unit <NN>: <unit name>

Plan: [docs/phase-<N>-<slug>/<NN>-<slug>.md](../../docs/phase-<N>-<slug>/<NN>-<slug>.md)

## YYYY-MM-DD: <short title of the session>

**Done**
- What was built or changed.

**Worked**
- What went as planned, or better.

**Didn't work**
- What was tried, what went wrong, and what was done instead. "Nothing" if nothing.

**Decisions**
- <The decision>. Why: <the reason>.
```
