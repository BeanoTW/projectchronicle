# V2 release gates

V2 cannot replace V1 until every gate is met. Statuses below describe evidence that exists in the repository now, not planned work or inferred readiness.

| Gate | Requirement | Status |
|---|---|---|
| 1 — Feature parity | Every required capability is available on the candidate path or explicitly retired with user agreement | **Partially met** — the capability matrix is being reconciled against the current shared/canonical architecture. Capture, record types, history, Privacy Shield, settings surfaces and other previously missing items have moved on since the original matrix; cloud-sync/cutover parity still needs a current end-to-end decision and proof. |
| 2 — Data safety | Migration dry runs over representative data show zero unexplained loss; every warning has a documented rule; activation cannot occur on unresolved migration issues | **Partially met** — deterministic canonical projection, atomic non-destructive writes, idempotent reruns, conflict rollback and owner-specific activation audit are implemented and tested. A synthetic 1,000-record migration/activation gate is covered in CI. A real production-snapshot migration review remains required before cutover. |
| 3 — Reliability | Seal, media write, export and storage-exhaustion paths fail safely; sealed text is never lost | **Partially met** — sealed wording survives media failures; exact media retry is tested; quota exhaustion is identified with recovery guidance; leaving with unsaved sealed-media bytes is explicitly warned; export failure is read-only. Representative-device failure testing remains outstanding. |
| 4 — Accessibility | Capture, Notebook, Entry, My Record and export are keyboard and screen-reader usable; dialogs labelled; reduced motion respected | **Partially met** — dialogs/focus/reduced motion are covered, and FilterSheet, MonthView and My Record configuration now have explicit keyboard/focus/ARIA semantics with regression tests. Full manual screen-reader and representative-device acceptance remains outstanding. |
| 5 — Performance | Notebook, search, filters and My Record remain usable at 5,000 records / representative attachment loads | **Partially met** — the deterministic performance harness measures Notebook/search/filter/month and report-model paths at 100, 1,000 and 5,000 records, with CI regression ceilings. Representative-device interaction and export-with-large-media testing remains outstanding. |
| 6 — User acceptance | Capture, retrieval and export judged clearly better than V1 by the tester group | **Not met** — the tester acceptance checklist exists, but tester sign-off has not been recorded in the repository. |
| 7 — Rollback | V1 UI reachable and V1 data intact for one full release cycle after cutover | **Met by design** — migration writes parallel canonical stores, activation is owner-specific and legacy-by-default, and V1 data/routes remain intact. This must still be exercised during the actual cutover release cycle. |

## Evidence boundaries

Automated tests can prove deterministic behaviour, invariants and regression ceilings. They do not by themselves prove real-device usability, screen-reader quality, production-data cleanliness or tester preference. Those remain release activities rather than being silently marked complete from CI alone.
