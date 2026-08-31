import { z } from 'zod';

const id = z.string().min(1);
const iso = z.string().datetime({ offset: true });

export const RemoteClarificationBodySchema = z.object({
  id,
  record_id: id,
  owner_id: id,
  kind: z.enum(['clarification', 'follow_up', 'outcome', 'correction']),
  text: z.string(),
  created_at: iso,
  corrects_field: z.enum([
    'title', 'category_id', 'context', 'person_ids', 'location',
    'event_date', 'event_time', 'revision_count', 'original.text',
  ]).optional(),
}).strict();

export const RemoteRecordEventSchema = z.object({
  id,
  record_id: id,
  owner_id: id,
  at: iso,
  action: z.enum([
    'sealed', 'input_helper_accepted', 'details_updated', 'clarification_added',
    'media_added', 'media_excluded', 'media_included', 'dossier_included',
    'dossier_excluded', 'archived', 'restored', 'migrated_from_v1',
  ]),
  field: z.string().nullable(),
  from_value: z.string().nullable(),
  to_value: z.string().nullable(),
  actor: z.enum(['user', 'system', 'migration']),
}).strict();

export const RemotePersonSchema = z.object({
  id,
  owner_id: id,
  display_name: z.string(),
  normalised_name: z.string(),
  role_note: z.string().nullable(),
  created_at: iso,
  merged_into_id: id.nullable(),
}).strict();

export const RemoteOrganisationSchema = z.object({
  id,
  owner_id: id,
  display_name: z.string(),
  normalised_name: z.string(),
  note: z.string().nullable(),
  created_at: iso,
  merged_into_id: id.nullable(),
}).strict();

export const RemoteRelationshipSchema = z.object({
  id,
  owner_id: id,
  record_id: id,
  entity_type: z.enum(['person', 'organisation']),
  entity_id: id,
  role_note: z.string().nullable(),
  source: z.enum(['user', 'accepted_proposal', 'migration']),
  created_at: iso,
  removed_at: iso.nullable(),
}).strict();
