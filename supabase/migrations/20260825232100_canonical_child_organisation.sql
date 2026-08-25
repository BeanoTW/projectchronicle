-- The initial canonical_children check predates organisation support.
alter table public.canonical_children drop constraint if exists canonical_children_kind_check;
alter table public.canonical_children add constraint canonical_children_kind_check
  check (kind in ('clarification', 'media', 'history', 'person', 'relationship', 'organisation'));
