# Plan — Project Chronicle Product Report

## Goal
Produce a single, detailed Markdown report at `/mnt/documents/project-chronicle-report.md` written for an external AI assistant or technical reviewer who has never seen this codebase. The report is **descriptive only** — no code changes to the app itself.

## Output
- **File:** `/mnt/documents/project-chronicle-report.md`
- **Format:** Markdown, structured by the 11 sections you specified
- **Delivery:** `<lov-artifact>` tag at the end of the response so you can preview/download
- **Length target:** ~3,500–5,000 words. Specific, sectioned, with file/component references throughout
- **Voice:** Neutral and technical. Marks anything not directly evidenced in the codebase as "unclear" rather than guessing

## What I'll cover (with codebase evidence already gathered)

### 1. Product overview
- **Name:** Project Chronicle (PWA, manifest in `vite.config.ts`, brand mark in `HomeScreen.tsx` / `AuthHero.tsx`)
- **Purpose:** Personal, neutral record-keeping for incidents, daily working life, and workplace/legal-adjacent reference
- **Targets:** Individuals documenting workplace issues, recurring interpersonal events, or personal context for later reference
- **Not intended for:** legal advice, evidence verification, social/public sharing, real-time collaboration, role-based access

### 2. Core philosophy
Drawn from `summaryPipeline.ts`, `templateRenderer.ts`, `PrivacyContext.tsx`, `AttachmentIntegrityPanel.tsx`, project memory: deterministic outputs, immutable original narrative + append-only updates, neutral terminology ("Record" / "Attachments"), no AI interpretation in exports, identity preservation, "informative not empty" empty states.

### 3. Main user flows
Mapped from `App.tsx` route table and screen files:
- Welcome → Sign up / Login (email+password, email confirmation, password reset, OAuth callback route)
- Record (voice or text) → AI structuring → **Pre-Save Review** (`ReviewScreen.tsx`) → Save
- Daily Record variant via `record_type='daily_record'` and `interactions[]`
- Timeline (3 density scales), Calendar (month grid + day sheet), My Record (overview), Incident Detail
- Attachments library (global) + per-record rows
- Export (Structured Record live; Issue-Based Record live via builder; others "Coming soon" per `.lovable/plan.md`)
- Settings (lock, biometric, backup, privacy shield, delete account)
- Privacy Shield toggle + Attachment unlock dialog
- App Lock gate (`LockGate.tsx`) on cold start / focus return after timeout

### 4. Feature inventory
For each: name, location (file/component), what it does, user benefit, implementation details, known gaps. Includes:
- Voice recording + transcription (`VoiceRecorder.tsx` + `transcribe-audio` edge function)
- AI analysis (`analyse-incident`, `detect-multi-incident` — assistive only)
- Pre-Save Review layer (categories, subtypes, people, context_domain)
- Categories V4.3 (`src/lib/categories.ts`, 8 primary + scoped subtypes)
- Sequences (non-destructive grouping — `sequenceEngine.ts`)
- Edit history (append-only `edit_history` table + DB trigger)
- Follow-up notes (append-only `follow_up_notes`)
- Coherence detection, scoring, narrative engine (deterministic)
- Identity resolution + people aggregation
- Tutorial modal, Demo video, System status strip, Sync status pill
- Developer Mode (long-press signature)
- Conflict resolution UI (multi-device backup conflicts)

### 5. Record system
- `incidents` table doubles as both "incident" and "daily_record" via `record_type`
- Field-by-field: incident_date vs original_created_at vs last_modified_at vs version
- Append-only update behavior enforced by DB trigger `bump_last_modified_at` and `log_incident_edits`; `original_created_at` preserved server-side
- Daily records use `interactions` JSONB and `record_date`
- Categories/subtypes flow + `category_source: 'ai' | 'user'`
- Quotes (`exact_words`), impact_note, tags, witnesses
- Linked `evidence_files` and `follow_up_notes`

### 6. Attachment system
- Upload pipeline: SHA-256 computed in browser **before** upload (`lib/attachments/integrity.ts`), `capture_date` derived from `File.lastModified` with sanity bounds, `evidence_ref_number` auto-assigned per user via DB trigger
- `AttachmentIntegrityPanel.tsx`: SHA-256, capture/added, uploaded, linked record ID; "Integrity stamp available/unavailable" pill; explicit neutral copy ("not legal verification")
- Privacy Shield masking: `MaskedAttachmentThumb.tsx`, file bytes never enter DOM while gated
- PIN unlock for viewing while shield is on: `AttachmentRevealContext` + `AttachmentUnlockDialog` (reuses app-lock PIN, session-scoped reveal, dropped on lock/shield toggle)
- Viewer (`EvidencePreview.tsx`): `react-zoom-pan-pinch` with min=1, max=4, double-tap stepped zoom 1→2→3→4→reset, pan when zoomed, native pinch, header zoom buttons, audio + PDF + image + generic download fallback

### 7. Security and privacy
- **Local-first:** Dexie/IndexedDB is source of truth (`src/local/db.ts`, `useIncidents.ts` reads from local, sync engine pushes to Supabase)
- **App Lock:** PIN with PBKDF2-SHA256 250k iterations + 16-byte salt (`pinCrypto.ts`); per-user `localStorage` only, never synced. Failed-attempt cooldown doubles after 5 wrong (cap 15 min)
- **Biometric:** WebAuthn platform authenticator with `userVerification: 'required'` (`webauthn.ts`); credential id stored locally; treated as local presence check, no server attestation
- **Auto-lock:** visibilitychange listener; allowed timeouts 1m/5m/15m
- **Privacy Shield:** UI-only display filter (`PrivacyContext.tsx`). Stored data and exports **unaffected**. Masks names, locations, quotes, narrative, filenames; never masks dates/categories/counts
- **Attachment access while shielded:** PIN gate; reveal scoped to in-memory state, dropped on app lock or shield toggle
- **Cloud:** Supabase Auth + Postgres + Storage; RLS scoped to `auth.uid()` on every table; backup explicitly user-controlled (`BackupContext.tsx` + `syncEngine.ts` + `sync_upsert_incident` RPC for optimistic-concurrency conflict handling)
- **Account deletion:** dedicated `delete-account` edge function using service role

### 8. Export system
Reflects `.lovable/plan.md` and `ExportScreen.tsx`:
- **Structured Record** — primary card, generates via `summaryPipeline.ts` + `templateRenderer.ts` (locked 4-block structure: Cover, Index, Full Record, Closing)
- **Issue-Based Record** — available via `ExportBuilderModal` + `tribunalRenderer.ts`
- **Single Incident Report, Chronology, Attachment Index, Full Case Bundle** — listed but "Coming soon"
- Delivery (`deliverHtmlFile`): Web Share API → anchor download → window.open fallback
- Integrity statement embedded in template footer
- `generate-export` edge function exists as a server-side renderer alternative

### 9. Technical architecture
- **Framework:** React 18 + Vite 8 + TypeScript 5 + Tailwind 3 + shadcn/ui (Radix)
- **Routing:** `react-router-dom` v6, all routes in `App.tsx` with `ProtectedRoute` + `PublicRoute` + LockGate gating
- **State:** TanStack Query for evidence/notes; **Dexie + dexie-react-hooks `useLiveQuery`** for incidents (local-first)
- **Backend:** Supabase Auth, Postgres (tables: `incidents`, `evidence_files`, `follow_up_notes`, `edit_history`, `rights_guidance`), Storage bucket `evidence` (private), 7 edge functions (`analyse-incident`, `detect-multi-incident`, `summarise-patterns`, `generate-case-narrative`, `generate-export`, `transcribe-audio`, `delete-account`)
- **DB functions:** `sync_upsert_incident` (RPC for optimistic concurrency), `bump_last_modified_at`, `bump_incident_version`, `log_incident_edits`, `assign_evidence_ref_number`, `set_original_created_at`, `current_edit_source`
- **PWA:** `vite-plugin-pwa` + manifest; app-shell precache only; SPA navigation fallback; **no runtime caching of authenticated data**; service worker registration guarded against iframes/dev (`registerSW.ts`)
- **AI gateway:** Lovable AI gateway via `LOVABLE_API_KEY` (no user-provided keys)
- **Auth quirks handled:** zero-identities `signUp` response (already-exists), email_not_confirmed mapping, 800ms loading cap to keep UI snappy offline

### 10. Current status
- **Complete:** record creation (voice + text), review, timeline, calendar, my record overview, attachments with integrity stamps, privacy shield + attachment gate, app lock + biometric, structured record + issue-based exports, local-first persistence + cloud backup with conflict UI, PWA shell
- **Partial / placeholder:** Single Incident Report, Chronology, Attachment Index, Full Case Bundle exports; Insights/Flow are routed to `/calendar` or `/my-record` (see redirects in `App.tsx`)
- **Risks identified:** edge functions split between supabase-js v2.99 (older) and v2.103 (modern w/ ES256 JWT support) — comment in `analyse-incident` notes the legacy client could not verify ES256 tokens; `transcribe-audio`, `detect-multi-incident`, `generate-case-narrative`, `summarise-patterns` still on 2.99
- **Hardening needed:** rate limiting on edge functions; signed URL TTLs (1h hard-coded for previews); Privacy Shield is display-only — exports/storage are not shielded (correctly documented but worth flagging); WebAuthn assertion is not server-verified (acceptable for local-presence semantics, worth noting)
- **Testing gaps:** only 2 unit tests visible (`example.test.ts`, `summaryPipeline.test.ts`); Playwright fixture present but no visible suite

### 11. Recommended next priorities
Ordered by user-trust → export credibility → stability → real-world testing value:
1. Ship the four "Coming soon" export modes (Single Incident, Chronology, Attachment Index, Full Case Bundle) — credibility unlock
2. Surface attachment integrity in the export footer (data exists, only the renderer needs it)
3. Standardise edge functions on supabase-js 2.103 + ES256 verification (consistency + correctness)
4. Server-side PIN/biometric rate limiting and audit log (currently client-only)
5. Expand test coverage: review-layer, sync-engine conflict paths, integrity hashing, privacy mask functions
6. Add explicit "Privacy Shield does not affect exports" warning when generating exports while shield is on
7. Tighten signed-URL TTLs + add download audit notes
8. Document the local-first migration path (hydrate-once) for users switching devices

## Process
1. Write the Markdown report directly to `/mnt/documents/project-chronicle-report.md`
2. Verify line count and a sampled section
3. Emit a `<lov-artifact>` so you can open or download it
4. Summarise back what's in the file in chat (short)

## What I will not do
- Modify any source files
- Invent features (e.g. won't claim role-based sharing, encryption-at-rest beyond Supabase defaults, or e2e encryption)
- Mark "Coming soon" features as live