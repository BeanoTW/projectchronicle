
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  user_id uuid,
  session_id text,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_analytics_events_event_time ON public.analytics_events (event_name, created_at DESC);
CREATE INDEX idx_analytics_events_user_time ON public.analytics_events (user_id, created_at DESC);
CREATE INDEX idx_analytics_events_time ON public.analytics_events (created_at DESC);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated may insert events (their own user_id, or null for anonymous)
CREATE POLICY "Authenticated users can insert analytics events"
ON public.analytics_events
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Allowlisted developer accounts may read aggregate analytics
CREATE OR REPLACE FUNCTION public.is_analytics_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce((auth.jwt() ->> 'email'), '')) IN (
    'project.chronicle88@gmail.com',
    'beanotarren@gmail.com'
  );
$$;

CREATE POLICY "Analytics admins can read events"
ON public.analytics_events
FOR SELECT
TO authenticated
USING (public.is_analytics_admin());
