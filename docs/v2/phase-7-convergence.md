# Phase 7 — V2 convergence and default-on assessment

Status date: this phase. Scope: no new product surfaces; convergence only.

## 1. Full V2 mode

`v2All` is a convenience override in `src/lib/featureFlags.ts`. Precedence:

```text
individual flag override  >  v2All override  >  FLAG_DEFAULTS
```

- URL: `?ff=v2All:1`, `?ff=v2All:1,v2Dossier:0`, `?ff=reset`
- Developer Mode: "V2 routes" switchboard (`DevV2FlagsPanel`), with a reset
- Independence is preserved and covered by tests in `src/test/releaseV2.test.ts`

The full journey (Capture → Review → Notebook → Entry → Dossier → export) runs
entirely on production data. Tests assert that no production V2 screen imports
`@/v2/db` and that no shared view imports Supabase or Dexie.

## 2. Blocker triage

| Item | Class | Outcome |
|---|---|---|
| Privacy Shield parity | A | Fixed — masking in Notebook, Entry, attachments; dossier preview withheld on screen |
| Daily records | A | Fixed — capture can create daily records; type shown, filterable, openable |
| Record history / integrity | A | Fixed — plain-language history on the V2 record view |
| Offline behaviour | A | Fixed — offline banner before sealing, save-location status after sealing, media retry |
| Export timestamp (RFC3161) | B | V1 route retains it; V2 dossier ships without it |
| Native share sheet | B | Download and print only in V2 for now |
| V1 template exports (grievance/tribunal HTML) | B | Remain on V1 surfaces |
| Voice transcription | B | Audio is stored and playable; automatic transcription stays a V1 feature |
| V1 AI review / summary pipeline | C | Retired from the V2 journey by design — V2 preserves original wording and does not rewrite |
| Density modes (3-scale) | C | Retired — replaced by list/month views |
| Sequences | C | Retired — clarifications and chronology cover the need |

## 3. Category-A fixes shipped

- **Privacy Shield**: display-only masking wired into `NotebookScreenV2`,
  `EntryScreenV2` (narrative, clarifications, people, location, attachment
  names) and `DossierScreenV2` (preview withheld with an explanation).
  Search still matches unmasked wording, so shielded users can find records.
  Exports and stored data are never altered — asserted by test.
- **Record types**: `CaptureSealInput.recordType`, a capture toggle, correct
  `record_type`/`record_date` writes, a record-type filter and an explicit
  "Record type" detail row.
- **Record history**: `recordHistoryModel.ts` maps `edit_history` into neutral
  lines that never print the changed values, plus a clear statement of whether
  the original wording has changed.
- **Offline**: online/offline listeners in `CaptureView`, pre-seal warning,
  post-seal save-location status, existing per-item media retry.

## 4. Design and navigation convergence

- "Prototype" wording removed from production-visible V2 code and styles.
- In full V2 the navigation reads Notebook / Capture, on both the bottom nav and
  the desktop side nav. Routes are unchanged, so rollback needs no link changes.

## 5. Default-on decision — NOT READY (defaults stay off)

Category-A blockers are closed, but two release gates from
`docs/v2/release-gates.md` remain open and are not code-only:

- **Gate 2 (data safety)**: the migration dry run has still not been executed
  against a full production snapshot.
- **Gate 5/6 (performance and user acceptance)**: not yet measured at 5,000
  records, and the tester group has not compared V2 against V1.

Recommendation: run full V2 mode with the tester group, complete the dry run and
the scale measurement, then flip `FLAG_DEFAULTS` in a single change.
