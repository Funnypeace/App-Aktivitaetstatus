-- Phase 3b – Squad / Clan System

CREATE TABLE public.squads (
  id           uuid  DEFAULT gen_random_uuid() PRIMARY KEY,
  name         text  NOT NULL UNIQUE,
  description  text,
  leader_id    uuid  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  icon         text  NOT NULL DEFAULT '⚔️',
  member_count integer NOT NULL DEFAULT 1,
  created_at   timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT squads_name_length
    CHECK (char_length(name) >= 2 AND char_length(name) <= 30),
  CONSTRAINT squads_description_length
    CHECK (description IS NULL OR char_length(description) <= 300)
);

CREATE TABLE public.squad_members (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id   uuid        NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at  timestamptz DEFAULT now() NOT NULL,
  role       text        NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  UNIQUE (squad_id, user_id)
);

CREATE TABLE public.squad_chat (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  squad_id   uuid        NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  username   text,
  content    text        NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Trigger: keep member_count in sync
CREATE OR REPLACE FUNCTION public.update_squad_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_squad_id uuid;
  v_count    integer;
BEGIN
  v_squad_id := COALESCE(NEW.squad_id, OLD.squad_id);
  SELECT count(*) INTO v_count FROM public.squad_members WHERE squad_id = v_squad_id;
  UPDATE public.squads SET member_count = v_count WHERE id = v_squad_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER squad_member_change
AFTER INSERT OR DELETE ON public.squad_members
FOR EACH ROW EXECUTE FUNCTION public.update_squad_member_count();

-- RLS
ALTER TABLE public.squads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_chat    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "squads_select"
  ON public.squads FOR SELECT TO authenticated USING (true);
CREATE POLICY "squads_insert"
  ON public.squads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = leader_id);
CREATE POLICY "squads_update"
  ON public.squads FOR UPDATE TO authenticated
  USING (auth.uid() = leader_id);
CREATE POLICY "squads_delete"
  ON public.squads FOR DELETE TO authenticated
  USING (auth.uid() = leader_id);

CREATE POLICY "squad_members_select"
  ON public.squad_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "squad_members_insert"
  ON public.squad_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "squad_members_delete"
  ON public.squad_members FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Squad chat: only squad members may read/write
CREATE POLICY "squad_chat_select"
  ON public.squad_chat FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_id = squad_chat.squad_id AND user_id = auth.uid()
    )
  );
CREATE POLICY "squad_chat_insert"
  ON public.squad_chat FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_id = squad_chat.squad_id AND user_id = auth.uid()
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.squads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.squad_chat;
