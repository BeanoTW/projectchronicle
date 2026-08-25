-- Canonical cloud authority foundation.
--
-- These tables mirror the audited canonical local model without changing the
-- legacy incidents/follow_up_notes authority. RLS binds every row to auth.uid().
-- Payloads are stored as JSONB so the canonical schema can evolve under its
-- existing application-level version contract without lossy SQL projection.

create table if not exists public.canonical_records (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  local_revision integer not null default 0 check (local_revision >= 0),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);

create table if not exists public.canonical_children (
  kind text not null check (kind in ('clarification', 'media', 'history', 'person', 'relationship')),
  id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id),
  unique (owner_id, kind, id)
);

create index if not exists canonical_records_owner_updated_idx
  on public.canonical_records(owner_id, updated_at desc);
create index if not exists canonical_children_owner_kind_idx
  on public.canonical_children(owner_id, kind);
create index if not exists canonical_children_record_idx
  on public.canonical_children(owner_id, record_id) where record_id is not null;

alter table public.canonical_records enable row level security;
alter table public.canonical_children enable row level security;

create policy "canonical_records_select_own" on public.canonical_records
  for select using (auth.uid() = owner_id);
create policy "canonical_records_insert_own" on public.canonical_records
  for insert with check (auth.uid() = owner_id);
create policy "canonical_records_update_own" on public.canonical_records
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "canonical_records_delete_own" on public.canonical_records
  for delete using (auth.uid() = owner_id);

create policy "canonical_children_select_own" on public.canonical_children
  for select using (auth.uid() = owner_id);
create policy "canonical_children_insert_own" on public.canonical_children
  for insert with check (auth.uid() = owner_id);
create policy "canonical_children_update_own" on public.canonical_children
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "canonical_children_delete_own" on public.canonical_children
  for delete using (auth.uid() = owner_id);

-- Conflict-aware canonical record upsert. A client may create a row only when it
-- has never observed a remote revision (expected_remote_revision is null). Once
-- a row exists, the exact observed revision is required before replacement.
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
  next_remote_revision integer;
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
    insert into public.canonical_records(id, owner_id, payload, local_revision)
    values (row_id, uid, row_payload, row_local_revision);
    return jsonb_build_object('status', 'ok', 'remote_revision', 1);
  end if;

  if expected_remote_revision is null or expected_remote_revision <> coalesce((current_row.payload #>> '{sync,remote_version}')::integer, 1) then
    return jsonb_build_object(
      'status', 'conflict',
      'remote_revision', coalesce((current_row.payload #>> '{sync,remote_version}')::integer, 1),
      'payload', current_row.payload
    );
  end if;

  next_remote_revision := expected_remote_revision + 1;
  update public.canonical_records
  set payload = jsonb_set(row_payload, '{sync,remote_version}', to_jsonb(next_remote_revision), true),
      local_revision = row_local_revision,
      updated_at = now()
  where id = row_id and owner_id = uid;

  return jsonb_build_object('status', 'ok', 'remote_revision', next_remote_revision);
end;
$$;

revoke all on function public.sync_upsert_canonical_record(uuid, jsonb, integer, integer) from public;
grant execute on function public.sync_upsert_canonical_record(uuid, jsonb, integer, integer) to authenticated;
