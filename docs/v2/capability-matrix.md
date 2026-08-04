# V1 → V2 capability matrix

Status values: **Complete**, **Partial**, **Missing**, **Retired** (deliberate).
"Simulated" means the V2 screen shows the concept but no real implementation
exists — never counted as parity.

| Capability | V1 route / component | V2 today | Status | Migration requirement | Risk |
|---|---|---|---|---|---|
| Authentication | `/login`, `/signup`, `AuthContext`, Supabase auth | None — V2 has no auth surface, no user scoping | **Missing** | Mount V2 inside the existing `AuthContext`; add `owner_id` to every V2 entity | High |
| Local data storage | Dexie `chronicle_local`, `src/local/db.ts` | Dexie `chronicle_prototype`, `src/v2/db.ts` (v2, single-user, no owner scoping) | **Partial** | Add `owner_id` index + per-account isolation; rename DB at cutover with an upgrade path | High |
| Cloud sync | `src/local/syncEngine.ts`, `sync_upsert_incident` RPC, version/conflict handling | None | **Missing** | Port the sync engine to V2 entities; media upload still undecided | High |
| Offline use | Local-first reads/writes, PWA SW | Local-first reads/writes; no SW registration difference (shares app shell) | **Complete** | Verify capture works signed-out | Low |
| Capture (text) | `/record`, `RecordScreen.tsx` — form-first with categories | `/v2/capture` — brain-dump first, seal, details later | **Complete** | None; behaviour is intentionally different | Low |
| Voice capture | `VoiceRecorder.tsx` + `transcribe-audio` function | `src/v2/media/VoiceCapture.tsx`, real MediaRecorder, stored locally, **no transcription** | **Partial** | Decide whether transcription returns; today V1 users lose transcripts if migrated as-is | High |
| Daily records | `record_type: 'daily'`, `src/types/dailyRecord.ts` | Not distinguished — every V2 entry is one shape | **Missing** | Add `kind: 'incident' \| 'daily'` (designed in `model/schema.ts`) and surface it in Capture/Notebook | Medium |
| Incident records | `incidents` table, `IncidentDetailScreen` | V2 entry + Entry screen | **Complete** | Field mapping only | Low |
| Categories | `src/lib/categories.ts` V4.3 taxonomy, subtypes, AI classification | Free-text single `category` string chosen in Review | **Partial** | Port the taxonomy as a real category table; V2 has no subtypes and no AI classification | Medium |
| People | Arrays on the incident + `identity-resolution` merging | Free-text `people[]` on the entry | **Partial** | Promote people to entities with normalisation/merge | Medium |
| Attachments | `evidence_files` + Supabase Storage `evidence` bucket, SHA-256, ref numbers | Local Blob storage in IndexedDB, size/count limits, no hash, no cloud | **Partial** | Content hashing + upload path before parity; existing cloud files must remain reachable | High |
| Clarifications / follow-ups | `follow_up_notes` with note types | Append-only clarifications, single type | **Partial** | Add note kinds (`follow_up`, `outcome`, `correction`) | Low |
| Record history | `edit_history` + triggers + `EditHistoryPanel` | Not implemented | **Missing** | `V2RecordEvent` designed; needs building | Medium |
| Search | Timeline search | Notebook search across text/title/people | **Complete** | None | Low |
| Calendar / date browsing | `/calendar`, `CalendarScreen.tsx` | `MonthView` inside Notebook | **Complete** | None | Low |
| Reporting / export | `/export`, `generate-export` function, HTML/tribunal/grievance templates, timestamping | Dossier: on-screen preview, PDF, DOCX, print | **Partial** | V2 has no RFC3161 timestamping and none of the V1 template variants | Medium |
| Export integrity timestamps | `export_timestamps`, `rfc3161-timestamp` function | Not implemented | **Missing** | Port or explicitly retire; affects trust claims | Medium |
| Insights / patterns | `/insights`, `useInsightsEngine`, `summarise-patterns` | Not implemented | **Retired** (proposed) | Confirm with user before removal | Medium |
| Support resources | `/support`, `rights_guidance` table | Not implemented | **Missing** | Reachable from V2 shell, or keep the V1 route alive | Low |
| Settings | `/settings` | Not implemented | **Missing** | Needs a V2 settings surface (backup, lock, theme, account) | High |
| Privacy controls | `PrivacyContext`, Privacy Shield masking, `LockContext` PIN/WebAuthn | Not implemented | **Missing** | Must exist before cutover — this is a core product promise | High |
| Account / data deletion | `delete-account` edge function | Not implemented | **Missing** | Must also clear the V2 local database | High |
| Import / export of own data | Export screens only | Dossier export only | **Partial** | Add a raw data export (JSON) for portability | Low |
| Existing user data migration | n/a | Designed, not built (`src/v2/model/migration.ts`) | **Missing** | See migration-strategy.md | High |
| Accessibility | shadcn/Radix primitives throughout | Hand-rolled controls; dialogs now accessible, focus + reduced motion added this phase | **Partial** | Full audit of FilterSheet, MonthView, Dossier config | Medium |
| Error recovery | Toasts, sync retry, conflict badges | Inline errors; seal now survives media failure; no retry queue | **Partial** | Retry paths for media and export | Medium |
| Agent/MCP integration | `supabase/functions/mcp`, `src/lib/mcp/**` | Not applicable (reads production data) | **Complete** (shared) | Point tools at V2 entities at cutover | Low |

## Headline gaps blocking cutover

1. No authentication, ownership scoping or sync in V2.
2. No privacy controls (Privacy Shield, app lock) — a stated product promise.
3. No settings or account deletion surface.
4. No migration of existing user data.
5. Attachments are local-only; V1 users have files in cloud storage.
6. No record history, and voice transcripts from V1 have no V2 home.
