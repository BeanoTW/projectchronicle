# Phase 6D — Dossier / Reports migration

Status: implemented behind `v2Dossier` (default **off**). V1 `ExportScreen` remains the
default experience and is untouched.

## Route

| Route | Flag off | Flag on |
|---|---|---|
| `/export` | `src/pages/ExportScreen.tsx` (V1) | `src/pages/DossierScreenV2.tsx` (V2, production-backed) |

Switcher: `src/routes/ExportRoute.tsx`. Public URL is unchanged. Rollback is one flag flip
(`FLAG_DEFAULTS.v2Dossier`, `localStorage` override, or `?ff=v2Dossier:0`).

## Architecture

```text
DossierView (shared)  ──uses──▶ DossierConfigureView + DossierPreviewView (shared)
        │                              │
        └── DossierAdapter ────────────┘
              ├── preview adapter   → chronicle_prototype (Dexie)
              └── production adapter→ useIncidents / useAllFollowUpNotes / useEvidence
```

Shared modules (`src/v2/shared/dossierModel.ts`, `DossierView.tsx`,
`DossierConfigureView.tsx`, `DossierPreviewView.tsx`) import no Dexie, no Supabase and no
production hooks — enforced by tests.

## Inclusion mapping

Production stores exclusion; V2 stores inclusion:

```
in_dossier === !excluded_from_rep
setIncluded(id, X) → updateIncident({ id, excluded_from_rep: !X })
```

No second membership field exists. Scope filters (date, category, person) only narrow
visibility; they never write membership.

## Evidence

- Source: `evidence_files` rows joined to their record by `incident_id`.
- `role`: `original` when uploaded within 5 minutes of record creation, else `later`.
- `kind`: `voice` for `audio/*`, otherwise `attachment`.
- Blobs are fetched lazily during export via Supabase storage `download`; previews use
  short-lived signed URLs. Any file that cannot be retrieved degrades to a metadata-only
  reference rather than failing the export.
- Production has no per-file dossier exclusion (a V2-preview-only capability), so evidence
  inclusion follows its record plus the configuration toggles.

## V1 parity audit (`ExportScreen`)

| Capability | Status |
|---|---|
| Chronological export of records | Preserved |
| Date-range / category / person scope | Preserved |
| Per-record include/exclude via `excluded_from_rep` | Preserved (same field) |
| Follow-up notes in the document | Preserved (as clarifications, shown separately) |
| Attachment references and image embedding | Preserved |
| Word/PDF output | Replaced by the V2 A4 document engine (single model for preview, PDF, DOCX) |
| Template pickers (grievance / tribunal HTML templates) | **Still blocking** — not yet available in V2 |
| Summary pipeline / AI narrative sections | Deliberately retired in V2 (document is non-interpretive) |
| Export integrity footer, SHA-256 fingerprint, RFC 3161 timestamping, `export_timestamps` history | **Still blocking** — the canonical export-history mechanism is not yet wired to V2 exports. No second history system was created. |
| Share sheet / print | Print preserved; native share still V1-only |

## Tests

`src/test/dossierV2.test.ts` — 25 tests: adapter mapping, inclusion mapping, scope filters,
ordering, clarification inclusion, evidence inclusion, preview/export model consistency,
export file naming, empty dossier, 400-record dossier, flag independence, source isolation.

## Blockers before `v2Dossier` can default on

1. Export integrity + trusted-timestamp record (`export_timestamps`) must be applied to V2
   PDF/DOCX exports through the existing canonical mechanism.
2. Template-based exports (workplace grievance / tribunal) have no V2 equivalent.
3. Native share of the generated file (V1 `shareExportFile`).
4. Privacy Shield behaviour on the V2 dossier surface needs an audit.
