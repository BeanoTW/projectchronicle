-- =========================================================
-- PART 1: DB-enforced edit history (AFTER UPDATE trigger)
-- =========================================================

CREATE OR REPLACE FUNCTION public.current_edit_source()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  BEGIN
    v := current_setting('app.edit_source', true);
  EXCEPTION WHEN others THEN
    v := NULL;
  END;
  IF v IS NULL OR v = '' THEN
    RETURN 'user';
  END IF;
  IF v NOT IN ('user', 'transcription', 'system', 'sync') THEN
    RETURN 'user';
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_incident_edits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src text := public.current_edit_source();
BEGIN
  IF NEW.raw_narrative IS DISTINCT FROM OLD.raw_narrative THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'raw_narrative', OLD.raw_narrative, NEW.raw_narrative, src, now());
  END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'category', OLD.category, NEW.category, src, now());
  END IF;
  IF NEW.subtype IS DISTINCT FROM OLD.subtype THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'subtype', OLD.subtype, NEW.subtype, src, now());
  END IF;
  IF NEW.location IS DISTINCT FROM OLD.location THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'location', OLD.location, NEW.location, src, now());
  END IF;
  IF NEW.exact_words IS DISTINCT FROM OLD.exact_words THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'exact_words', OLD.exact_words, NEW.exact_words, src, now());
  END IF;
  IF NEW.impact_note IS DISTINCT FROM OLD.impact_note THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'impact_note', OLD.impact_note, NEW.impact_note, src, now());
  END IF;
  IF NEW.incident_date IS DISTINCT FROM OLD.incident_date THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'incident_date', OLD.incident_date::text, NEW.incident_date::text, src, now());
  END IF;
  IF NEW.incident_time IS DISTINCT FROM OLD.incident_time THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'incident_time', OLD.incident_time, NEW.incident_time, src, now());
  END IF;
  IF NEW.people_involved IS DISTINCT FROM OLD.people_involved THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'people_involved',
            array_to_string(OLD.people_involved, ', '),
            array_to_string(NEW.people_involved, ', '),
            src, now());
  END IF;
  IF NEW.witnesses IS DISTINCT FROM OLD.witnesses THEN
    INSERT INTO public.edit_history(incident_id,user_id,field_changed,old_value,new_value,edit_source,changed_at)
    VALUES (NEW.id, NEW.user_id, 'witnesses',
            array_to_string(OLD.witnesses, ', '),
            array_to_string(NEW.witnesses, ', '),
            src, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incidents_log_edits ON public.incidents;
CREATE TRIGGER incidents_log_edits
  AFTER UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.log_incident_edits();

REVOKE UPDATE, DELETE ON public.edit_history FROM anon, authenticated;

-- =========================================================
-- PART 2: Sync conflict protection (version counter)
-- =========================================================

ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.bump_incident_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS incidents_bump_version ON public.incidents;
CREATE TRIGGER incidents_bump_version
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_incident_version();

CREATE OR REPLACE FUNCTION public.sync_upsert_incident(
  _row jsonb,
  _expected_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid := (_row->>'id')::uuid;
  _uid uuid := auth.uid();
  _existing public.incidents%ROWTYPE;
  _result public.incidents%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF (_row->>'user_id')::uuid <> _uid THEN
    RAISE EXCEPTION 'user_id mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _existing FROM public.incidents WHERE id = _id;

  IF FOUND THEN
    IF _existing.user_id <> _uid THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF _expected_version IS NOT NULL AND _existing.version <> _expected_version THEN
      RETURN jsonb_build_object(
        'status', 'conflict',
        'server_version', _existing.version,
        'server_last_modified_at', _existing.last_modified_at,
        'server_row', to_jsonb(_existing)
      );
    END IF;

    PERFORM set_config('app.edit_source', 'sync', true);

    UPDATE public.incidents SET
      raw_narrative = COALESCE(_row->>'raw_narrative', raw_narrative),
      category = _row->>'category',
      subtype = _row->>'subtype',
      location = _row->>'location',
      exact_words = _row->>'exact_words',
      impact_note = _row->>'impact_note',
      incident_date = COALESCE((_row->>'incident_date')::date, incident_date),
      incident_time = _row->>'incident_time',
      people_involved = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(_row->'people_involved')),
        people_involved),
      witnesses = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(_row->'witnesses')),
        witnesses),
      tags = COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(_row->'tags')),
        tags),
      severity = _row->>'severity',
      status = COALESCE(_row->>'status', status),
      title = _row->>'title',
      ai_summary = _row->>'ai_summary',
      record_method = COALESCE(_row->>'record_method', record_method),
      context_domain = _row->>'context_domain',
      category_source = COALESCE(_row->>'category_source', category_source),
      record_type = COALESCE(_row->>'record_type', record_type),
      record_date = (_row->>'record_date')::date,
      transcription_source_attachment_id = (_row->>'transcription_source_attachment_id')::uuid,
      transcription_created_at = (_row->>'transcription_created_at')::timestamptz,
      transcription_provider = _row->>'transcription_provider',
      transcription_model = _row->>'transcription_model',
      interactions = _row->'interactions',
      locked = COALESCE((_row->>'locked')::boolean, locked),
      excluded_from_rep = COALESCE((_row->>'excluded_from_rep')::boolean, excluded_from_rep),
      updated_at = now()
    WHERE id = _id
    RETURNING * INTO _result;

    RETURN jsonb_build_object('status', 'ok', 'row', to_jsonb(_result));
  ELSE
    PERFORM set_config('app.edit_source', 'sync', true);
    INSERT INTO public.incidents (
      id, user_id, incident_date, incident_time, location, people_involved, witnesses,
      category, subtype, severity, impact_note, raw_narrative, ai_summary, exact_words,
      tags, status, locked, excluded_from_rep, record_method, title, record_type,
      record_date, context_domain, category_source, original_created_at,
      transcription_source_attachment_id, transcription_created_at,
      transcription_provider, transcription_model, interactions, created_at, updated_at
    ) VALUES (
      _id, _uid,
      (_row->>'incident_date')::date,
      _row->>'incident_time',
      _row->>'location',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_row->'people_involved')), '{}'),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_row->'witnesses')), '{}'),
      _row->>'category',
      _row->>'subtype',
      _row->>'severity',
      _row->>'impact_note',
      _row->>'raw_narrative',
      _row->>'ai_summary',
      _row->>'exact_words',
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(_row->'tags')), '{}'),
      COALESCE(_row->>'status', 'Open'),
      COALESCE((_row->>'locked')::boolean, false),
      COALESCE((_row->>'excluded_from_rep')::boolean, false),
      COALESCE(_row->>'record_method', 'text'),
      _row->>'title',
      COALESCE(_row->>'record_type', 'incident'),
      (_row->>'record_date')::date,
      _row->>'context_domain',
      COALESCE(_row->>'category_source', 'ai'),
      COALESCE((_row->>'original_created_at')::timestamptz, now()),
      (_row->>'transcription_source_attachment_id')::uuid,
      (_row->>'transcription_created_at')::timestamptz,
      _row->>'transcription_provider',
      _row->>'transcription_model',
      _row->'interactions',
      COALESCE((_row->>'created_at')::timestamptz, now()),
      now()
    ) RETURNING * INTO _result;
    RETURN jsonb_build_object('status', 'ok', 'row', to_jsonb(_result));
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_upsert_incident(jsonb, integer) TO authenticated;