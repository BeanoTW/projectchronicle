# Phase 6C — Capture migration (`v2Capture`)

Status: **shipped behind a flag, default off.** V1 `RecordScreen` remains the default capture experience.

## Routes

| Path | Flag off | Flag on |
| --- | --- | --- |
| `/record` | `RecordScreen` (V1) | `CaptureScreenV2` (production V2 capture) |
| `/record/details/:id` | redirect to `/incident/:id` | `CaptureDetailsScreenV2` (optional review) |
| `/incident/:id` | unchanged (`v2Entry` decides V1/V2) | unchanged |

Switching happens in `src/routes/RecordRoute.tsx` and `src/routes/CaptureDetailsRoute.tsx`.
Rollback is one configuration change: `FLAG_DEFAULTS.v2Capture` or `?ff=v2Capture:0`.

## Architecture

```text
CaptureView / ReviewView      (shared, source-agnostic — no Dexie, Supabase or hooks)
        |                     src/v2/shared/CaptureView.tsx, ReviewView.tsx
        |  CaptureAdapter     src/v2/shared/captureModel.ts
   +----+-----------------------------+
   |                                  |
previewCaptureAdapter        productionCaptureAdapter
 (chronicle_prototype)        (useCreateIncident / useUploadEvidence / useUpdateIncident)
```

Pure media helpers were split out of `src/v2/media/media.ts` into `mediaCore.ts` so the shared
views never pull in the preview database. `media.ts` re-exports them for existing callers.

## Production support

- **Written record** — `useCreateIncident` (local-first Dexie write, optional cloud sync).
- **Voice record** — `useUploadEvidence`, the same production media path V1 capture uses.
- **Attachments** — `useUploadEvidence` with description, hash and capture-date metadata.
- **Review details** — `useUpdateIncident` (category, context domain, people, event date/time).

At least text or a completed voice record is required. Attachments alone cannot create a record.

## Transaction safety

- The client submission id **is** the record id, so a repeat write is an overwrite of the same
  row, never a duplicate.
- The Seal button is disabled for the duration of a submission and a ref guard blocks
  double-taps ahead of React state.
- The record is created first, on its own. Media is saved only after the canonical record exists.
- Media failures are reported per item, with a Retry action for the failed subset only.
- The draft is cleared only after the record definitely exists; a failed create keeps the draft
  and re-enables Seal.
- Success is never reported before `createRecord` resolves.

## Draft recovery

`sessionStorage` key `chronicle.capture.draft:<userId>` (preview uses `proto.capture.draft`), so
drafts never cross accounts on a shared device. `beforeunload` warns while a capture is dirty, and
an in-app confirm guards leaving with a live recording.

## Accessibility

Labelled recorder controls, `role="alert"` failure messages, focus moved to the "Record sealed"
heading after sealing, keyboard-accessible dialogs (`src/v2/components/Dialog.tsx`), and no fixed
overlay above the Seal or review actions.

## Blockers before `v2Capture` can default on

1. **Voice transcription** — V1 transcribes voice notes via `transcribe-audio` and stores
   provenance fields. V2 capture stores the audio but no transcript yet.
2. **Offline media** — evidence uploads require connectivity; failures are surfaced with retry but
   are not queued for background upload.
3. **AI structuring / pre-save review** — V1's `/review` extraction step (category, people,
   severity suggestions) has no V2 equivalent; V2 review is manual and optional.
4. **Daily records and record types** — V1 capture can create `daily_record` entries; V2 capture
   creates `incident` only.
5. **Privacy Shield masking** in the sealed confirmation view has not been audited.
