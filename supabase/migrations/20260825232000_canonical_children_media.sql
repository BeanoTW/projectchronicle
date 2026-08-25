-- Complete the canonical cloud backup substrate for child rows and media bytes.

alter table public.canonical_children
  add column if not exists remote_revision integer not null default 1 check (remote_revision >= 1);

create or replace function public.sync_upsert_canonical_child(
  row_kind text,
  row_id uuid,
  row_record_id uuid,
  row_payload jsonb,
  expected_remote_revision integer default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_row public.canonical_children%rowtype;
  next_remote_revision integer;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if row_kind not in ('clarification', 'media', 'history', 'person', 'relationship', 'organisation') then
    raise exception 'invalid canonical child kind';
  end if;
  if row_payload is null then raise exception 'payload required'; end if;

  select * into current_row
  from public.canonical_children
  where kind = row_kind and id = row_id and owner_id = uid
  for update;

  if not found then
    if expected_remote_revision is not null then
      return jsonb_build_object('status', 'conflict', 'remote_revision', null);
    end if;
    insert into public.canonical_children(kind, id, owner_id, record_id, payload, remote_revision)
    values (row_kind, row_id, uid, row_record_id, row_payload, 1);
    return jsonb_build_object('status', 'ok', 'remote_revision', 1);
  end if;

  if expected_remote_revision is null then
    if current_row.payload = row_payload then
      return jsonb_build_object('status', 'ok', 'remote_revision', current_row.remote_revision);
    end if;
    return jsonb_build_object('status', 'conflict', 'remote_revision', current_row.remote_revision, 'payload', current_row.payload);
  end if;

  if expected_remote_revision <> current_row.remote_revision then
    return jsonb_build_object('status', 'conflict', 'remote_revision', current_row.remote_revision, 'payload', current_row.payload);
  end if;

  next_remote_revision := current_row.remote_revision + 1;
  update public.canonical_children
  set payload = row_payload, record_id = row_record_id, remote_revision = next_remote_revision, updated_at = now()
  where kind = row_kind and id = row_id and owner_id = uid;

  return jsonb_build_object('status', 'ok', 'remote_revision', next_remote_revision);
end;
$$;

revoke all on function public.sync_upsert_canonical_child(text, uuid, uuid, jsonb, integer) from public;
grant execute on function public.sync_upsert_canonical_child(text, uuid, uuid, jsonb, integer) to authenticated;

-- Media is private. Object names are always: <owner>/<record>/<media-id>.
insert into storage.buckets (id, name, public, file_size_limit)
values ('canonical-media', 'canonical-media', false, 52428800)
on conflict (id) do update set public = false;

drop policy if exists "canonical_media_select_own" on storage.objects;
create policy "canonical_media_select_own" on storage.objects for select to authenticated
using (bucket_id = 'canonical-media' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "canonical_media_insert_own" on storage.objects;
create policy "canonical_media_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'canonical-media' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "canonical_media_update_own" on storage.objects;
create policy "canonical_media_update_own" on storage.objects for update to authenticated
using (bucket_id = 'canonical-media' and split_part(name, '/', 1) = auth.uid()::text)
with check (bucket_id = 'canonical-media' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists "canonical_media_delete_own" on storage.objects;
create policy "canonical_media_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'canonical-media' and split_part(name, '/', 1) = auth.uid()::text);
