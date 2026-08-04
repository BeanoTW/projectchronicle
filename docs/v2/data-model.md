# V2 production data model

TypeScript source of truth: `src/v2/model/schema.ts` (design only — not wired
to the running preview or to production).

## Principles

1. **Original vs later.** `V2Record.original` holds the sealed wording, its
   source and the media present at seal. It is written once and never updated.
   Everything correctable lives in `details`, clarifications or media rows.
2. **Stable identity.** `V2Record.id` is a UUID reused from the V1 incident id
   where one exists, so a record keeps its identity across local storage, the
   server and any export already shared.
3. **Append-oriented.** Clarifications, media and history are inserts only.
   Nothing rewrites an earlier row.
4. **Separate concepts, not one boolean.**
   - `lifecycle`: `sealed` / `archived` / `deleted_by_user`
   - `dossier`: `not_included` / `included` / `excluded`
   - media `inclusion`: `included` / `excluded_from_dossier`
   - a *correction* is a clarification with `kind: 'correction'`, never an edit
5. **No naked flags.** Every state above is a discriminated union carrying its
   own timestamp and optional reason.

## Entities

| Entity | Purpose | Mutability |
|---|---|---|
| `V2Record` | The record itself | `details`, `lifecycle`, `dossier`, `sync` mutable; `original` immutable |
| `OriginalContent` | Sealed wording + source + original media ids | Immutable |
| `OrganisationalDetails` | Title, category, people, location, event date/time | Mutable, revision-counted |
| `V2Clarification` | Clarification / follow-up / outcome / correction | Insert only |
| `V2Media` | Voice records and attachments, with role and inclusion state | Metadata mutable, bytes immutable |
| `V2MediaEvent` | Audit trail per media item | Insert only |
| `V2Person` | Owner-scoped person with normalised name and soft merge | Mutable, non-destructive merge |
| `V2Category` | System or user category, retirable | Retire, never delete |
| `V2DossierPreferences` | Single dossier configuration per owner | Mutable |
| `V2ExportRun` | Export history with a snapshot of what was included | Insert + finalise |
| `V2RecordEvent` | Record history | Insert only |
| `SyncMetadata` | Embedded on every syncable entity | Mutable |

## Authority

| Data | Authoritative | Notes |
|---|---|---|
| Sealed record + wording | Local at creation, then remote after first sync | A record exists offline and signed out |
| `details`, clarifications | Last-writer-wins per field, guarded by `remote_version` | Conflicts surface, never silently merge |
| Media bytes | Local until an upload is confirmed | `MediaStorage` records the transition |
| System categories | Remote | Shipped with the app |
| User categories, dossier preferences | Local, synced best-effort | Loss is cosmetic |
| Export history | Local | Not required on other devices |

## Versioning and migration

- `V2_SCHEMA_VERSION` is stamped on every record (`schema_version`).
- Local schema changes go through Dexie `version(n).upgrade()`; upgrades must be
  additive and must never drop a table containing user blobs.
- Remote schema changes go through Supabase migrations with GRANTs and RLS in
  the same migration.
- Reading a record with a **higher** `schema_version` than the app understands
  is a hard read-only state, not a best-effort parse.
- Every upgrade writes a `V2RecordEvent` only when it changes user-visible data.
