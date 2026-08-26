-- Canonical cloud authority must not be writable through ordinary table CRUD.
-- Authenticated clients may read their rows, but record/child mutations pass
-- through the compare-and-swap RPCs. Media objects are insert-once/read-only.

-- The RPCs use auth.uid() to bind every mutation to the caller. SECURITY
-- DEFINER is required after direct table write privileges are revoked; the
-- functions already pin search_path=public and explicitly constrain owner_id.
alter function public.sync_upsert_canonical_record(uuid, jsonb, integer, integer) security definer;
alter function public.sync_upsert_canonical_child(text, uuid, uuid, jsonb, integer) security definer;

revoke insert, update, delete on table public.canonical_records from anon, authenticated;
revoke insert, update, delete on table public.canonical_children from anon, authenticated;
grant select on table public.canonical_records to authenticated;
grant select on table public.canonical_children to authenticated;

-- RLS write policies are removed as defence in depth. SELECT remains
-- owner-scoped. The SECURITY DEFINER RPCs perform their own auth.uid() checks.
drop policy if exists "canonical_records_insert_own" on public.canonical_records;
drop policy if exists "canonical_records_update_own" on public.canonical_records;
drop policy if exists "canonical_records_delete_own" on public.canonical_records;
drop policy if exists "canonical_children_insert_own" on public.canonical_children;
drop policy if exists "canonical_children_update_own" on public.canonical_children;
drop policy if exists "canonical_children_delete_own" on public.canonical_children;

-- Normal clients may create an immutable media object and read it back for
-- integrity verification/restore. They may not overwrite or delete that object.
-- Account deletion uses the service-role edge function and is unaffected.
drop policy if exists "canonical_media_update_own" on storage.objects;
drop policy if exists "canonical_media_delete_own" on storage.objects;
