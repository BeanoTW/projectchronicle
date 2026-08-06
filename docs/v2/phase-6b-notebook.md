# Phase 6B — Notebook / Timeline migration

Status: **`/timeline` migrated behind `v2Notebook`, default off (V1 served).**

## Route

`/timeline` → `src/routes/NotebookRoute.tsx`
- flag off → `TimelineScreen` (V1)
- flag on  → `NotebookScreenV2` (production-backed V2 Notebook)

Records always open at `/incident/:id`, which independently resolves V1 or V2
Entry via `v2Entry`. The two flags are not coupled.

## Shared modules

| Module | Purpose |
|---|---|
| `src/v2/shared/notebookModel.ts` | `NotebookRecord` view model + pure search/filter/month helpers |
| `src/v2/shared/NotebookView.tsx` | Source-agnostic Notebook UI (list, month, filters, chips, loading/empty/error) |
| `src/v2/shared/productionNotebookAdapter.ts` | Production normalisation (pure, unit-tested) |
| `src/v2/components/MonthView.tsx` | Now consumes `NotebookRecord`, shared by both surfaces |
| `src/v2/components/FilterSheet.tsx` | Evidence sections now optional per source |

`src/v2/screens/Notebook.tsx` is a thin Dexie adapter; `src/pages/NotebookScreenV2.tsx`
is the thin production adapter. No duplicated list markup.

## Production hooks used (read-only)

`useIncidents`, `useAllFollowUpNotes`, `useEvidence`. No writes, no Supabase calls
from the Notebook, no preview Dexie database.

## Filters supported on production data

| Filter | Source | Notes |
|---|---|---|
| Search | narrative, title, category, subtype, location, context, tags, people | |
| Category | real record categories | |
| People | real `people_involved` | |
| Date range | `record_date` (daily) else `incident_date` | canonical event date |
| Dossier | `excluded_from_rep` | read-only |
| Clarifications | follow-up notes | |
| Has voice | `record_method = 'voice'` | |
| Has attachments | `evidence_files` | shown only once the evidence query resolves |
| Attachment type | hidden in production | per-file typing not reliable offline |

## V1 parity audit

| V1 capability | Status |
|---|---|
| Reverse-chronological list | Preserved |
| Search | Preserved (wider field coverage) |
| Category filter | Preserved |
| Calendar / month view | Preserved (counts, day drill-in, cross-year nav) |
| Record type (incident vs daily) | Preserved as a chip; **filter still missing** |
| People filter | Replaced — new in V2, absent in V1 |
| Date range filter | Replaced — new in V2 |
| Dossier + clarification filters | Replaced — new in V2 |
| Detail / compact / overview density modes | **Still blocking** — V2 has one density |
| Attachments library panel on Timeline | **Still blocking** — reachable at `/attachments` only |
| Sequence grouping + manual sequence creation | **Still blocking** |
| Summary builder modal launch | **Still blocking** |
| Bulk selection for sequences | Deliberately retired for now (write action, out of scope for a read-only Notebook) |
| Privacy Shield masking of previews | **Still blocking** — V2 list renders wording unmasked |
| Category tint/border colour language | Deliberately retired (V2 uses chips) |
| Support links from Timeline | Deliberately retired (available from Support nav) |

## Blockers before `v2Notebook` defaults on

1. Privacy Shield masking in the V2 list/month previews.
2. Density modes (detail/compact/overview) or an accepted decision to retire them.
3. Record-type filter (incident vs daily record).
4. Sequences and summary-builder entry points.
5. Design-token port — V2 is still `.proto-root` scoped, so theming/dark mode differs.

## Checks

- Typecheck clean.
- Vitest: 24 passed / 20 skipped, including 13 new Notebook tests.
- Production build succeeds.
- Rollback = flip `v2Notebook` in `FLAG_DEFAULTS` (or `?ff=v2Notebook:0`).
