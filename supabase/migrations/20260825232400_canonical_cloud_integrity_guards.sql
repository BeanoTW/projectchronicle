-- Mirror Chronicle's local immutability boundary in the cloud authority.
-- A valid revision is not permission to rewrite sealed original content.

create or replace function public.sync_upsert_canonical_record(
  row_id uuid,
  row_payload jsonb,
  row_local_revision integer,
  expected_remote_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_row public.canonical_records%rowtype;
  current_remote_revision integer;
  next_remote_revision integer;
  sync_at timestamptz := now();
  stored_payload jsonb;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if row_payload is null then raise exception 'payload required'; end if;
  if row_local_revision < 0 then raise exception 'invalid local revision'; end if;
  if row_payload ->> 'id' is distinct from row_id::text then raise exception 'canonical record id mismatch'; end if;
  if row_payload ->> 'owner_id' is distinct from uid::text then raise exception 'canonical record owner mismatch'; end if;
  if row_payload -> 'original' is null then raise exception 'canonical original content required'; end if;

  select * into current_row
  from public.canonical_records
  where id = row_id and owner_id = uid
  for update;

  if not found then
    if expected_remote_revision is not null then
      return jsonb_build_object('status', 'conflict', 'remote_revision', null);
    end if;
    next_remote_revision := 1;
    stored_payload := jsonb_set(row_payload, '{sync}', jsonb_build_object(
      'remote_version', next_remote_revision,
      'local_revision', row_local_revision,
      'state', jsonb_build_object('state', 'synced', 'at', sync_at, 'remote_version', next_remote_revision),
      'last_attempt_at', sync_at
    ), true);
    insert into public.canonical_records(id, owner_id, payload, local_revision)
    values (row_id, uid, stored_payload, row_local_revision);
    return jsonb_build_object('status', 'ok', 'remote_revision', next_remote_revision);
  end if;

  current_remote_revision := coalesce((current_row.payload #>> '{sync,remote_version}')::integer, 1);

  -- Stable identity and sealed source fields can never change after first cloud
  -- commit, regardless of the revision supplied by the client.
  if current_row.payload -> 'original' is distinct from row_payload -> 'original'
     or current_row.payload ->> 'id' is distinct from row_payload ->> 'id'
     or current_row.payload ->> 'owner_id' is distinct from row_payload ->> 'owner_id'
     or current_row.payload ->> 'kind' is distinct from row_payload ->> 'kind'
     or current_row.payload ->> 'schema_version' is distinct from row_payload ->> 'schema_version'
     or current_row.payload ->> 'captured_at' is distinct from row_payload ->> 'captured_at'
     or current_row.payload ->> 'sealed_at' is distinct from row_payload ->> 'sealed_at'
     or current_row.payload ->> 'created_at' is distinct from row_payload ->> 'created_at' then
    raise exception 'sealed canonical record fields are immutable';
  end if;

  if expected_remote_revision is null then
    if current_row.local_revision = row_local_revision
       and (current_row.payload - 'sync') = (row_payload - 'sync') then
      return jsonb_build_object('status', 'ok', 'remote_revision', current_remote_revision);
    end if;
    return jsonb_build_object('status', 'conflict', 'remote_revision', current_remote_revision, 'payload', current_row.payload);
  end if;

  if expected_remote_revision <> current_remote_revision then
    return jsonb_build_object('status', 'conflict', 'remote_revision', current_remote_revision, 'payload', current_row.payload);
  end if;

  next_remote_revision := expected_remote_revision + 1;
  stored_payload := jsonb_set(row_payload, '{sync}', jsonb_build_object(
    'remote_version', next_remote_revision,
    'local_revision', row_local_revision,
    'state', jsonb_build_object('state', 'synced', 'at', sync_at, 'remote_version', next_remote_revision),
    'last_attempt_at', sync_at
  ), true);
  update public.canonical_records
  set payload = stored_payload,
      local_revision = row_local_revision,
      updated_at = sync_at
  where id = row_id and owner_id = uid;

  return jsonb_build_object('status', 'ok', 'remote_revision', next_remote_revision);
end;
$$;

create or replace function public.sync_upsert_canonical_child(
  row_kind text,
  row_id uuid,
  row_record_id uuid,
  row_payload jsonb,
  expected_remote_revision integer default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_row public.canonical_children%rowtype;
begin
  if uid is null then raise exception 'authentication required'; end if;
  if row_kind not in ('clarification', 'media', 'history', 'person', 'relationship', 'organisation') then raise exception 'invalid canonical child kind'; end if;
  if row_payload is null then raise exception 'payload required'; end if;
  if row_payload ->> 'id' is distinct from row_id::text then raise exception 'canonical child id mismatch'; end if;
  if row_payload ->> 'owner_id' is distinct from uid::text then raise exception 'canonical child owner mismatch'; end if;

  if row_kind in ('person', 'organisation') then
    if row_record_id is not null then raise exception 'owner entity cannot be attached as a child row'; end if;
    if row_payload ? 'record_id' and row_payload ->> 'record_id' is not null then raise exception 'owner entity payload cannot contain record id'; end if;
  else
    if row_record_id is null then raise exception 'canonical child record id required'; end if;
    if row_payload ->> 'record_id' is distinct from row_record_id::text then raise exception 'canonical child record mismatch'; end if;
    if not exists (select 1 from public.canonical_records where id = row_record_id and owner_id = uid) then raise exception 'canonical parent record not found'; end if;
  end if;

  select * into current_row
  from public.canonical_children
  where kind = row_kind and id = row_id and owner_id = uid
  for update;

  if not found then
    if expected_remote_revision is not null then return jsonb_build_object('status', 'conflict', 'remote_revision', null); end if;
    insert into public.canonical_children(kind, id, owner_id, record_id, payload, remote_revision)
    values (row_kind, row_id, uid, row_record_id, row_payload, 1);
    return jsonb_build_object('status', 'ok', 'remote_revision', 1);
  end if;

  -- Current canonical children are append-only/create-once objects. A retry of
  -- the exact payload is idempotent; any different payload is a conflict. This
  -- can be deliberately widened later for a specifically versioned child type.
  if current_row.record_id is distinct from row_record_id or current_row.payload is distinct from row_payload then
    return jsonb_build_object('status', 'conflict', 'remote_revision', current_row.remote_revision, 'payload', current_row.payload);
  end if;

  if expected_remote_revision is not null and expected_remote_revision <> current_row.remote_revision then
    return jsonb_build_object('status', 'conflict', 'remote_revision', current_row.remote_revision, 'payload', current_row.payload);
  end if;

  return jsonb_build_object('status', 'ok', 'remote_revision', current_row.remote_revision);
end;
$$;

revoke all on function public.sync_upsert_canonical_record(uuid, jsonb, integer, integer) from public;
grant execute on function public.sync_upsert_canonical_record(uuid, jsonb, integer, integer) to authenticated;
revoke all on function public.sync_upsert_canonical_child(text, uuid, uuid, jsonb, integer) from public;
grant execute on function public.sync_upsert_canonical_child(text, uuid, uuid, jsonb, integer) to authenticated;
