# V2 release gates

V2 cannot replace V1 until every gate is met. Current status is honest, not aspirational.

| Gate | Requirement | Status |
|---|---|---|
| 1 — Feature parity | Every capability in `capability-matrix.md` is Complete or explicitly Retired with user agreement | **Not met** — auth, sync, privacy controls, settings, account deletion, record history missing |
| 2 — Data safety | Migration dry runs over a full production snapshot show zero unexplained loss; every warning has a documented rule | **Not met** — migration designed, never executed |
| 3 — Reliability | Seal, media write, export and storage-exhaustion paths all fail safely; sealed text is never lost | **Partially met** — seal now survives media failure; export and quota retry paths outstanding |
| 4 — Accessibility | Capture, Notebook, Entry, Dossier and export are keyboard and screen-reader usable; dialogs labelled; reduced motion respected | **Partially met** — dialogs, focus rings and reduced motion done; FilterSheet, MonthView and Dossier config unaudited |
| 5 — Performance | Notebook, search, filters and Dossier usable at 5,000 records / 500 attachments | **Not met** — not yet measured at scale |
| 6 — User acceptance | Capture, retrieval and export judged clearly better than V1 by the tester group | **Not met** |
| 7 — Rollback | V1 UI reachable and V1 data intact for one full release cycle after cutover | **Met by design** — V1 routes and `chronicle_local` untouched |
