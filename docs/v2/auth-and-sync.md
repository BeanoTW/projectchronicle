# V2 authentication and sync plan

Design only. V2 currently imports no Supabase client and has no auth surface.

## Route protection

| Route | Auth | Rationale |
|---|---|---|
| `/v2/capture` | Not required | Capture must never be blocked. A record can be sealed signed out and offline. |
| `/v2/notebook`, `/v2/entry/:id`, `/v2/review/:id` | Not required for local records | Local store is device-scoped and app-lock protected. |
| `/v2/dossier` and exports | Not required | Export works entirely locally. |
| Sync, restore on a new device, account deletion | Required | Anything touching the server needs a session. |

At cutover, V2 mounts inside the existing `AuthContext`. Records sealed while
signed out are written with `owner_id: null` and claimed by the first account
that signs in on that device — with an explicit prompt, never silently.

## When records sync

Backup is opt-in and off by default (unchanged from V1). When on:

1. Sealing a record enqueues it (`sync.state = 'queued'`).
2. The engine drains the queue on: seal, app foreground, network regained, and a
   30s backoff timer.
3. Each record upserts via a server function taking `expected_remote_version`.
4. Success sets `synced` with the new `remote_version`.

Clarifications and media metadata sync as their own append-only rows and never
force a re-upload of the parent record.

## Conflicts

- Server rejects when `expected_remote_version` does not match.
- The local record moves to `sync.state = 'conflict'` and is **kept**. The
  remote copy is fetched and stored beside it.
- The user chooses which version wins. Neither is deleted; the loser is retained
  as a conflict copy until dismissed.
- `original` content can never conflict: it is immutable, so conflicts are
  always about `details` or membership.

## Media upload

Not wired in this phase. The existing `evidence` bucket is private with
owner-scoped policies, so the infrastructure is safe, but V2 media has no
`owner_id` yet and no hash. Sequence before enabling:

1. Add `owner_id` + `content_hash` to `V2Media`.
2. Upload to `evidence/{owner_id}/{media_id}` with `upsert: false`.
3. Move `storage` from `local` to `local_and_remote` only after a confirmed
   response; a failed upload is a retryable state, never data loss.
4. Cap concurrency at 2 and retry with exponential backoff, 5 attempts.

## Retry

- Records: exponential backoff (2s → 5m), unlimited, surfaced as a queue count.
- Media: 5 attempts, then a manual "Retry upload" action on the evidence row.
- Exports: never retried automatically; the user re-runs them.

## Sign-out

- Sign-out does **not** delete local records.
- Records already backed up remain locally readable; the sync queue is paused.
- If the user chooses "sign out and remove local data", the V2 database is
  cleared after an explicit confirm that names how many records are affected.

## Local storage cleared

- Records backed up are restored on next sign-in via a hydration pass
  equivalent to `src/local/hydration.ts`.
- Records never backed up are gone. This is stated plainly in Capture and in
  the backup setting copy — no false reassurance.

## Account deletion

- Server-side deletion (existing `delete-account` function) removes remote rows
  and storage objects.
- The client then clears the V2 local database on that device.
- Other devices clear their local copy on next sign-in when the account no
  longer resolves.
- Deleting an account is distinct from deleting a record
  (`lifecycle.deleted_by_user`) and from excluding it from a dossier.
