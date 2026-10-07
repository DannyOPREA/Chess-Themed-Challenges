# Log: phase 3, unit 05: Reveal

Plan: [docs/phase-3-screens/05-reveal.md](../../docs/phase-3-screens/05-reveal.md)

## 2026-10-07: Plan written

**Done**
- Wrote the unit plan from `docs/phases.md`, unit 3.05, `docs/scope.md`, "Reveal" and "Detection and scoring", and 2.01's handover.
- Told the 3.02 Player screen and 3.03 Accusations threads, built in parallel, that the reveal lives at `/reveal` in its own route file, and suggested 3.02 sends players there from `/play` once the Reveal starts.

**Worked**
- Nothing to note yet.

**Didn't work**
- Nothing.

**Decisions**
- Plan and build in the same PR. Why: `docs/README.md` and the working agreement.
- The reveal is its own page, `/reveal`, rather than part of `/play`. Why: 3.02 owns `/play` and is being built at the same time; a separate file means no merge conflict, and 3.02 only has to send players there.
