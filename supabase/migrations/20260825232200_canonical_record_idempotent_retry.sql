-- If the server committed a new canonical record but the client crashed before
-- persisting remote_version=1 locally, the retry still has expected=null.
-- Treat an exact canonical-content + local-revision match as idempotent instead
-- of manufacturing a conflict. Transport-only sync metadata is ignored.
create or replace function public.sync_upsert_canonical_record(
  row_id uuid,
  row_payload jsonb,
  row_local_revision integer,
  expected_remote_revision integer default null
) returns jsonb
language plpgsql
security invoker
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

revoke all on function public.sync_upsert_canonical_record(uuid, jsonb, integer, integer) from public;
grant execute on function public.sync_upsert_canonical_record(uuid, jsonb, integer, integer) to authenticated;
