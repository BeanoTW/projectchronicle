-- Export timestamps table.
-- Stores trusted-timestamp metadata for export fingerprints.
-- This is a forward-looking data model: full RFC 3161 TSA integration is
-- not yet enabled. Rows may be inserted with status = 'unavailable' to
-- record the fingerprint of an export even when no timestamp token is
-- obtained. Real TSA tokens will be stored in `timestamp_token` (DER bytes
-- as base64 text) when integration is enabled.

CREATE TABLE public.export_timestamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- Stable identifier for the export instance (client-generated UUID).
  export_id uuid NOT NULL,
  -- Hex SHA-256 of the final export content (HTML).
  export_hash text NOT NULL,
  -- e.g. "freetsa.org", "digicert", or NULL when not yet enabled.
  timestamp_authority text,
  -- Base64-encoded RFC 3161 TimeStampToken (DER), when available.
  timestamp_token text,
  -- The trusted time asserted by the TSA, when available.
  timestamp_at timestamptz,
  -- Lifecycle status: 'unavailable' (no TSA), 'pending', 'success', 'failed'.
  status text NOT NULL DEFAULT 'unavailable',
  -- Free-form note (e.g. failure reason). Never contains record content.
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_export_timestamps_user ON public.export_timestamps(user_id);
CREATE INDEX idx_export_timestamps_export ON public.export_timestamps(export_id);

ALTER TABLE public.export_timestamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own export timestamps"
  ON public.export_timestamps
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own export timestamps"
  ON public.export_timestamps
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Append-only: no UPDATE or DELETE policies.
-- If a status changes (e.g. timestamping later succeeds), insert a new row
-- referencing the same export_id rather than mutating history.