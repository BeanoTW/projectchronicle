-- 1. Anonymous role: no DML on user-owned tables. RLS already blocks these,
--    this removes the grant as a second layer.
REVOKE ALL ON public.incidents FROM anon;
REVOKE ALL ON public.evidence_files FROM anon;
REVOKE ALL ON public.follow_up_notes FROM anon;
REVOKE ALL ON public.edit_history FROM anon;
REVOKE ALL ON public.export_timestamps FROM anon;
REVOKE ALL ON public.analytics_events FROM anon;

-- rights_guidance is intentionally world-readable (public support content).
REVOKE ALL ON public.rights_guidance FROM anon;
GRANT SELECT ON public.rights_guidance TO anon;

-- Authenticated users keep exactly what the policies allow.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_files TO authenticated;
GRANT SELECT, INSERT ON public.follow_up_notes TO authenticated;
GRANT SELECT, INSERT ON public.edit_history TO authenticated;
GRANT SELECT, INSERT ON public.export_timestamps TO authenticated;
GRANT INSERT, SELECT ON public.analytics_events TO authenticated;
GRANT SELECT ON public.rights_guidance TO authenticated;

-- 2. Trigger helpers are invoked by triggers as the table owner; nothing needs
--    to call them directly over the API.
REVOKE ALL ON FUNCTION public.assign_evidence_ref_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_incident_version() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_last_modified_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_incident_edits() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_original_created_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_edit_source() FROM PUBLIC, anon;

-- Application-facing functions stay callable by signed-in users only.
REVOKE ALL ON FUNCTION public.sync_upsert_incident(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_upsert_incident(jsonb, integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_analytics_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_analytics_admin() TO authenticated, service_role;

-- 3. Indexes for the two hot ownership lookups.
CREATE INDEX IF NOT EXISTS evidence_files_user_incident_idx
  ON public.evidence_files (user_id, incident_id);
CREATE INDEX IF NOT EXISTS follow_up_notes_user_idx
  ON public.follow_up_notes (user_id);