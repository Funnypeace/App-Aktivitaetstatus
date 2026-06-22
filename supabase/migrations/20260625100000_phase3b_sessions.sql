-- Phase 3b – Gaming Sessions / LFG

CREATE TABLE public.gaming_sessions (
  id             uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id     uuid         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_name      text         NOT NULL,
  title          text         NOT NULL,
  description    text,
  player_limit   integer      NOT NULL DEFAULT 4 CHECK (player_limit BETWEEN 2 AND 20),
  current_players integer     NOT NULL DEFAULT 1,
  voice_link     text,
  status         text         NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full')),
  starts_at      timestamptz,
  expires_at     timestamptz  DEFAULT (now() + interval '24 hours'),
  created_at     timestamptz  DEFAULT now() NOT NULL
);

CREATE TABLE public.session_members (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  uuid        NOT NULL REFERENCES public.gaming_sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at   timestamptz DEFAULT now() NOT NULL,
  UNIQUE (session_id, user_id)
);

-- Trigger: keep current_players and status in sync automatically
CREATE OR REPLACE FUNCTION public.update_session_player_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session_id uuid;
  v_count      integer;
  v_limit      integer;
BEGIN
  v_session_id := COALESCE(NEW.session_id, OLD.session_id);
  SELECT count(*)   INTO v_count FROM public.session_members WHERE session_id = v_session_id;
  SELECT player_limit INTO v_limit FROM public.gaming_sessions WHERE id = v_session_id;
  UPDATE public.gaming_sessions
  SET current_players = v_count,
      status = CASE WHEN v_count >= v_limit THEN 'full' ELSE 'open' END
  WHERE id = v_session_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER session_member_change
AFTER INSERT OR DELETE ON public.session_members
FOR EACH ROW EXECUTE FUNCTION public.update_session_player_count();

-- RLS
ALTER TABLE public.gaming_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_members  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select"
  ON public.gaming_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "sessions_insert"
  ON public.gaming_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "sessions_update"
  ON public.gaming_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id);
CREATE POLICY "sessions_delete"
  ON public.gaming_sessions FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

CREATE POLICY "session_members_select"
  ON public.session_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "session_members_insert"
  ON public.session_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "session_members_delete"
  ON public.session_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.gaming_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_members;
