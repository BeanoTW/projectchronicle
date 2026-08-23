alter table public.evidence_files
  add column if not exists display_name text;

alter table public.evidence_files
  drop constraint if exists evidence_files_display_name_length;

alter table public.evidence_files
  add constraint evidence_files_display_name_length
  check (
    display_name is null
    or (
      char_length(btrim(display_name)) between 1 and 120
      and display_name = btrim(display_name)
    )
  );

comment on column public.evidence_files.display_name is
  'User-managed organisational label. The original file_name and stored evidence object remain unchanged.';
