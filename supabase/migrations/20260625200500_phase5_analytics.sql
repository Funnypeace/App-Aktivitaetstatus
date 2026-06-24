-- Phase 5 – In-App Analytics
-- Owner-only read, self/anon insert. Tracks app usage events.

-- Owner check: true only for the app owner's JWT email. SECURITY INVOKER so it
-- reflects the calling user; only ever reveals the caller's own owner status.
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce((auth.jwt() ->> 'email') = 'funnypeace89@googlemail.com', false);
$$;

CREATE TABLE public.analytics_events (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text        NOT NULL,
  data       jsonb,
  session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analytics_events_created_idx    ON public.analytics_events (created_at DESC);
CREATE INDEX analytics_events_type_idx       ON public.analytics_events (event_type);
CREATE INDEX analytics_events_user_idx       ON public.analytics_events (user_id);
CREATE INDEX analytics_events_session_idx    ON public.analytics_events (session_id);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- SELECT: owner / admin only
CREATE POLICY "analytics_events_select_owner"
  ON public.analytics_events FOR SELECT TO authenticated
  USING (public.is_owner());

-- INSERT: signed-in users may log their own events; anon may log anonymous ones
CREATE POLICY "analytics_events_insert_self"
  ON public.analytics_events FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "analytics_events_insert_anon"
  ON public.analytics_events FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics_events;
