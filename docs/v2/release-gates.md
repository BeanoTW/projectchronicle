# V2 release gates

V2 cannot replace V1 until every gate is met. Current status is honest, not aspirational.

The authoritative implementation roadmap uses phases **0–9**. The numbers in
this document identify release gates, not implementation phases. Performance
and migration qualification are gates for Phase 9 cutover, not additional
feature phases.

| Gate | Requirement | Status |
|---|---|---|
| 1 — Feature parity | Every capability in `capability-matrix.md` is Complete or explicitly Retired with user agreement | **Partially met** — current work has closed Privacy Shield, record types, Record History, Settings and account deletion; auth/sync and remaining migration dependencies still require cutover qualification |
| 2 — Data safety | Migration dry runs over fixtures and an authorised full production snapshot show zero unexplained loss; every warning has a documented rule | **Not met** — fixture harness exists, but no appropriate production snapshot has been qualified. Absence of that snapshot must never be reported as a pass |
| 3 — Reliability | Seal, media write, export and storage-exhaustion paths all fail safely; sealed text is never lost | **Partially met** — seal survives media failure, offline state is surfaced; quota-exhaustion retry outstanding |
| 4 — Accessibility | Capture, Notebook, Entry, Dossier and export are keyboard and screen-reader usable; dialogs labelled; reduced motion respected | **Partially met** — dialogs, focus rings and reduced motion done; FilterSheet, MonthView and Dossier config unaudited |

| 5 — Performance | Notebook, search, filters and Dossier usable at 5,000 records / 500 attachments | **Not met** — the existing `scaleDataset.ts` harness covers 100/1,000/5,000 records and 500 attachments, but a qualification run, environment record and comparison with acceptance limits are still required |
| 6 — User acceptance | Capture, retrieval and export judged clearly better than V1 by the tester group | **Not met** |
| 7 — Rollback | V1 UI reachable and V1 data intact for one full release cycle after cutover | **Met by design** — V1 routes and `chronicle_local` untouched |

## Required gate evidence

- Performance evidence records the commit, command, browser/runtime, operating
  system, hardware or CI runner, dataset sizes, measured results and applicable
  acceptance limits. Reuse the existing harness.
- Migration evidence requires the fixture dry run first and an authorised
  production-snapshot dry run later. Preserve the harness and criteria while a
  suitable snapshot is unavailable; do not claim the gate has passed.
- Both items are prerequisites for Phase 9 cutover.
