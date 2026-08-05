# Phase 6 — incremental production migration

Status: **first route migrated, behind a flag.**

## 1. Feature flags

`src/lib/featureFlags.ts` + `src/hooks/useFeatureFlag.ts`.

| Flag | Route | Default |
|---|---|---|
| `v2Entry` | `/incident/:id` | off (V1) |
| `v2Notebook` | `/timeline` | off (not built) |
| `v2Capture` | `/record` | off (not built) |
| `v2Dossier` | `/export` | off (not built) |

Precedence: URL `?ff=` > per-device localStorage override > `FLAG_DEFAULTS`.

- Roll a route forward for everyone: flip its value in `FLAG_DEFAULTS`.
- Roll back: flip it back. One configuration change, no code revert.
- Per-device trial: `?ff=v2Entry:1`, undo with `?ff=v2Entry:0` or `?ff=reset`.

## 2. Shared modules extracted

| Module | Purpose |
|---|---|
| `src/v2/shared/EntryView.tsx` | Source-agnostic V2 record view. No data access; all reads/writes via props. Used by the V2 candidate app **and** the production route. |
| `src/v2/styles.css` | Single styling source for both surfaces (scoped to `.proto-root`). |
| `src/lib/featureFlags.ts` | Migration flag registry shared by all routes. |

`src/v2/screens/Entry.tsx` is now a thin Dexie-backed adapter over `EntryView`
— the duplicated markup is gone.

## 3. First migrated route — `/incident/:id`

`src/pages/EntryScreenV2.tsx`, selected by `src/routes/RecordDetailRoute.tsx`.

Real production data only:

- reads: `useIncident`, `useFollowUpNotes`, `useEvidence`
- writes: `useCreateFollowUpNote` (clarification), `useUpdateIncident`
  (`excluded_from_rep` = dossier inclusion)
- no V2 preview Dexie database, no new tables, no schema change

Mapping applied: `raw_narrative` → sealed original wording,
`original_created_at ?? created_at` → sealed time, follow-up notes →
clarifications, `!excluded_from_rep` → in dossier.

## 4. Migration checks

- **Feature parity** — partial (see blockers). Flag default stays **off** until
  parity closes; V1 remains the served UI.
- **Tests** — existing suite unchanged and passing; typecheck clean.
- **Data loss** — none possible: append-only note writes plus one boolean field
  through existing hooks. No deletes, no migrations, no writes to media.
- **Rollback** — flag flip.

## 5. Dead code identified (delete at cutover, not before)

- `src/pages/IncidentDetailScreen.tsx` (739 lines) — once `v2Entry` defaults on.
- `src/components/chronicle/IncidentRecordCard.tsx`, `FollowUpDetails.tsx`,
  `EditHistorySheet.tsx` — only reachable from the V1 detail screen.
- `/prototype/*` redirect — removable 6 months after cutover.
- `src/v2/V2App.tsx` shell banner + "Reset preview data" — preview-only, drops
  out when the V2 candidate app stops being a separate surface.

Nothing has been deleted in this phase because the flag default is still V1.

## 6. Remaining blockers before `v2Entry` defaults on

1. **Record integrity surfaces** — edit history, integrity/attachment panels,
   lock/privacy shield masking exist only in the V1 detail screen.
2. **Attachments** — V2 evidence UI is Dexie-blob based; production uses
   Supabase storage. `EntryScreenV2` currently shows a read-only list and links
   to `/attachments`. Media parity is out of scope per phase brief.
3. **Sequences, split-record and summary actions** exposed on V1 detail.
4. **Design tokens** — V2 styling is still `.proto-root` scoped rather than the
   production token system; theming/dark-mode parity needs a port.
5. Notebook / Capture / Dossier routes have no production-data adapters yet.
